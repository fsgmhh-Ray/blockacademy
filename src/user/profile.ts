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

export interface ProfileMeta {
  id: string;
  name: string;
  avatar: string;
  color: string;
  createdAt: number;
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
