/**
 * 家长控制（Parent Controls）
 *
 * 全部数据都存在本地 profile 里（见 src/user/profile.ts），没有后端。
 * 三层保护：
 *   1) 家长门禁 —— 进家长面板前要答对一道算术题（防止小孩自己改设置）
 *   2) 家长 PIN —— 家长面板里的高危操作（改密码、充值上限）需要 PIN
 *   3) 账号密码 —— 切换玩家档案时要输，防止别人直接用你的档
 *
 * 说明：这是本地儿童向游戏的温和管控，不是加密方案（数据本来就在自己设备上）。
 */

/** 极简字符串哈希（非加密，够用于本地 PIN 校验，且不存明文） */
export function hashPin(pin: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = `ba::${pin.trim()}::2026`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  return (h1 >>> 0).toString(36) + '-' + (h2 >>> 0).toString(36);
}

export function verifyPin(pin: string, stored: string): boolean {
  if (!stored) return true; // 没设密码 = 不拦
  return hashPin(pin) === stored;
}

/** 家长门禁题：两位数乘法（小学生都会，且不是随手就能猜的） */
export interface GateQuestion {
  q: string;
  answer: number;
}

export function gateQuestion(): GateQuestion {
  const a = 3 + Math.floor(Math.random() * 7); // 3..9
  const b = 4 + Math.floor(Math.random() * 7); // 4..10
  return { q: `What is ${a} × ${b}?`, answer: a * b };
}

/** 家长 PIN：4-6 位数字 */
export function validPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin.trim());
}

/** 账号密码：至少 4 个字符 */
export function validPassword(pw: string): boolean {
  return pw.trim().length >= 4;
}

/** 聊天时长：返回今天还能聊多少分钟（-1 = 不限） */
export function chatMinutesLeft(limit: number, used: number): number {
  if (!limit || limit <= 0) return -1;
  return Math.max(0, limit - used);
}

export function chatTimeText(limit: number, used: number): string {
  const left = chatMinutesLeft(limit, used);
  if (left < 0) return 'No limit';
  if (left <= 0) return "Time's up for today";
  return `${left} min left today`;
}

/** 家长设置里的开关 → 一句给家长看的中英文说明（英文，游戏内统一英文） */
export const PARENT_SETTING_LABELS: { key: string; label: string; desc: string }[] = [
  { key: 'freeChat', label: 'Free chat', desc: 'Allow sending messages to other players.' },
  { key: 'multiplayer', label: 'Multiplayer', desc: 'Allow joining online rooms with other players.' },
  { key: 'ai', label: 'AI helper', desc: 'Allow the AI characters to use an online AI model.' },
  { key: 'wordFilter', label: 'Word filter', desc: 'Replace messages that contain rude words with ###.' },
  { key: 'gateOn', label: 'Parent gate', desc: 'Ask a maths question before showing parent settings.' },
];

/** 给家长看的每日报告要点 */
export function parentReport(coins: number, questsDone: number, tasksTotal: number): string {
  return `Today: ${questsDone}/${tasksTotal} tasks done · ${coins} coins earned`;
}
