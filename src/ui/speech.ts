/** 全局语音开关（浏览器自带语音合成，零成本给 NPC 配音） */
let enabled = localStorage.getItem('blockacademy.voice') === 'on';
const listeners = new Set<(v: boolean) => void>();

export function speechEnabled(): boolean {
  return enabled;
}

export function setSpeechEnabled(v: boolean): void {
  enabled = v;
  localStorage.setItem('blockacademy.voice', v ? 'on' : 'off');
  listeners.forEach((l) => l(v));
}

export function onSpeechChange(l: (v: boolean) => void): void {
  listeners.add(l);
}
