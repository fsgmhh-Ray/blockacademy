/**
 * BlockAcademy 多人联机客户端（NetClient）
 *
 * 为什么选 MQTT over WSS：
 *  - 纯静态托管（Cloudflare Pages）没有 WebSocket 服务端，而 Pages Functions 无状态；
 *  - 公共 broker 零注册零配置，测试期几个人足够；设置里可随时换成自建 broker；
 *  - retained 消息 + LWT（遗嘱）天然实现"在线状态"：异常断线时 broker 会自动
 *    替我们清掉 retained 状态，其他客户端立刻看到人没了。
 *
 * 所有回调都在主线程调用；本类不做任何 THREE / DOM 操作，方便单测。
 */
import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import {
  DEFAULT_BROKER,
  HEARTBEAT_MS,
  MOVE_THROTTLE_MS,
  PRESENCE_TTL,
  decode,
  encode,
  sanitizeRoom,
  stateChanged,
  topicRoot,
  type ChatMsg,
  type EditMsg,
  type EventKind,
  type EventMsg,
  type NetConfig,
  type NetStatus,
  type PlayerState,
} from './protocol';

// mqtt 的浏览器 ESM 构建只暴露 default（命名空间对象），connect 挂在它上面
const connect = mqtt.connect as (url: string, opts?: IClientOptions) => MqttClient;

export interface NetEvents {
  onStatus?: (s: NetStatus, detail?: string) => void;
  /** 新玩家出现或状态更新 */
  onPlayer?: (p: PlayerState) => void;
  /** 玩家离开（LWT / TTL 过期 / 主动退出） */
  onPlayerGone?: (id: string) => void;
  onChat?: (m: ChatMsg) => void;
  onEdit?: (m: EditMsg) => void;
  onEvent?: (m: EventMsg) => void;
}

export interface Identity {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export class NetClient {
  private client: MqttClient | null = null;
  private cfg: NetConfig;
  private me: Identity | null = null;
  /** 本连接的唯一 id（同设备多标签页互不干扰） */
  private connId = '';
  private status: NetStatus = 'off';
  private lastSent: PlayerState | null = null;
  private lastSentAt = 0;
  private hbTimer = 0;
  private pruneTimer = 0;
  private lastChatAt = 0;
  private remote = new Map<string, { state: PlayerState; seen: number }>();

  constructor(
    cfg: NetConfig,
    private ev: NetEvents = {},
  ) {
    this.cfg = { ...cfg, room: sanitizeRoom(cfg.room), broker: cfg.broker || DEFAULT_BROKER };
  }

  // ───────── 基本状态 ─────────
  get myId(): string {
    return this.connId;
  }
  get room(): string {
    return this.cfg.room;
  }
  get broker(): string {
    return this.cfg.broker;
  }
  get enabled(): boolean {
    return this.cfg.enabled;
  }
  getStatus(): NetStatus {
    return this.status;
  }
  getPlayers(): PlayerState[] {
    return [...this.remote.values()].map((r) => r.state);
  }

  setConfig(cfg: NetConfig): void {
    const next = { ...cfg, room: sanitizeRoom(cfg.room), broker: cfg.broker || DEFAULT_BROKER };
    const same = next.broker === this.cfg.broker && next.room === this.cfg.room;
    this.cfg = next;
    if (!next.enabled) {
      this.disconnect();
    } else if (!same && this.client) {
      // 换了 broker/房间：重连
      this.disconnect();
      this.connect();
    }
  }

  setIdentity(id: Identity): void {
    this.me = id;
    // 身份变化（改名/换头像）：清掉节流缓存，下一帧的位置广播会带上新身份
    this.lastSent = null;
  }

  // ───────── 连接 ─────────
  connect(): void {
    if (!this.cfg.enabled || this.client) return;
    this.setStatus('connecting');
    this.connId = 'p' + (this.me?.id ?? 'x') + '-' + Math.random().toString(36).slice(2, 7);

    const opts: IClientOptions = {
      clientId: 'ba-' + this.connId,
      keepalive: 30,
      reconnectPeriod: 4000,
      connectTimeout: 9000,
      clean: true,
      // 遗嘱：异常断线时清掉自己的 retained 状态，别人立刻看到我掉线
      will: {
        topic: `${topicRoot(this.cfg.room)}/p/${this.connId}`,
        payload: '',
        qos: 1,
        retain: true,
      },
    };
    try {
      this.client = connect(this.cfg.broker, opts);
    } catch (e) {
      this.setStatus('error', (e as Error).message);
      return;
    }

    const c = this.client;
    c.on('connect', () => {
      this.setStatus('online');
      c.subscribe(`${topicRoot(this.cfg.room)}/#`, { qos: 0 }, (err) => {
        if (err) this.setStatus('error', 'subscribe failed: ' + err.message);
      });
      // 位置由主循环每帧节流广播，这里只启心跳与过期清理
      this.hbTimer = window.setInterval(() => {
        const cc = this.client;
        if (cc?.connected && this.lastSent) {
          cc.publish(`${topicRoot(this.cfg.room)}/p/${this.connId}`, encode(this.lastSent), {
            qos: 0,
            retain: true,
          });
        }
      }, HEARTBEAT_MS);
      this.pruneTimer = window.setInterval(() => this.prune(), 2000);
    });
    c.on('reconnect', () => this.setStatus('connecting'));
    c.on('close', () => {
      if (this.status !== 'off') this.setStatus('connecting');
    });
    c.on('error', (e) => this.setStatus('error', e.message));
    c.on('message', (topic, payload) => this.route(topic, payload.toString()));
  }

