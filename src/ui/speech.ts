/** 全局语音开关（浏览器自带语音合成，零成本给 NPC 配音）
 *  开关状态本身归属到玩家 profile 持久化（见 src/user/profile.ts），
 *  这里只负责内存中的实时值与订阅通知。 */
let enabled = false;
const listeners = new Set<(v: boolean) => void>();

export function initSpeech(v: boolean): void {
  enabled = !!v;
}

export function speechEnabled(): boolean {
  return enabled;
}

export function setSpeechEnabled(v: boolean): void {
  enabled = v;
  listeners.forEach((l) => l(v));
}

export function onSpeechChange(l: (v: boolean) => void): void {
  listeners.add(l);
}
