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

export interface ProfileMeta {
  id: string;
  name: string;
  avatar: string;
  color: string;
  createdAt: number;
}

export interface UserState {
  llm: LLMConfig;
  speech: boolean;
  progress: Progress;
}

const INDEX_KEY = 'blockacademy.users';
const STATE_PREFIX = 'blockacademy.user.';

interface Index {
  activeId: string | null;
  list: ProfileMeta[];
}

const emptyProgress = (): Progress => ({ talk: {}, demo: {}, build: {}, explore: {}, chatTurns: 0 });
const defaultLLM = (): LLMConfig => ({ enabled: false, baseUrl: '', apiKey: '', model: '' });

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

function loadState(id: string): UserState {
  try {
    const raw = localStorage.getItem(STATE_PREFIX + id);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        llm: { ...defaultLLM(), ...(s.llm || {}) },
        speech: !!s.speech,
        progress: { ...emptyProgress(), ...(s.progress || {}) },
      };
    }
  } catch {
    /* ignore */
  }
  return { llm: defaultLLM(), speech: false, progress: emptyProgress() };
}

function saveState(id: string, s: UserState): void {
  localStorage.setItem(
    STATE_PREFIX + id,
    JSON.stringify({ llm: s.llm, speech: s.speech, progress: s.progress }),
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
  saveState(meta.id, { llm: legacyLLM, speech: legacySpeech, progress: legacyProgress });
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
  saveState(meta.id, { llm: defaultLLM(), speech: false, progress: emptyProgress() });
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
