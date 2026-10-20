/**
 * Local multi-player "user system" for BlockAcademy.
 *
 * The game is 100% client-side (Cloudflare Pages, no backend DB), so a "user"
 * here is a local profile stored in localStorage. Each player carries their own
 * AI config, voice preference, and learning progress — perfect for a family /
 * classroom where several kids share one device.
 *
 * Storage layout:
 *   blockacademy.users        -> { activeId, list: ProfileMeta[] }
 *   blockacademy.user.<id>    -> { llm, speech, progress }
 *
 * Legacy single-player keys (blockacademy.llm / .progress / .voice) are
 * migrated into a default "Explorer" profile on first run, so nobody loses
 * the AI key or progress they already set.
 */
import type { LLMConfig } from '../npc/brain';
import type { Progress } from '../edu/quests';
import { DEFAULT_BROKER, DEFAULT_ROOM, type NetConfig } from '../net/protocol';
import { DEFAULT_OUTFIT, normalizeOutfit, type Outfit } from './wardrobe';
import { DEFAULT_GRADE, clampGrade } from '../edu/grades';

export interface ProfileMeta {
  id: string;
  name: string;
  avatar: string;
  color: string;
  createdAt: number;
}

/** 家长设置：全部存在本地 profile 里，由家长 PIN 保护 */
export interface ParentSettings {
  /** 家长门禁是否开启（进入家长面板前要答对一道题） */
  gateOn: boolean;
  /** 家长 PIN 的哈希（明文不保存） */
  pin: string;
  /** 每日自由聊天上限（分钟），0 = 不限 */
  chatMinutes: number;
  /** 允许自由聊天（打给别的玩家） */
  freeChat: boolean;
  /** 允许多人联机 */
  multiplayer: boolean;
  /** 允许使用外部 AI */
  ai: boolean;
  /** 敏感词过滤（整条消息变成 ###） */
  wordFilter: boolean;
  /** 允许的年级范围 */
  gradeMin: number;
  gradeMax: number;
}

export interface ChatEntry {
  /** NPC 的 id，'me' 表示玩家自己说的 */
  who: string;
  emoji: string;
  text: string;
  me: boolean;
  at: number;
}

export interface UserState {
  llm: LLMConfig;
  speech: boolean;
  progress: Progress;
  /** JAVA = 键鼠，BEDROCK = 触屏 */
  edition: 'java' | 'bedrock';
  /** 背包存档 JSON */
  inventory: string;
  chatLog: ChatEntry[];
  /** NPC id -> 好感度 0..3 */
  friendship: Record<string, number>;
  /** 成就 id -> 达成时间戳 */
  achievements: Record<string, number>;
  sound: boolean;
  volume: number;
  /** 多人联机配置（broker / 房间 / 开关） */
  net: NetConfig;
  /** 学校年级 1..6，决定任务与知识难度 */
  grade: number;
  /** 金币 */
  coins: number;
  /** 已购买的通行证 id */
  passes: string[];
  /** 答题解锁的物品 id */
  unlocked: string[];
  /** 角色外观 */
  outfit: Outfit;
  /** 家长设置 */
  parent: ParentSettings;
  /** 账号密码哈希（别人不能用这个账号） */
  password: string;
  /** 世界扩张次数：每完成一个任务 +1 */
  expansion: number;
  /** 今天已经用掉的聊天分钟数 */
  chatUsed: number;
  /** 聊天计费日（YYYY-MM-DD），跨天自动清零 */
  chatDay: string;
  /** 箱子内容物 JSON（见 world/chests.ts） */
  chests: string;
}

const INDEX_KEY = 'blockacademy.users';
const STATE_PREFIX = 'blockacademy.user.';

interface Index {
  activeId: string | null;
  list: ProfileMeta[];
}

const emptyProgress = (): Progress => ({ talk: {}, demo: {}, build: {}, explore: {}, chatTurns: 0 });
const defaultLLM = (): LLMConfig => ({ enabled: false, baseUrl: '', apiKey: '', model: '' });
/** 联机默认开：零配置进公共 broker 的 main 房间；设置里可关/可换 */
const defaultNet = (): NetConfig => ({ enabled: true, broker: DEFAULT_BROKER, room: DEFAULT_ROOM });

const defaultParent = (): ParentSettings => ({
  gateOn: true,
  pin: '',
  chatMinutes: 0,
  freeChat: true,
  multiplayer: true,
  ai: true,
  wordFilter: true,
  gradeMin: 1,
  gradeMax: 6,
});

/** 今天的日期（本地时区），用于聊天时长按天重置 */
function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function uid(): string {
  return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadIndex(): Index {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (j && Array.isArray(j.list)) return { activeId: j.activeId ?? null, list: j.list };
    }
  } catch {
    /* ignore */
  }
  return { activeId: null, list: [] };
}

