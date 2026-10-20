/** Emote wheel for BlockAcademy: each emote tells the player avatar which body animation to play. */

export interface Emote {
  id: string;        // stable id
  icon: string;      // emoji shown in the emote wheel
  name: string;      // e.g. "Wave"
  /** Which body animation the player avatar performs. */
  anim: 'wave' | 'dance' | 'jump' | 'sit' | 'cheer' | 'point' | 'sleep' | 'heart' | 'spin';
  /** Duration of the animation in seconds. */
  dur: number;
}

export const EMOTES: Emote[] = [
  { id: 'emote_wave',    icon: '👋', name: 'Wave',  anim: 'wave',   dur: 1.2 },
  { id: 'emote_dance',   icon: '🕺', name: 'Dance', anim: 'dance',  dur: 2.5 },
  { id: 'emote_jump',    icon: '🤸', name: 'Jump',  anim: 'jump',   dur: 1.0 },
  { id: 'emote_sit',     icon: '🪑', name: 'Sit',   anim: 'sit',    dur: 2.0 },
  { id: 'emote_cheer',   icon: '🙌', name: 'Cheer', anim: 'cheer',  dur: 1.5 },
  { id: 'emote_point',   icon: '👉', name: 'Point', anim: 'point',  dur: 1.0 },
  { id: 'emote_sleep',   icon: '😴', name: 'Sleep', anim: 'sleep',  dur: 2.5 },
  { id: 'emote_heart',   icon: '❤️', name: 'Heart', anim: 'heart',  dur: 1.5 },
  { id: 'emote_spin',    icon: '🌀', name: 'Spin',  anim: 'spin',   dur: 1.2 },
];

/** Emotes shown in the quick emote bar (a short subset). */
export const QUICK_EMOTES: Emote[] = [
  EMOTES[0], // wave
  EMOTES[4], // cheer
  EMOTES[7], // heart
  EMOTES[1], // dance
  EMOTES[5], // point
];

/** Find one emote by its id. */
export function emoteById(id: string): Emote | undefined {
  return EMOTES.find((e) => e.id === id);
}