  disconnect(): void {
    if (this.hbTimer) window.clearInterval(this.hbTimer);
    if (this.pruneTimer) window.clearInterval(this.pruneTimer);
    this.hbTimer = 0;
    this.pruneTimer = 0;
    const c = this.client;
    this.client = null;
    this.remote.clear();
    this.lastSent = null;
    this.setStatus('off');
    if (c) {
      try {
        // 主动清掉 retained 状态再断开，别人立刻看到我离开
        c.publish(`${topicRoot(this.cfg.room)}/p/${this.connId}`, '', { qos: 1, retain: true });
        c.end(true);
      } catch {
        /* ignore */
      }
    }
  }

  private setStatus(s: NetStatus, detail?: string): void {
    if (this.status === s && !detail) return;
    this.status = s;
    this.ev.onStatus?.(s, detail);
  }

  // ───────── 消息路由 ─────────
  private route(topic: string, raw: string): void {
    const root = topicRoot(this.cfg.room);
    if (!topic.startsWith(root + '/')) return;
    const rest = topic.slice(root.length + 1);
    const slash = rest.indexOf('/');
    const head = slash < 0 ? rest : rest.slice(0, slash);

    if (head === 'p') {
      const id = rest.slice(2);
      if (id === this.connId) return; // 自己的回显
      if (!raw) {
        this.remote.delete(id);
        this.ev.onPlayerGone?.(id);
        return;
      }
      const st = decode<PlayerState>(raw);
      if (!st || typeof st.x !== 'number') return;
      this.remote.set(id, { state: st, seen: Date.now() });
      this.ev.onPlayer?.(st);
      return;
    }
    if (head === 'chat') {
      const m = decode<ChatMsg>(raw);
      if (m && typeof m.text === 'string') this.ev.onChat?.(m);
      return;
    }
    if (head === 'edit') {
      const m = decode<EditMsg>(raw);
      if (m && typeof m.x === 'number') this.ev.onEdit?.(m);
      return;
    }
    if (head === 'evt') {
      const m = decode<EventMsg>(raw);
      if (m && m.kind) this.ev.onEvent?.(m);
    }
  }

  /** TTL 兜底：LWT 偶尔延迟，7 秒没心跳就当他走了 */
  private prune(): void {
    const now = Date.now();
    for (const [id, r] of this.remote) {
      if (now - r.seen > PRESENCE_TTL) {
        this.remote.delete(id);
        this.ev.onPlayerGone?.(id);
      }
    }
  }

  // ───────── 发送 ─────────
  /** 广播自己的位置/朝向（内部节流：移动 120ms、心跳 2s） */
  publishState(
    force: boolean,
    st?: { scene: string; x: number; y: number; z: number; yaw: number },
  ): void {
    const c = this.client;
    if (!c || !c.connected || !this.me || !st) return;
    const now = Date.now();
    if (!force && now - this.lastSentAt < MOVE_THROTTLE_MS) return;
    const next: PlayerState = {
      id: this.connId,
      name: this.me.name,
      avatar: this.me.avatar,
      color: this.me.color,
      scene: st.scene,
      x: Math.round(st.x * 100) / 100,
      y: Math.round(st.y * 100) / 100,
      z: Math.round(st.z * 100) / 100,
      yaw: Math.round(st.yaw * 100) / 100,
      t: now,
    };
    if (!force && !stateChanged(this.lastSent, next)) return;
    this.lastSent = next;
    this.lastSentAt = now;
    c.publish(`${topicRoot(this.cfg.room)}/p/${this.connId}`, encode(next), { qos: 0, retain: true });
  }

  /** 控制台里不带 / 的发言 → 全房间广播 */
  chat(text: string): void {
    const c = this.client;
    if (!c || !c.connected || !this.me) return;
    const now = Date.now();
    if (now - this.lastChatAt < 1200) return; // 简单防刷屏
    this.lastChatAt = now;
    const clean = text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 140);
    if (!clean) return;
    const m: ChatMsg = {
      id: this.connId,
      name: this.me.name,
      avatar: this.me.avatar,
      color: this.me.color,
      text: clean,
      t: now,
    };
    c.publish(`${topicRoot(this.cfg.room)}/chat`, encode(m), { qos: 0 });
  }

  /** 方块编辑广播（0 = 挖掉） */
  edit(scene: string, x: number, y: number, z: number, block: number): void {
    const c = this.client;
    if (!c || !c.connected) return;
    const m: EditMsg = { scene, x, y, z, block, by: this.connId };
    c.publish(`${topicRoot(this.cfg.room)}/edit`, encode(m), { qos: 0 });
  }

  event(kind: EventKind, scene: string, x: number, y: number, z: number): void {
    const c = this.client;
    if (!c || !c.connected || !this.me) return;
    const m: EventMsg = { kind, id: this.connId, name: this.me.name, scene, x, y, z };
    c.publish(`${topicRoot(this.cfg.room)}/evt`, encode(m), { qos: 0 });
  }

  /** 邀请链接：同房间的人打开即进同一间 */
  inviteUrl(): string {
    const u = new URL(location.href);
    u.search = '?room=' + encodeURIComponent(this.cfg.room);
    u.hash = '';
    return u.toString();
  }
}
