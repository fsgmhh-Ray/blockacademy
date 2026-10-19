/**
 * BlockAcademy 多人联机 —— 线上协议（Wire Protocol）
 *
 * 传输层：MQTT over WSS（见 net.ts），负载为 JSON。
 * 主题布局（room 为房间名，已消毒为 [a-z0-9-]）：
 *   blockacademy/v1/<room>/p/<playerId>   retained 在线状态（断线由 LWT 清空）
 *   blockacademy/v1/<room>/chat           聊天（控制台里不带 / 的发言即广播）
 *   blockacademy/v1/<room>/edit           方块编辑（放置/挖掘，世界差异同步）
 *   blockacademy/v1/<room>/evt            趣味事件（fart / wave）
 *
 * 设计原则：测试期零配置——默认连公共 broker，房间名即"密码"；
 * 设置里可换成自建 broker。所有消息都是纯增量，断线重连后自愈。
 */

export interface PlayerState {
  /** 本机玩家 id（profile id + 随机后缀，保证同设备多标签页不打架） */
  id: string;
  name: string;
  avatar: string;
  /** 玩家颜色（hex），远程化身用它染衣服 */
  color: string;
  /** 所在场景 id */
  scene: string;
  x: number;
  y: number;
  z: number;
  /** 水平朝向（弧度） */
  yaw: number;
  /** 发送时间戳（ms） */
  t: number;
}

export interface ChatMsg {
  /** 发送者玩家 id */
  id: string;
  name: string;
  avatar: string;
  color: string;
  text: string;
  t: number;
}

export interface EditMsg {
  scene: string;
  x: number;
  y: number;
  z: number;
  /** 方块 id，0 = 空气（挖掘） */
  block: number;
  /** 发起编辑的玩家 id（用于忽略自己的回显） */
  by: string;
}

export type EventKind = 'fart' | 'wave';

export interface EventMsg {
  kind: EventKind;
  id: string;
  name: string;
  scene: string;
  x: number;
  y: number;
  z: number;
}

export type NetStatus = 'off' | 'connecting' | 'online' | 'error';

export interface NetConfig {
  enabled: boolean;
  /** wss://host:port/path */
  broker: string;
  room: string;
}

export const DEFAULT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
export const DEFAULT_ROOM = 'main';

/** 房间名同时充当"密码"：只保留安全字符，防止主题注入 */
export function sanitizeRoom(r: string): string {
  const s = (r || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  return s || DEFAULT_ROOM;
}

export function topicRoot(room: string): string {
  return `blockacademy/v1/${sanitizeRoom(room)}`;
}

/** 超过 7 秒没有心跳就认为掉线（LWT 之外的兜底） */
export const PRESENCE_TTL = 7000;
/** 心跳周期（ms）——retained 状态刷新 */
export const HEARTBEAT_MS = 2000;
/** 位置广播节流（ms） */
const MOVE_MS = 120;

export class ProtocolError extends Error {}

export function encode<T>(msg: T): string {
  return JSON.stringify(msg);
}

export function decode<T>(raw: string): T | null {
  try {
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? (j as T) : null;
  } catch {
    return null;
  }
}

/** 位置是否需要重播（移动超过 4cm 或朝向变化超过 2°） */
export function stateChanged(a: PlayerState | null, b: PlayerState): boolean {
  if (!a) return true;
  if (Math.abs(a.x - b.x) > 0.04 || Math.abs(a.y - b.y) > 0.04 || Math.abs(a.z - b.z) > 0.04) return true;
  return Math.abs(a.yaw - b.yaw) > 0.035;
}

export const MOVE_THROTTLE_MS = MOVE_MS;