function saveIndex(i: Index): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(i));
}

function defaultState(): UserState {
  return {
    llm: defaultLLM(),
    speech: false,
    progress: emptyProgress(),
    edition: 'java',
    inventory: '',
    chatLog: [],
    friendship: {},
    achievements: {},
    sound: true,
    volume: 0.55,
    net: defaultNet(),
    grade: DEFAULT_GRADE,
    coins: 0,
    passes: [],
    unlocked: [],
    outfit: { ...DEFAULT_OUTFIT },
    parent: defaultParent(),
    password: '',
    expansion: 0,
    chatUsed: 0,
    chatDay: today(),
    chests: '',
  };
}

function loadState(id: string): UserState {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(STATE_PREFIX + id);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        llm: { ...base.llm, ...(s.llm || {}) },
        speech: base.speech || !!s.speech,
        progress: { ...base.progress, ...(s.progress || {}) },
        edition: s.edition === 'bedrock' ? 'bedrock' : 'java',
        inventory: typeof s.inventory === 'string' ? s.inventory : '',
        chatLog: Array.isArray(s.chatLog) ? s.chatLog : [],
        friendship: s.friendship && typeof s.friendship === 'object' ? s.friendship : {},
        achievements: s.achievements && typeof s.achievements === 'object' ? s.achievements : {},
        sound: s.sound === undefined ? true : !!s.sound,
        volume: typeof s.volume === 'number' ? s.volume : 0.55,
        net: {
          enabled: s.net?.enabled ?? true,
          broker: typeof s.net?.broker === 'string' && s.net.broker ? s.net.broker : DEFAULT_BROKER,
          room: typeof s.net?.room === 'string' && s.net.room ? s.net.room : DEFAULT_ROOM,
        },
        grade: clampGrade(typeof s.grade === 'number' ? s.grade : DEFAULT_GRADE),
        coins: typeof s.coins === 'number' && s.coins >= 0 ? Math.floor(s.coins) : 0,
        passes: Array.isArray(s.passes) ? (s.passes as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        unlocked: Array.isArray(s.unlocked)
          ? (s.unlocked as unknown[]).filter((x): x is string => typeof x === 'string')
          : [],
        outfit: normalizeOutfit(s.outfit),
        parent: { ...defaultParent(), ...(s.parent && typeof s.parent === 'object' ? s.parent : {}) },
        password: typeof s.password === 'string' ? s.password : '',
        expansion: typeof s.expansion === 'number' && s.expansion > 0 ? Math.floor(s.expansion) : 0,
        chatUsed: typeof s.chatUsed === 'number' && s.chatUsed > 0 ? s.chatUsed : 0,
        chatDay: typeof s.chatDay === 'string' ? s.chatDay : today(),
        chests: typeof s.chests === 'string' ? s.chests : '',
      };
    }
  } catch {
    /* ignore */
  }
  return base;
}

function saveState(id: string, s: UserState): void {
  localStorage.setItem(
    STATE_PREFIX + id,
    JSON.stringify({
      llm: s.llm,
      speech: s.speech,
      progress: s.progress,
      edition: s.edition,
      inventory: s.inventory,
      // 聊天记录只留最近 300 条，避免 localStorage 爆掉
      chatLog: s.chatLog.slice(-300),
      friendship: s.friendship,
      achievements: s.achievements,
      sound: s.sound,
      volume: s.volume,
      net: s.net ?? defaultNet(),
      grade: s.grade,
      coins: s.coins,
      passes: s.passes,
      unlocked: s.unlocked,
      outfit: s.outfit,
      parent: s.parent,
      password: s.password,
      expansion: s.expansion,
      chatUsed: s.chatUsed,
      chatDay: s.chatDay,
      chests: s.chests,
    }),
  );
}

/** Bring the single-player era into the multi-player era. Returns the index. */
function migrate(): Index {
  const idx = loadIndex();
  if (idx.list.length) return idx;

  let legacyLLM = defaultLLM();
  let legacySpeech = false;
  let legacyProgress = emptyProgress();
  try {
    const l = localStorage.getItem('blockacademy.llm');
    if (l) legacyLLM = { enabled: true, ...JSON.parse(l) };
    const v = localStorage.getItem('blockacademy.voice');
    if (v) legacySpeech = v === 'on';
    const p = localStorage.getItem('blockacademy.progress');
    if (p) legacyProgress = { ...emptyProgress(), ...JSON.parse(p) };
  } catch {
    /* ignore */
  }

  const meta: ProfileMeta = {
    id: uid(),
    name: 'Explorer',
    avatar: '🧑‍🚀',
    color: '#5ad1c9',
    createdAt: Date.now(),
  };
  saveState(meta.id, { ...defaultState(), llm: legacyLLM, speech: legacySpeech, progress: legacyProgress });
  // drop legacy keys so they can't drift out of sync
  localStorage.removeItem('blockacademy.llm');
  localStorage.removeItem('blockacademy.voice');
  localStorage.removeItem('blockacademy.progress');

  idx.list = [meta];
  idx.activeId = meta.id;
  saveIndex(idx);
  return idx;
}

export function getActiveState(): { meta: ProfileMeta; state: UserState } {
  migrate();
  const idx = loadIndex();
  let id = idx.activeId;
  if (!id || !idx.list.find((m) => m.id === id)) id = idx.list[0]?.id ?? null;
  if (!id) {
    createProfile('Explorer', '🧑‍🚀', '#5ad1c9');
    return getActiveState();
  }
  const meta = idx.list.find((m) => m.id === id)!;
  return { meta, state: loadState(id) };
}

export function listProfiles(): ProfileMeta[] {
  return migrate().list;
}

export function activeId(): string | null {
  return migrate().activeId;
}

export function createProfile(name: string, avatar: string, color: string): ProfileMeta {
  const idx = migrate();
  const meta: ProfileMeta = {
    id: uid(),
    name: name.trim() || 'Explorer',
    avatar: avatar || '🧑‍🚀',
    color: color || '#5ad1c9',
    createdAt: Date.now(),
  };
  idx.list.push(meta);
  saveState(meta.id, defaultState());
  idx.activeId = meta.id;
  saveIndex(idx);
  return meta;
}

export function selectProfile(id: string): void {
  const idx = migrate();
  if (idx.list.find((m) => m.id === id)) {
    idx.activeId = id;
    saveIndex(idx);
  }
}

/** Returns false if it would delete the last remaining profile. */
export function deleteProfile(id: string): boolean {
  const idx = migrate();
  if (idx.list.length <= 1) return false;
  idx.list = idx.list.filter((m) => m.id !== id);
  localStorage.removeItem(STATE_PREFIX + id);
  if (idx.activeId === id) idx.activeId = idx.list[0]?.id ?? null;
  saveIndex(idx);
  return true;
}

/** Persist a partial update onto the currently active profile. */
export function saveActive(partial: Partial<UserState>): void {
  const idx = migrate();
  const id = idx.activeId;
  if (!id) return;
  const next = { ...loadState(id), ...partial };
  saveState(id, next);
}

// ───────── 存档小工具（都作用于当前玩家） ─────────

export function addCoins(n: number): number {
  const st = getActiveState().state;
  const coins = Math.max(0, st.coins + n);
  saveActive({ coins });
  return coins;
}

export function hasPass(id: string): boolean {
  return getActiveState().state.passes.includes(id);
}

export function grantPass(id: string): void {
  const st = getActiveState().state;
  if (st.passes.includes(id)) return;
  saveActive({ passes: [...st.passes, id] });
}

export function isUnlocked(itemKey: string): boolean {
  return getActiveState().state.unlocked.includes(itemKey);
}

export function unlockItem(itemKey: string): void {
  const st = getActiveState().state;
  if (st.unlocked.includes(itemKey)) return;
  saveActive({ unlocked: [...st.unlocked, itemKey] });
}

export function setGrade(g: number): void {
  saveActive({ grade: clampGrade(g) });
}

export function setOutfit(o: Outfit): void {
  saveActive({ outfit: normalizeOutfit(o) });
}

export function setParentSettings(p: Partial<ParentSettings>): void {
  const st = getActiveState().state;
  saveActive({ parent: { ...st.parent, ...p } });
}

export function setPassword(hash: string): void {
  saveActive({ password: hash });
}

export function hasPassword(): boolean {
  return !!getActiveState().state.password;
}

export function bumpExpansion(): number {
  const st = getActiveState().state;
  const expansion = st.expansion + 1;
  saveActive({ expansion });
  return expansion;
}

export function setChests(json: string): void {
  saveActive({ chests: json });
}

/** 某个档案是否设了密码（切换档案时要用；不区分是不是当前玩家） */
export function profileIsLocked(id: string): boolean {
  try {
    const raw = localStorage.getItem(STATE_PREFIX + id);
    if (!raw) return false;
    const s = JSON.parse(raw) as { password?: unknown };
    return typeof s.password === 'string' && s.password.length > 0;
  } catch {
    return false;
  }
}

/** 校验某个档案的密码 */
export function checkProfilePassword(id: string, hash: string): boolean {
  try {
    const raw = localStorage.getItem(STATE_PREFIX + id);
    if (!raw) return false;
    const s = JSON.parse(raw) as { password?: unknown };
    const stored = typeof s.password === 'string' ? s.password : '';
    if (!stored) return true; // 没设密码 = 不拦
    return stored === hash;
  } catch {
    return false;
  }
}
