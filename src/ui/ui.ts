/** All DOM UI: HUD, dialog, quests, map, settings, demo player, title screen */
import { blockDef } from '../core/blockRegistry';
import { atlasCanvas, TILE, tileIdOf } from '../core/textures';
import { blocks } from '../world/blockIds';
import { PERSONALITIES } from '../npc/personalities';
import { setSpeechEnabled, speechEnabled } from './speech';
import { loadLLMConfig, type LLMConfig } from '../npc/brain';
import type { ProfileMeta } from '../user/profile';
import { SCENES, type SceneDef } from '../world/scenes';
import { questsOf, type Quest, type Progress } from '../edu/quests';
import type { Inventory, Slot, Tab } from '../craft/inventory';
import { item, blockItems } from '../craft/items';
import {
  DEFAULT_BROKER,
  type ChatMsg,
  type NetConfig,
  type NetStatus,
  type PlayerState,
} from '../net/protocol';

export type InvTarget = 'storage' | 'hotbar' | 'craft' | 'out' | 'offhand' | 'fin' | 'fout' | 'palette';
export type Overlay = 'map' | 'settings' | 'help' | 'profiles' | 'inventory' | 'pause' | 'chatlog' | 'players';
export type PauseAction =
  | 'resume'
  | 'gamemode'
  | 'inventory'
  | 'chatlog'
  | 'players'
  | 'help'
  | 'settings'
  | 'sound'
  | 'edition'
  | 'title';

export interface UIHooks {
  onStart: () => void;
  onGotoScene: (id: string) => void;
  onAsk: (text: string) => void;
  onDialogClose: () => void;
  onSettingSave: (cfg: LLMConfig) => void;
  onTestLLM: (cfg: LLMConfig) => Promise<string>;
  onSpeech: (v: boolean) => void;
  onProfiles: () => { list: ProfileMeta[]; activeId: string };
  onCreateProfile: (name: string, avatar: string, color: string) => void;
  onSwitchProfile: (id: string) => void;
  onDeleteProfile: (id: string) => void;
  onHotbar: (i: number) => void;
  onDemo: (action: 'next' | 'prev' | 'skip' | 'replay') => void;
  onPlayDemo: (id: string) => void;
  onCommand: (raw: string) => void;
  onConsoleClose: () => void;
  onInvClick: (target: InvTarget, index: number) => void;
  onInvTab: (tab: Tab) => void;
  onFart: () => void;
  onPause: (action: PauseAction) => void;
  onChatlogClear: () => void;
  onEdition: (edition: 'java' | 'bedrock') => void;
  onGift: () => void;
  onEat: () => void;
  /** 保存联机配置（broker / 房间 / 开关） */
  onNetSave: (cfg: NetConfig) => void;
  /** 读取联机状态与在线玩家（在线面板用） */
  onNetInfo: () => {
    enabled: boolean;
    status: NetStatus;
    room: string;
    broker: string;
    players: PlayerState[];
    invite: string;
  };
}

const PRESETS: { name: string; baseUrl: string; model: string; tip: string }[] = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', tip: 'Official API; needs a reachable network' },
  { name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini', tip: 'Built-in X real-time data — great for up-to-date NPCs' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', tip: 'Very fast, free tier. Use llama-3.3-70b-versatile (or gpt-oss models, which are slower reasoning models)' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', tip: 'Natural expression, cheap — good for beginners' },
  { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', tip: 'Friendly to long text' },
  { name: 'Ali Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', tip: 'Stable direct connection in China' },
  { name: 'Local Ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b', tip: 'Runs fully offline, no network needed' },
];

export class UI {
  private el: { [k: string]: HTMLElement } = {};
  currentNpcId: string | null = null;
  private lastBubble: HTMLElement | null = null;
  private chipsHost!: HTMLElement;
  private askInput!: HTMLInputElement;
  private selSlot = 0;
  private cmdInput!: HTMLInputElement;
  private cmdLog!: HTMLElement;
  private selAvatar = '🧑‍🚀';
  private selColor = '#5ad1c9';
  private playerMeta: ProfileMeta | null = null;
  private titleTimer = 0;
  private invTab: Tab = 'bag';
  private palette: string[] | null = null;

  constructor(
    private root: HTMLElement,
    private hooks: UIHooks,
  ) {
    root.innerHTML = TEMPLATE;
    const q = (id: string): HTMLElement => {
      const node = root.querySelector('#' + id) as HTMLElement;
      this.el[id] = node;
      return node;
    };
    q('crosshair');
    q('topbar');
    q('hint');
    q('cmd-title');
    q('hotbar');
    q('dialog');
    q('chat');
    this.chipsHost = q('quick');
    this.askInput = q('ask-input') as HTMLInputElement;
    q('quests');
    q('overlay-map');
    q('overlay-settings');
    q('overlay-profiles');
    q('overlay-help');
    q('overlay-inventory');
    q('overlay-pause');
    q('overlay-chatlog');
    q('overlay-players');
    q('showcase');
    q('sc-top');
    q('sc-bar');
    q('sc-sub');
    q('sc-step');
    q('toast');
    q('title-screen');
    q('loading');
    q('cmd-console');
    q('cmd-log');
    q('net-chip');
    q('chatfeed');
    q('hearts');
    q('hunger');
    q('f3');
    q('friend-bar');
    this.cmdInput = q('cmd-input') as HTMLInputElement;
    this.cmdLog = q('cmd-log');
    // dialog & overlay inner elements
    ['dialog-avatar', 'dialog-name', 'dialog-role', 'dialog-engine', 'map-cards', 'preset-row', 'preset-tip', 'llm-enabled', 'llm-base', 'llm-key', 'llm-model', 'llm-save', 'llm-test', 'voice-toggle', 'ask-send', 'title-player', 'btn-profiles', 'settings-player', 'settings-player-name', 'btn-open-profiles', 'profile-list', 'profile-name', 'profile-avatars', 'profile-colors', 'btn-profile-add', 'btn-profiles-close', 'inv-sub', 'inv-tabs', 'craft-grid', 'craft-out', 'inv-note', 'inv-storage', 'inv-hotbar', 'btn-inv-close', 'pause-sub', 'pm-resume', 'pm-gamemode', 'pm-inventory', 'pm-chatlog', 'pm-players', 'pm-help', 'pm-settings', 'pm-sound', 'pm-edition', 'pm-title', 'chatlog-list', 'btn-chatlog-clear', 'btn-chatlog-close', 'btn-fart', 'offhand-slot', 'btn-gift', 'btn-eat', 'net-enabled', 'net-room', 'net-broker', 'net-save', 'net-status', 'players-list', 'players-room', 'players-status', 'btn-players-invite', 'btn-players-close'].forEach(
      (id) => (this.el[id] = root.querySelector('#' + id) as HTMLElement),
    );

    (q('btn-start') as HTMLButtonElement).onclick = () => hooks.onStart();
    (q('btn-start-llm') as HTMLButtonElement).onclick = () => {
      hooks.onStart();
      this.openSettings();
    };
    (q('btn-close-dialog') as HTMLButtonElement).onclick = () => hooks.onDialogClose();
    (q('ask-send') as HTMLButtonElement).onclick = () => this.submitAsk();
    this.askInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.submitAsk();
    });
    this.askInput.addEventListener('keyup', (e) => e.stopPropagation());
    (q('btn-map-close') as HTMLButtonElement).onclick = () => this.closeOverlay('map');
    (q('btn-settings-close') as HTMLButtonElement).onclick = () => this.closeOverlay('settings');
    (q('btn-help-close') as HTMLButtonElement).onclick = () => this.closeOverlay('help');
    (q('btn-profiles') as HTMLButtonElement).onclick = () => this.openProfiles();
    (q('btn-open-profiles') as HTMLButtonElement).onclick = () => this.openProfiles();
    (q('btn-profiles-close') as HTMLButtonElement).onclick = () => this.closeOverlay('profiles');
    (q('btn-profile-add') as HTMLButtonElement).onclick = () => this.createProfile();
    (q('sc-next') as HTMLButtonElement).onclick = () => hooks.onDemo('next');
    (q('sc-prev') as HTMLButtonElement).onclick = () => hooks.onDemo('prev');
    (q('sc-skip') as HTMLButtonElement).onclick = () => hooks.onDemo('skip');
    (q('sc-replay') as HTMLButtonElement).onclick = () => hooks.onDemo('replay');
    (q('btn-inv-close') as HTMLButtonElement).onclick = () => this.closeOverlay('inventory');
    (q('btn-chatlog-close') as HTMLButtonElement).onclick = () => this.closeOverlay('chatlog');
    (q('btn-chatlog-clear') as HTMLButtonElement).onclick = () => hooks.onChatlogClear();
    (q('btn-fart') as HTMLButtonElement).onclick = () => hooks.onFart();
    (q('btn-gift') as HTMLButtonElement).onclick = () => hooks.onGift();
    (q('btn-eat') as HTMLButtonElement).onclick = () => hooks.onEat();
    // ── 联机：保存配置 / 在线玩家面板 ──
    (q('net-save') as HTMLButtonElement).onclick = () => {
      hooks.onNetSave(this.readNet());
      this.toast('联机设置已保存', 'good', 2200);
    };
    (q('btn-players-close') as HTMLButtonElement).onclick = () => this.closeOverlay('players');
    (q('btn-players-invite') as HTMLButtonElement).onclick = () => {
      const url = hooks.onNetInfo().invite;
      navigator.clipboard?.writeText(url).then(
        () => this.toast('🔗 邀请链接已复制，发给朋友即可', 'good', 3000),
        () => this.toast('复制失败，请手动复制：' + url, 'warn', 6000),
      );
    };
    (
      [
        ['pm-resume', 'resume'],
        ['pm-gamemode', 'gamemode'],
        ['pm-inventory', 'inventory'],
        ['pm-chatlog', 'chatlog'],
        ['pm-players', 'players'],
        ['pm-help', 'help'],
        ['pm-settings', 'settings'],
        ['pm-sound', 'sound'],
        ['pm-edition', 'edition'],
        ['pm-title', 'title'],
      ] as [string, PauseAction][]
    ).forEach(([id, a]) => {
      (this.el[id] as HTMLButtonElement).onclick = () => hooks.onPause(a);
    });
    // 版本选择
    root.querySelectorAll<HTMLButtonElement>('.edition-btn').forEach((b) => {
      b.onclick = () => {
        root.querySelectorAll('.edition-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        hooks.onEdition(b.dataset.ed as 'java' | 'bedrock');
      };
    });

    this.cmdInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.submitCommand();
      else if (e.key === 'Escape') {
        e.preventDefault();
        this.hooks.onConsoleClose();
      }
    });
    this.cmdInput.addEventListener('keyup', (e) => e.stopPropagation());

    // ✕ 关闭 / 发送按钮（手机上没有 ESC 键，必须给可点的按钮）
    (q('cmd-close') as HTMLButtonElement).onclick = () => this.hooks.onConsoleClose();
    (q('cmd-send') as HTMLButtonElement).onclick = () => this.submitCommand();
    // 焦点不在输入框时（比如点了日志区），按 ESC 也要能关
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.isConsoleOpen()) return;
      if (document.activeElement === this.cmdInput) return; // 输入框自己会处理
      this.hooks.onConsoleClose();
    });

    // 物品栏：一个事件委托搞定所有格子
    this.el['overlay-inventory'].addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('.inv-slot') as HTMLElement | null;
      if (!el) return;
      const t = el.dataset.t as InvTarget;
      if (!t) return;
      hooks.onInvClick(t, Number(el.dataset.i ?? 0));
    });
    (this.el['inv-tabs'] as HTMLElement).addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('.tbtn-tab') as HTMLElement | null;
      if (!b || !b.dataset.tab) return;
      hooks.onInvTab(b.dataset.tab as Tab);
    });
    document.addEventListener('mousemove', (e) => {
      const c = this.el['overlay-inventory'].querySelector('#inv-cursor') as HTMLElement | null;
      if (!c) return;
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
    });

    this.buildSettings();
  }

  // ───────── basic display ─────────
  loadingDone(): void {
    this.el['loading'].classList.add('hide');
  }

  showTitle(): void {
    this.el['title-screen'].classList.remove('hide');
  }

  hideTitle(): void {
    this.el['title-screen'].classList.add('hide');
  }

  toast(msg: string, kind: 'info' | 'good' | 'warn' = 'info', ms = 3200): void {
    const d = document.createElement('div');
    d.className = 'toast-item panel' + (kind === 'good' ? ' good' : kind === 'warn' ? ' warn' : '');
    d.textContent = msg;
    this.el['toast'].appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  /** /title 用的居中大字横幅 */
  bigTitle(text: string): void {
    const el = this.el['cmd-title'];
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the animation
    el.classList.add('show');
    clearTimeout(this.titleTimer);
    this.titleTimer = window.setTimeout(() => el.classList.remove('show'), 2800);
  }

  setScene(scene: SceneDef, badges: number): void {
    const p = this.playerMeta
      ? `<span class="player-chip" id="topbar-player"><span class="pavatar sm" style="background:${this.playerMeta.color}">${this.playerMeta.avatar}</span><span class="pname">${escapeHtml(this.playerMeta.name)}</span></span>`
      : '';
    this.el['topbar'].innerHTML = `${p}<span class="scene-name">${scene.icon} ${scene.name}</span><span class="dot"></span><span>${scene.subtitle}</span><span class="dot"></span>Badges <span class="bad">${badges}</span>`;
  }

  hint(html: string | null): void {
    const h = this.el['hint'];
    if (!html) {
      h.classList.remove('show');
      return;
    }
    h.innerHTML = html;
    h.classList.add('show');
  }

  // ───────── hotbar ─────────
  // ───────── command console ─────────
  openConsole(): void {
    this.el['cmd-console'].classList.add('show');
    this.cmdLog.innerHTML = '';
    const touch = document.body.classList.contains('touch-mode');
    this.consolePrint('命令台已打开：输入 /help 查看全部指令。', 'sys');
    this.consolePrint(
      touch ? '关闭：点右上角 ✕。不带 / 的发言会广播给在线玩家。' : '关闭：按 ESC，或点右上角 ✕。',
      'sys',
    );
    // iOS 坑：pointerdown 里调用 focus() 不会弹软键盘，
    // 必须在 click / pointerup 手势里再 focus 一次。
    const focusNow = () => this.cmdInput.focus({ preventScroll: true });
    focusNow();
    setTimeout(focusNow, 60);
    const retry = () => {
      focusNow();
      window.removeEventListener('pointerup', retry);
      window.removeEventListener('click', retry);
      window.removeEventListener('touchend', retry);
    };
    window.addEventListener('pointerup', retry, { once: true });
    window.addEventListener('click', retry, { once: true });
    window.addEventListener('touchend', retry, { once: true });
  }

  closeConsole(): void {
    this.el['cmd-console'].classList.remove('show');
    this.cmdInput.blur();
  }

  isConsoleOpen(): boolean {
    return this.el['cmd-console'].classList.contains('show');
  }

  consolePrint(text: string, kind: 'cmd' | 'ok' | 'err' | 'sys' | 'me' = 'sys'): void {
    const d = document.createElement('div');
    d.className = 'cmd-line ' + kind;
    d.textContent = text;
    this.cmdLog.appendChild(d);
    this.cmdLog.scrollTop = this.cmdLog.scrollHeight;
  }

  private submitCommand(): void {
    const v = this.cmdInput.value.trim();
    this.cmdInput.value = '';
    if (!v) return;
    this.consolePrint('> ' + v, 'cmd');
    this.hooks.onCommand(v);
    // 点了「发送」按钮后焦点会跑到按钮上，键盘可能收起——拉回来
    this.cmdInput.focus({ preventScroll: true });
  }

  private paintTile(cv: HTMLCanvasElement, tileKey: string): void {
    const atlas = atlasCanvas();
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    if (!atlas) {
      ctx.fillStyle = '#888';
      ctx.fillRect(0, 0, 32, 32);
      return;
    }
    const id = tileIdOf(tileKey);
    const col = id % 8;
    const row = Math.floor(id / 8);
    ctx.drawImage(atlas, col * TILE, row * TILE, TILE, TILE, 0, 0, 32, 32);
  }

  setHotbarIndex(i: number): void {
    [...this.el['hotbar'].children].forEach((c, idx) => c.classList.toggle('active', idx === i));
  }

  // ───────── dialog ─────────
  openDialog(npcId: string): void {
    const p = PERSONALITIES.find((x) => x.id === npcId);
    if (!p) return;
    this.currentNpcId = npcId;
    this.el['dialog'].classList.add('show');
    (this.el['dialog-avatar'] as HTMLElement).textContent = p.emoji;
    (this.el['dialog-name'] as HTMLElement).textContent = p.name;
    (this.el['dialog-role'] as HTMLElement).textContent = p.role;
    this.el['chat'].innerHTML = '';
    this.lastBubble = null;
    this.renderChips(npcId);
    // 同步 focus：手机端只有在点击手势内调用，软键盘才会弹出来；延迟那次只是兜底
    this.askInput.focus({ preventScroll: true });
    setTimeout(() => this.askInput.focus({ preventScroll: true }), 60);
  }

  closeDialog(): void {
    this.el['dialog'].classList.remove('show');
    this.currentNpcId = null;
    this.lastBubble = null;
  }

  setEngineTag(text: string, warn = false): void {
    const t = this.el['dialog-engine'];
    t.textContent = text;
    t.style.color = warn ? 'var(--warn)' : 'var(--muted)';
  }

  bubble(role: 'npc' | 'me' | 'sys', text: string): HTMLElement {
    const d = document.createElement('div');
    d.className = 'bubble ' + role;
    d.textContent = text;
    this.el['chat'].appendChild(d);
    this.scrollChat();
    if (role === 'npc') this.lastBubble = d;
    return d;
  }

  updateBubble(el: HTMLElement, text: string): void {
    el.textContent = text;
    this.scrollChat();
  }

  busy(v: boolean): void {
    this.askInput.disabled = v;
    (this.el['ask-send'] as HTMLButtonElement).textContent = v ? '…' : 'Send';
  }

  private scrollChat(): void {
    const c = this.el['chat'];
    c.scrollTop = c.scrollHeight;
  }

  private submitAsk(): void {
    const v = this.askInput.value.trim();
    if (!v) return;
    this.askInput.value = '';
    this.hooks.onAsk(v);
  }

  private renderChips(npcId: string): void {
    const p = PERSONALITIES.find((x) => x.id === npcId);
    this.chipsHost.innerHTML = '';
    if (!p) return;
    const pool: Record<string, string[]> = {
      stone_pine: ['Why do plants flower?', 'What are leaves for?', 'What does a seed need to sprout?', 'Why are there four seasons?'],
      ling: ['How does a caterpillar become a butterfly?', 'Is a spider an insect?', 'How do animals survive winter?', 'Are all bacteria bad?'],
      lu_ming: ['What is a food chain?', 'What happens if we cut down forests?', 'How do animals protect themselves?', 'How are rocks and soil related?'],
      xiao_man: ['What does a seed need to sprout?', 'What do plants need to grow?', 'Why run comparison experiments?', 'Why do roots grow downward?'],
      lan_po: ['How does the water cycle work?', 'How do clouds form?', 'Why does it rain?', 'What forms can water take?'],
      pao: ['Where does salt go in water?', 'Why can an iron ship float?', 'Does air have weight?', 'Why does ice float?'],
      pick: ['What kinds of rocks are there?', 'How do fossils form?', 'What do we do in an earthquake?', 'How can you tell a rock\'s hardness?'],
      vein: ['How do you measure accurately?', 'What differs between materials?', 'What can fossils tell us?', 'What should we watch for in experiments?'],
      star_see: ['Why does the Moon change shape?', 'How many planets are in the solar system?', 'Why do stars twinkle?', 'How does a solar eclipse happen?'],
      compass: ['Why is there day and night?', 'How do the seasons come about?', 'How do you count stars accurately?', 'How many times does the Moon change a month?'],
      quark: ['Why does a lamp light up?', 'How do you tell conductors from insulators?', 'Why can a magnet attract iron?', 'Where does electricity come from?'],
      ember: ['What three things does fire need?', 'Is rusting a chemical change?', 'What are ways to put out a fire?', 'How does heat travel?'],
      archie: ['Why does a lever save effort?', 'What is friction good for?', 'Why do things fall down?', 'What is an inclined plane good for?'],
    };
    const list = pool[p.id] ?? ['Hi there', 'Tell me about your favorite topic'];
    for (const txt of list) {
      const c = document.createElement('div');
      c.className = 'chip';
      c.textContent = txt;
      c.onclick = () => this.hooks.onAsk(txt);
      this.chipsHost.appendChild(c);
    }
  }

  // ───────── quests ─────────
  renderQuests(sceneId: string, progress: Progress): void {
    const list = questsOf(sceneId);
    const rows = list
      .map((q: Quest) => {
        const v = Math.min(q.need, progress[q.kind][q.id] ?? 0);
        const done = v >= q.need;
        const left = `${q.need > 1 ? `(${v}/${q.need})` : ''}`;
        return `<div class="q ${done ? 'done' : ''}"><span>${done ? '✅' : q.icon}</span><span>${q.title} ${left}</span></div>`;
      })
      .join('');
    this.el['quests'].innerHTML = `<h3>🎯 Explore this stop <span style="font-size:11px;color:var(--muted)">M Map · O Settings</span></h3>${rows}<div class="meta">Talking, watching demos, and building all make progress. Finish them all to earn this scene's badge.</div>`;
  }

  // ───────── HUD：生命 / 饥饿 / 调试屏 / 好友 ─────────
  private lastStats = '';
  setStats(health: number, maxHealth: number, hunger: number): void {
    const key = `${Math.round(health)}|${Math.round(hunger)}`;
    if (key === this.lastStats) return;
    this.lastStats = key;
    const hearts = 10;
    const v = (health / maxHealth) * hearts;
    let a = '';
    for (let i = 0; i < hearts; i++) a += i + 1 <= v ? '❤️' : i + 0.5 <= v ? '💗' : '🖤';
    this.el['hearts'].textContent = a;
    const f = (hunger / 100) * hearts;
    let b = '';
    for (let i = 0; i < hearts; i++) b += i + 1 <= f ? '🍗' : '🥄';
    this.el['hunger'].textContent = b;
  }

  setF3(show: boolean, text: string): void {
    this.el['f3'].classList.toggle('show', show);
    if (show) this.el['f3'].innerHTML = text;
  }

  setFriends(list: { emoji: string; name: string; hearts: number }[]): void {
    if (!list.length) {
      this.el['friend-bar'].innerHTML = '';
      return;
    }
    this.el['friend-bar'].innerHTML = list
      .map(
        (f) =>
          `<div class="friend"><span>${f.emoji}</span><small>${escapeHtml(f.name)}</small><b>${'💛'.repeat(
            Math.max(0, Math.min(3, f.hearts)),
          )}</b></div>`,
      )
      .join('');
  }

  // ───────── 背包与合成 ─────────
  private itemIcon(key: string): HTMLElement {
    const it = item(key);
    const d = document.createElement('div');
    d.className = 'ic';
    if (it.block !== undefined) {
      const def = blockDef(it.block);
      const tileKey = typeof def.tiles === 'string' ? def.tiles : def.tiles.side;
      const cv = document.createElement('canvas');
      cv.width = 32;
      cv.height = 32;
      this.paintTile(cv, tileKey);
      d.appendChild(cv);
    } else {
      d.textContent = it.icon;
      d.classList.add('emoji');
    }
    return d;
  }

  private paintSlot(host: HTMLElement, slot: Slot | null, target: InvTarget, index: number): void {
    host.className = 'inv-slot' + (target === 'out' || target === 'fout' ? ' out' : '');
    host.dataset.t = target;
    host.dataset.i = String(index);
    host.innerHTML = '';
    if (!slot) return;
    const it = item(slot.key);
    host.appendChild(this.itemIcon(slot.key));
    if (slot.count > 1) {
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = String(slot.count);
      host.appendChild(n);
    }
    host.title = `${it.name} · ${it.cn}`;
  }

  private gridEl(cols: number): HTMLDivElement {
    const g = document.createElement('div');
    g.className = 'inv-grid';
    g.style.setProperty('--cols', String(cols));
    return g;
  }

  renderInventory(inv: Inventory, creative: boolean): void {
    this.invTab = inv.tab;
    const tabs = this.el['inv-tabs'];
    tabs.querySelectorAll<HTMLElement>('.tbtn-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === inv.tab));

    // 合成区
    const cg = this.el['craft-grid'];
    cg.innerHTML = '';
    const size = inv.tab === 'craft' ? 3 : inv.tab === 'bag' ? 2 : 1;
    cg.style.setProperty('--cols', String(size));
    const ids = inv.tab === 'craft' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : inv.tab === 'bag' ? [0, 1, 3, 4] : [0];
    ids.forEach((i) => {
      const s = document.createElement('div');
      const src = inv.tab === 'furnace' ? inv.furnaceIn : inv.craft[i];
      this.paintSlot(s, src, inv.tab === 'furnace' ? 'fin' : 'craft', i);
      cg.appendChild(s);
    });
    const outTarget: InvTarget = inv.tab === 'furnace' ? 'fout' : 'out';
    this.paintSlot(this.el['craft-out'], inv.craftResult, outTarget, 0);
    this.paintSlot(this.el['offhand-slot'], inv.offhand, 'offhand', 0);

    const note =
      inv.tab === 'furnace'
        ? '🔥 Put something in → click the result. Iron ore → iron ingot, sand → glass, wheat → bread.'
        : inv.tab === 'craft'
          ? '🪚 3×3 crafting — stand near a crafting table. Move things in, then click the result.'
          : '🎒 2×2 crafting — planks, sticks, torches and a crafting table can all be made right here.';
    this.el['inv-note'].textContent = note;

    // 储物 / 创造模式物品栏
    const st = this.el['inv-storage'];
    st.innerHTML = '';
    if (creative) {
      const row = document.createElement('div');
      row.className = 'inv-subrow';
      const mk = (label: string, on: boolean, cb: () => void) => {
        const b = document.createElement('button');
        b.className = 'tbtn-tab' + (on ? ' active' : '');
        b.textContent = label;
        b.onclick = cb;
        return b;
      };
      const showPalette = this.palette !== null;
      row.appendChild(mk('🎒 Bag', !showPalette, () => (this.palette = null)));
      row.appendChild(mk('📚 All blocks', showPalette, () => (this.palette = this.paletteKeys())));
      st.appendChild(row);
    }
    const grid = this.gridEl(9);
    if (this.palette) {
      this.palette.forEach((k, i) => {
        const s = document.createElement('div');
        this.paintSlot(s, { key: k, count: 1 }, 'palette', i);
        grid.appendChild(s);
      });
    } else {
      for (let i = 9; i < 36; i++) {
        const s = document.createElement('div');
        this.paintSlot(s, inv.slots[i], 'storage', i);
        grid.appendChild(s);
      }
    }
    st.appendChild(grid);

    // 快捷栏
    const hb = this.el['inv-hotbar'];
    hb.innerHTML = '';
    hb.style.setProperty('--cols', '9');
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      this.paintSlot(s, inv.slots[i], 'hotbar', i);
      s.classList.toggle('sel', i === this.selSlot);
      hb.appendChild(s);
    }

    // 手上拿的东西（跟随鼠标）
    this.renderCursor(inv.cursor);
  }

  private paletteKeys(): string[] {
    return blockItems().map((i) => i.key);
  }

  private renderCursor(slot: Slot | null): void {
    const host = this.el['overlay-inventory'];
    const old = host.querySelector('#inv-cursor');
    if (old) old.remove();
    if (!slot) return;
    const c = document.createElement('div');
    c.id = 'inv-cursor';
    c.appendChild(this.itemIcon(slot.key));
    if (slot.count > 1) {
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = String(slot.count);
      c.appendChild(n);
    }
    host.appendChild(c);
  }

  renderHotbar(inv: Inventory, sel: number): void {
    const host = this.el['hotbar'];
    host.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === sel ? ' active' : '');
      const s = inv.slots[i];
      if (s) {
        slot.appendChild(this.itemIcon(s.key));
        const it = item(s.key);
        slot.title = `${it.name} · ${it.cn}`;
        if (s.count > 1) {
          const n = document.createElement('span');
          n.className = 'n';
          n.textContent = String(s.count);
          slot.appendChild(n);
        }
      } else {
        slot.classList.add('empty');
      }
      const lb = document.createElement('span');
      lb.className = 'num';
      lb.textContent = String(i + 1);
      slot.appendChild(lb);
      slot.onclick = () => this.hooks.onHotbar(i);
      host.appendChild(slot);
    }
  }

  // ───────── 暂停菜单 ─────────
  openPause(): void {
    this.openOverlay('pause');
  }
  setPauseLabels(o: { mode: string; edition: string; sound: boolean; scene: string; player: string }): void {
    this.el['pm-gamemode'].textContent = `🎮 Game Mode: ${o.mode}`;
    this.el['pm-edition'].textContent = `🖥️ Edition: ${o.edition}`;
    this.el['pm-sound'].textContent = o.sound ? '🔊 Sound: On' : '🔇 Sound: Off';
    this.el['pause-sub'].textContent = `${o.player} · ${o.scene}`;
  }

  // ───────── 聊天记录 ─────────
  renderChatLog(entries: { emoji: string; who: string; text: string; me: boolean; at: string }[]): void {
    const host = this.el['chatlog-list'];
    if (!entries.length) {
      host.innerHTML = '<div class="empty-log">No conversations yet. Walk up to a resident and press E to chat!</div>';
      return;
    }
    host.innerHTML = entries
      .slice(-200)
      .reverse()
      .map(
        (e) =>
          `<div class="log-row ${e.me ? 'me' : ''}"><span class="who">${e.emoji} ${escapeHtml(e.who)}</span><span class="tx">${escapeHtml(
            e.text,
          )}</span><span class="at">${escapeHtml(e.at)}</span></div>`,
      )
      .join('');
  }

  // ───────── overlays ─────────
  openOverlay(which: Overlay): void {
    this.el[`overlay-${which}`].classList.add('show');
  }
  closeOverlay(which: Overlay): void {
    this.el[`overlay-${which}`].classList.remove('show');
    this.askInput?.focus?.();
  }
  isOverlayOpen(which: Overlay): boolean {
    return this.el[`overlay-${which}`].classList.contains('show');
  }
  /** 有任何面板打开时应该冻结玩家操作（触屏版没有指针锁定，必须靠这个） */
  anyOverlayOpen(): boolean {
    for (const w of ['map', 'settings', 'help', 'profiles', 'inventory', 'pause', 'chatlog', 'players'] as Overlay[]) {
      if (this.el[`overlay-${w}`].classList.contains('show')) return true;
    }
    return false;
  }
  closeAllOverlays(): void {
    for (const w of ['map', 'settings', 'help', 'profiles', 'inventory', 'pause', 'chatlog', 'players'] as Overlay[]) {
      this.el[`overlay-${w}`].classList.remove('show');
    }
  }
  openSettings(): void {
    this.fillSettings(loadLLMConfig());
    if (this.playerMeta) this.setSettingsPlayer(this.playerMeta);
    this.openOverlay('settings');
  }
  toggleOverlay(which: Overlay): void {
    const e = this.el[`overlay-${which}`];
    e.classList.toggle('show');
  }

  renderMap(scenes: SceneDef[], current: string, progress: Progress, doneScenes: Set<string>): void {
    const cards = scenes
      .map((s) => {
        const q = questsOf(s.id);
        const done = q.filter((x) => (progress[x.kind][x.id] ?? 0) >= x.need).length;
        const cur = s.id === current ? ' current' : '';
        const reward = doneScenes.has(s.id) ? '🏅 Badge earned' : `${done}/${q.length} done`;
        return `<div class="card${cur}" data-scene="${s.id}"><div class="ic">${s.icon}</div><b>${s.name}</b><small>${s.brief}</small><div class="progress">${reward}</div></div>`;
      })
      .join('');
    this.el['map-cards'].innerHTML = cards;
    this.el['map-cards']
      .querySelectorAll('.card')
      .forEach((c) =>
        c.addEventListener('click', () => {
          const id = (c as HTMLElement).dataset.scene!;
          this.closeOverlay('map');
          this.hooks.onGotoScene(id);
        }),
      );
  }

  private buildSettings(): void {
    const host = this.el['preset-row'];
    host.innerHTML = PRESETS.map(
      (p, i) => `<div class="chip" data-i="${i}">${p.name}</div>`,
    ).join('');
    host.querySelectorAll('.chip').forEach((c) =>
      c.addEventListener('click', () => {
        const p = PRESETS[Number((c as HTMLElement).dataset.i)];
        (this.el['llm-base'] as HTMLInputElement).value = p.baseUrl;
        (this.el['llm-model'] as HTMLInputElement).value = p.model;
        this.toast(`Filled in ${p.name}'s address — you still need an API Key`, 'info');
        (this.el['preset-tip'] as HTMLElement).textContent = p.tip;
      }),
    );
    (this.el['llm-save'] as HTMLButtonElement).onclick = () => this.saveSettings(false);
    (this.el['llm-test'] as HTMLButtonElement).onclick = () => this.saveSettings(true);
    (this.el['voice-toggle'] as HTMLButtonElement).onclick = () => {
      const nv = !speechEnabled();
      this.hooks.onSpeech(nv);
      setSpeechEnabled(nv);
      this.syncVoice();
      this.toast(nv ? 'NPC voice reading enabled' : 'Voice reading disabled');
    };
    this.syncVoice();
    this.buildProfilePicker();
  }

  private syncVoice(): void {
    (this.el['voice-toggle'] as HTMLButtonElement).textContent = speechEnabled() ? '🔊 Voice: On' : '🔇 Voice: Off';
  }

  /** Re-sync the voice button label after a profile switch. */
  refreshVoice(): void {
    this.syncVoice();
  }

  private readCfg(): LLMConfig {
    const enabled = (this.el['llm-enabled'] as HTMLInputElement).checked;
    return {
      enabled,
      baseUrl: (this.el['llm-base'] as HTMLInputElement).value.trim(),
      apiKey: (this.el['llm-key'] as HTMLInputElement).value.trim(),
      model: (this.el['llm-model'] as HTMLInputElement).value.trim(),
    };
  }

  fillSettings(cfg: LLMConfig): void {
    (this.el['llm-enabled'] as HTMLInputElement).checked = cfg.enabled;
    (this.el['llm-base'] as HTMLInputElement).value = cfg.baseUrl;
    (this.el['llm-key'] as HTMLInputElement).value = cfg.apiKey;
    (this.el['llm-model'] as HTMLInputElement).value = cfg.model;
    this.fillNet();
  }

  // ───────── 多人联机 UI ─────────
  private readNet(): NetConfig {
    return {
      enabled: (this.el['net-enabled'] as HTMLInputElement).checked,
      room: (this.el['net-room'] as HTMLInputElement).value.trim() || 'main',
      broker: (this.el['net-broker'] as HTMLInputElement).value.trim() || DEFAULT_BROKER,
    };
  }

  fillNet(): void {
    const info = this.hooks.onNetInfo();
    (this.el['net-enabled'] as HTMLInputElement).checked = info.enabled;
    (this.el['net-room'] as HTMLInputElement).value = info.room;
    (this.el['net-broker'] as HTMLInputElement).value = info.broker;
    this.setNetStatus(info.status, info.room, info.players.length);
  }

  private netLast: { status: NetStatus; room: string; online: number } = { status: 'off', room: 'main', online: 0 };

  setNetStatus(s: NetStatus, room: string, online: number): void {
    this.netLast = { status: s, room, online };
    this.paintNet();
  }

  setOnline(n: number): void {
    this.netLast = { ...this.netLast, online: n };
    this.paintNet();
  }

  private paintNet(): void {
    const { status, room, online } = this.netLast;
    const label =
      status === 'online' ? '🟢 已联机' : status === 'connecting' ? '🟡 连接中' : status === 'error' ? '🔴 连接失败' : '⚪ 未联机';
    const chip = this.el['net-chip'];
    if (chip) {
      chip.innerHTML = `<span class="ncdot ${status}"></span>${label} · 房间「${escapeHtml(room)}」 · <b>${online}</b> 人在线`;
    }
    const st = this.el['net-status'];
    if (st) st.textContent = `${label} · ${online} 人在线`;
  }

  /** 远程聊天：左下浮动一行（9 秒后消失），最多留 5 行 */
  netChatLine(m: ChatMsg): void {
    const feed = this.el['chatfeed'];
    if (!feed) return;
    const d = document.createElement('div');
    d.className = 'feed-line';
    d.innerHTML = `<span class="pavatar sm" style="background:${m.color}">${m.avatar}</span><b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.text)}</span>`;
    feed.appendChild(d);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild as HTMLElement);
    setTimeout(() => d.remove(), 9000);
  }

  openPlayers(): void {
    this.renderNetPlayers(this.hooks.onNetInfo());
    this.openOverlay('players');
  }

  renderNetPlayers(info: {
    enabled: boolean;
    status: NetStatus;
    room: string;
    broker: string;
    players: PlayerState[];
    invite: string;
  }): void {
    this.el['players-room'].textContent = `房间「${info.room}」 · ${info.broker}`;
    const label =
      info.status === 'online'
        ? '🟢 已联机'
        : info.status === 'connecting'
          ? '🟡 连接中'
          : info.status === 'error'
            ? '🔴 连接失败（重试中）'
            : info.enabled
              ? '⚪ 未连接'
              : '⚪ 联机已关闭';
    this.el['players-status'].textContent = label;
    const host = this.el['players-list'];
    const rows = info.players.map((p) => {
      const sc = SCENES.find((s) => s.id === p.scene);
      const where = p.scene === SCENES[0]?.id ? '' : '';
      return `<div class="profile-row">
        <span class="pavatar" style="background:${p.color}">${p.avatar}</span>
        <span class="pname">${escapeHtml(p.name)}${where}</span>
        <span class="pactions"><span class="pcur">${sc ? sc.icon + ' ' + sc.name : p.scene}</span></span>
      </div>`;
    });
    host.innerHTML = rows.length
      ? rows.join('')
      : '<div class="empty-log">房间里目前只有你一个人。点「复制邀请链接」发给朋友，或换个大一点的房间名。</div>';
  }

  private async saveSettings(test: boolean): Promise<void> {
    const cfg = this.readCfg();
    this.hooks.onSettingSave(cfg);
    if (!test) {
      this.toast(cfg.enabled && cfg.apiKey ? 'Saved — NPCs are now driven by the LLM' : 'Saved — NPCs use the local personality engine', 'good');
      this.closeOverlay('settings');
      return;
    }
    const btn = this.el['llm-test'] as HTMLButtonElement;
    btn.textContent = 'Testing…';
    const msg = await this.hooks.onTestLLM(cfg);
    btn.textContent = 'Test connection';
    const ok = msg.includes('success');
    this.toast(msg, ok ? 'good' : 'warn', 6000);
  }

  // ───────── player / user system ─────────
  setTitlePlayer(meta: ProfileMeta): void {
    this.playerMeta = meta;
    const el = this.el['title-player'];
    if (el) el.innerHTML = `<span class="pavatar" style="background:${meta.color}">${meta.avatar}</span><span class="pname">${escapeHtml(meta.name)}</span>`;
  }

  setPlayer(meta: ProfileMeta): void {
    this.playerMeta = meta;
    const el = this.el['topbar-player'];
    if (el) el.innerHTML = `<span class="pavatar sm" style="background:${meta.color}">${meta.avatar}</span><span class="pname">${escapeHtml(meta.name)}</span>`;
  }

  setSettingsPlayer(meta: ProfileMeta): void {
    const av = this.el['settings-player'] as HTMLElement;
    const nm = this.el['settings-player-name'] as HTMLElement;
    if (av) av.innerHTML = `<span class="pavatar" style="background:${meta.color}">${meta.avatar}</span>`;
    if (nm) nm.textContent = meta.name;
  }

  private buildProfilePicker(): void {
    const avatars = ['🧑‍🚀', '🦊', '🐱', '🐰', '🐼', '🐯', '🦁', '🐸', '🦉', '🤖', '👧', '👦', '🧒'];
    const colors = ['#5ad1c9', '#ff8da1', '#ffd166', '#8ab4ff', '#b692ff', '#7ee787', '#ff9f6e', '#6ee7ff'];
    const ah = this.el['profile-avatars'];
    if (ah) {
      ah.innerHTML = avatars
        .map((a, i) => `<div class="pick ${i === 0 ? 'on' : ''}" data-av="${a}">${a}</div>`)
        .join('');
      ah.querySelectorAll('.pick').forEach((c) =>
        c.addEventListener('click', () => {
          this.selAvatar = (c as HTMLElement).dataset.av!;
          ah.querySelectorAll('.pick').forEach((x) => x.classList.remove('on'));
          c.classList.add('on');
        }),
      );
    }
    const ch = this.el['profile-colors'];
    if (ch) {
      ch.innerHTML = colors
        .map((c, i) => `<div class="pick" data-co="${c}" style="background:${c}${i === 0 ? ';outline:2px solid #fff' : ''}"></div>`)
        .join('');
      ch.querySelectorAll('.pick').forEach((c) =>
        c.addEventListener('click', () => {
          this.selColor = (c as HTMLElement).dataset.co!;
          ch.querySelectorAll('.pick').forEach((x) => ((x as HTMLElement).style.outline = 'none'));
          (c as HTMLElement).style.outline = '2px solid #fff';
        }),
      );
    }
  }

  private createProfile(): void {
    const name = ((this.el['profile-name'] as HTMLInputElement).value || '').trim();
    this.hooks.onCreateProfile(name, this.selAvatar, this.selColor);
    (this.el['profile-name'] as HTMLInputElement).value = '';
  }

  openProfiles(): void {
    this.renderProfiles();
    this.openOverlay('profiles');
  }

  renderProfiles(): void {
    const { list, activeId } = this.hooks.onProfiles();
    const host = this.el['profile-list'];
    if (!host) return;
    host.innerHTML = list
      .map(
        (m) => `<div class="profile-row${m.id === activeId ? ' active' : ''}">
          <span class="pavatar" style="background:${m.color}">${m.avatar}</span>
          <span class="pname">${escapeHtml(m.name)}</span>
          <span class="pactions">
            ${m.id === activeId ? '<span class="pcur">当前</span>' : `<button class="ghost pswitch" data-id="${m.id}">切换</button>`}
            ${list.length > 1 ? `<button class="ghost pdel" data-id="${m.id}">删除</button>` : ''}
          </span>
        </div>`,
      )
      .join('');
    host.querySelectorAll('.pswitch').forEach((b) =>
      b.addEventListener('click', () => this.hooks.onSwitchProfile((b as HTMLElement).dataset.id!)),
    );
    host.querySelectorAll('.pdel').forEach((b) =>
      b.addEventListener('click', () => {
        if (confirm('Delete this player and all their progress? This cannot be undone.')) {
          this.hooks.onDeleteProfile((b as HTMLElement).dataset.id!);
        }
      }),
    );
  }

  // ───────── demo player ─────────
  showcaseShow(v: boolean): void {
    this.el['showcase'].classList.toggle('show', v);
  }

  showcaseFrame(info: { title: string; step: number; steps: number; text: string; progress: number }): void {
    this.el['sc-top'].textContent = info.title;
    this.el['sc-sub'].textContent = info.text;
    (this.el['sc-bar'] as HTMLElement).style.width = `${info.progress * 100}%`;
    (this.el['sc-step'] as HTMLElement).textContent = `${info.step + 1} / ${info.steps}`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

export const HOTBAR = [
  { id: blocks.grass, tile: 'grass_top' },
  { id: blocks.plank, tile: 'plank' },
  { id: blocks.stoneBrick, tile: 'stone_brick' },
  { id: blocks.brick, tile: 'brick' },
  { id: blocks.glass, tile: 'glass' },
  { id: blocks.lamp, tile: 'lamp' },
  { id: blocks.leaves, tile: 'leaves' },
  { id: blocks.woolRed, tile: 'wool_red' },
  { id: blocks.woolBlue, tile: 'wool_blue' },
  { id: blocks.woolYellow, tile: 'wool_yellow' },
];

const TEMPLATE = `
<div id="crosshair"></div>

<div id="topbar" class="panel"></div>

<div id="net-chip" class="panel"></div>

<div id="cmd-title"></div>

<div id="toast"></div>

<div id="hint"></div>

<div id="chatfeed"></div>

<div id="hotbar" class="panel"></div>

<div id="hud-hearts">
  <div id="hearts"></div>
  <div id="hunger"></div>
</div>

<button id="btn-fart" title="Fart (G)">💨</button>

<div id="friend-bar"></div>
<div id="f3"></div>

<div id="quests" class="panel"></div>

<div id="dialog" class="panel">
  <header>
    <div class="avatar" id="dialog-avatar">🙂</div>
    <div class="who">
      <b id="dialog-name">NPC</b>
      <small id="dialog-role"></small>
    </div>
    <div class="engine" id="dialog-engine">Local engine</div>
    <button id="btn-close-dialog" class="ghost">✕</button>
  </header>
  <div id="chat"></div>
  <div id="quick"></div>
  <div id="ask-row">
    <input id="ask-input" placeholder="Ask anything… (Enter to send)" autocomplete="off" />
    <button id="btn-gift" title="Give them what you are holding">🎁</button>
    <button id="ask-send" class="primary">Send</button>
  </div>
</div>

<div class="overlay" id="overlay-map">
  <div class="sheet panel">
    <h2>🗺️ BlockAcademy Map</h2>
    <div class="sub">Different residents live in each place, teaching different subjects. Teleport over anytime.</div>
    <div class="grid" id="map-cards"></div>
    <div class="row" style="justify-content:flex-end;margin-top:18px">
      <button id="btn-map-close" class="ghost">Close (M)</button>
    </div>
  </div>
</div>

<div class="overlay" id="overlay-settings">
  <div class="sheet panel">
    <h2>⚙️ Settings</h2>
    <div class="sub">You can play without filling anything: NPCs answer with the local personality engine. Add an API Key and NPCs are driven by a real LLM for freer answers.</div>

    <div class="panel" style="padding:12px 14px;margin-bottom:16px;background:rgba(30,40,62,0.6)">
      <div class="row" style="align-items:center;gap:10px">
        <span id="settings-player"></span>
        <b id="settings-player-name" style="font-size:14px"></b>
        <button id="btn-open-profiles" class="ghost" style="margin-left:auto">👥 Switch player</button>
      </div>
    </div>

    <div class="panel" style="padding:14px;margin-bottom:16px;background:rgba(30,40,62,0.6)">
      <label style="display:flex;gap:10px;align-items:center;font-size:14px;margin:0">
        <input type="checkbox" id="llm-enabled" style="width:auto" />
        <span>Enable LLM (off → use local knowledge engine)</span>
      </label>
    </div>

    <div class="field">
      <label>Quick provider presets</label>
      <div class="row" id="preset-row"></div>
      <div class="tip" id="preset-tip">All requests go through a local proxy; your API Key never leaves your computer.</div>
    </div>

    <div class="field">
      <label>API Base URL</label>
      <input id="llm-base" placeholder="https://api.openai.com/v1" />
      <div class="tip">The /v1 suffix is added automatically; you may enter the root domain.</div>
    </div>

    <div class="field">
      <label>API Key</label>
      <input id="llm-key" type="password" placeholder="sk-..." />
    </div>

    <div class="field">
      <label>Model name</label>
      <input id="llm-model" placeholder="gpt-4o-mini" />
      <div class="tip">Tip: use a chat model — reasoning models (e.g. gpt-oss) spend all tokens thinking and may reply empty.</div>
    </div>

    <div class="panel" style="padding:14px;margin:16px 0;background:rgba(30,40,62,0.6)">
      <label style="display:flex;gap:10px;align-items:center;font-size:14px;margin:0 0 10px">
        <input type="checkbox" id="net-enabled" style="width:auto" />
        <span>🌐 Multiplayer (see online players, chat, shared building)</span>
      </label>
      <div class="field" style="margin-bottom:10px">
        <label>Room name (share it with friends — it works like a password)</label>
        <input id="net-room" placeholder="main" maxlength="24" />
      </div>
      <div class="field" style="margin-bottom:10px">
        <label>Broker (MQTT over WSS)</label>
        <input id="net-broker" placeholder="wss://broker.emqx.io:8084/mqtt" />
      </div>
      <div class="row" style="align-items:center;gap:10px">
        <button id="net-save">Save &amp; reconnect</button>
        <span id="net-status" class="tip" style="margin:0">—</span>
      </div>
    </div>

    <div class="row">
      <button id="llm-save" class="primary">Save</button>
      <button id="llm-test">Test connection</button>
      <button id="voice-toggle" class="ghost">🔇 Voice: Off</button>
      <button id="btn-settings-close" class="ghost">Close (O)</button>
    </div>
  </div>
</div>

<div class="overlay" id="overlay-profiles">
  <div class="sheet panel">
    <h2>👥 Players</h2>
    <div class="sub">Each player keeps their own AI settings, voice preference, and learning progress — great for a family or classroom sharing one device.</div>

    <div id="profile-list" class="profile-list"></div>

    <div class="panel" style="padding:14px;margin:16px 0;background:rgba(30,40,62,0.6)">
      <div class="field" style="margin:0">
        <label>Add a new player</label>
        <input id="profile-name" placeholder="Player name (e.g. Xiao Ming)" maxlength="20" />
      </div>
      <div class="field" style="margin:12px 0 6px">
        <label>Pick an avatar</label>
        <div class="row" id="profile-avatars"></div>
      </div>
      <div class="field" style="margin:6px 0 0">
        <label>Pick a color</label>
        <div class="row" id="profile-colors"></div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:8px">
        <button id="btn-profile-add" class="primary">＋ Add player</button>
      </div>
    </div>

    <div class="row" style="justify-content:flex-end">
      <button id="btn-profiles-close" class="ghost">Close (P)</button>
    </div>
  </div>
</div>

<div class="overlay" id="overlay-players">
  <div class="sheet panel">
    <h2>🌐 Online Players</h2>
    <div class="sub" id="players-sub">Multiplayer runs over a public MQTT broker — zero setup. Share the invite link so friends land in the same room.</div>
    <div class="panel" style="padding:12px 14px;margin-bottom:14px;background:rgba(30,40,62,0.6)">
      <div class="row" style="align-items:center;gap:10px;flex-wrap:wrap">
        <span id="players-room" class="tip" style="margin:0">Room —</span>
        <span id="players-status" class="tip" style="margin:0">—</span>
        <button id="btn-players-invite" class="ghost" style="margin-left:auto">🔗 Copy invite link</button>
      </div>
    </div>
    <div id="players-list" class="profile-list"></div>
    <div class="tip" style="margin-top:10px">Chat: open the command console (T / ⌘) and type without a slash — everyone in the room sees it. Blocks you mine or place sync too. <kbd>V</kbd> waves at everyone.</div>
    <div class="row" style="justify-content:flex-end;margin-top:14px">
      <button id="btn-players-close" class="ghost">Close</button>
    </div>
  </div>
</div>

<div class="overlay" id="overlay-inventory">
  <div class="sheet panel">
    <h2>🎒 Inventory &amp; Crafting</h2>
    <div class="sub" id="inv-sub">Punch a tree to get wood → craft planks → craft a crafting table!</div>
    <div class="row" id="inv-tabs">
      <button class="tbtn-tab active" data-tab="bag">🎒 Bag (2×2)</button>
      <button class="tbtn-tab" data-tab="craft">🪚 Table (3×3)</button>
      <button class="tbtn-tab" data-tab="furnace">🔥 Furnace</button>
    </div>
    <div class="inv-wrap">
      <div class="inv-craft">
        <div class="inv-grid" id="craft-grid"></div>
        <div class="inv-arrow">➜</div>
        <div class="inv-slot out" id="craft-out"></div>
        <div class="inv-off">
          <span class="inv-label">🖐 Offhand</span>
          <div class="inv-slot" id="offhand-slot"></div>
        </div>
        <div class="inv-note" id="inv-note"></div>
      </div>
      <div class="inv-storage" id="inv-storage"></div>
    </div>
    <div class="inv-hotbar-row">
      <span class="inv-label">Hotbar</span>
      <div class="inv-grid" id="inv-hotbar"></div>
      <button id="btn-eat" class="tbtn-tab">🍽 Eat</button>
      <button id="btn-inv-close" class="ghost" style="margin-left:auto">Close (E)</button>
    </div>
  </div>
</div>

<div class="overlay" id="overlay-pause">
  <div class="sheet panel narrow">
    <h2>⏸️ Game Menu</h2>
    <div class="sub" id="pause-sub"></div>
    <div class="menu-list">
      <button id="pm-resume" class="primary">▶ Back to Game</button>
      <button id="pm-gamemode">🎮 Game Mode: Creative</button>
      <button id="pm-inventory">🎒 Inventory &amp; Crafting</button>
      <button id="pm-chatlog">💬 Chat Log</button>
      <button id="pm-players">🌐 Online Players</button>
      <button id="pm-help">🎮 How to Play</button>
      <button id="pm-settings">⚙️ Settings</button>
      <button id="pm-sound">🔊 Sound: On</button>
      <button id="pm-edition">🖥️ Edition: JAVA</button>
      <button id="pm-title" class="ghost">🏠 Back to Title</button>
    </div>
  </div>
</div>

<div class="overlay" id="overlay-chatlog">
  <div class="sheet panel">
    <h2>💬 Chat Log</h2>
    <div class="sub">Every conversation you had with the residents is saved for this player.</div>
    <div id="chatlog-list" class="chatlog"></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px">
      <button id="btn-chatlog-clear" class="ghost">🗑 Clear</button>
      <button id="btn-chatlog-close" class="ghost">Close</button>
    </div>
  </div>
</div>

<div class="overlay" id="overlay-help">
  <div class="sheet panel">
    <h2>🎮 How to Play</h2>
    <div class="sub">A science world you can explore and ask questions as you play.</div>
    <div class="grid">
      <div class="card"><div class="ic">⌨️</div><b>Move</b><small>W A S D to walk, Shift to sprint, Space to jump, F to toggle flight</small></div>
      <div class="card"><div class="ic">🖱️</div><b>Look &amp; Act</b><small>Mouse to look, left-click to mine, right-click to place, wheel/number keys to switch blocks</small></div>
      <div class="card"><div class="ic">⌨️</div><b>Touch (BEDROCK)</b><small>Left joystick to walk, drag anywhere to look. Buttons: ⬆ jump · ⛏ mine · 🧱 place · 🪶 fly · ⬇ sneak · 💨 fart · 🎒 bag · 💬 talk (stands next to an NPC) · ⌘ commands · ☰ menu</small></div>
      <div class="card"><div class="ic">💬</div><b>Talk to NPCs</b><small>Walk up and press E to chat, ESC to close; type any science question</small></div>
      <div class="card"><div class="ic">⌘</div><b>Command Console</b><small>Press <kbd>T</kbd> or <kbd>/</kbd> to open. Type a command and press <kbd>Enter</kbd> (or tap 发送). <b>Close it with <kbd>ESC</kbd> or the ✕ button</b> — on touch, use the ⌘ button to open and ✕ to close. Typing <b>without</b> a slash chats to everyone online.</small></div>
      <div class="card"><div class="ic">🌐</div><b>Multiplayer</b><small>Zero setup over a public MQTT broker: you see other players' blocky avatars, chat (console, no slash needed), wave with <kbd>V</kbd>, and every block you mine or place syncs. Pause menu → <b>Online Players</b> shows who is in the room and copies an invite link. Change room/broker in Settings.</small></div>
      <div class="card"><div class="ic">🚪</div><b>Finding the Way Out</b><small>Every teleport pad shoots a tall beam of light with a floating icon — follow the beams. In Dawnlight Village four lit roads lead out through the mountain ring to the pads. Press <kbd>M</kbd> for the map to travel directly.</small></div>
      <div class="card"><div class="ic">🎬</div><b>3D Demo</b><small>Step onto a glowing demo pad and press E for a narrated animation</small></div>
      <div class="card"><div class="ic">🗺️</div><b>Change Scene</b><small>Press M for the map to teleport, or step on a teleport pad</small></div>
      <div class="card"><div class="ic">🎯</div><b>Quests</b><small>Talking, watching demos, and building all advance quests; finish to earn badges</small></div>
      <div class="card"><div class="ic">🎒</div><b>Inventory &amp; Crafting</b><small>Press <kbd>E</kbd> or <kbd>I</kbd>. Punch a tree → planks → sticks → <b>crafting table</b> → tools. 2×2 in your bag, 3×3 at a table, smelting at a furnace.</small></div>
      <div class="card"><div class="ic">🐄</div><b>Animals &amp; Pets</b><small>Cows, pigs, sheep, chickens, dogs, cats and slimes. Feed an animal its favourite food 3 times and it becomes your <b>pet</b> and follows you. Empty hand → collect milk, eggs, wool, leather.</small></div>
      <div class="card"><div class="ic">🤝</div><b>Make Friends</b><small>Talk to a resident and press <kbd>🎁</kbd> to give them what you hold. 3 gifts and they become your best friend — they follow you and even help you build!</small></div>
      <div class="card"><div class="ic">🌙</div><b>Sky</b><small>A sun by day, a moon and stars by night, and drifting clouds. Turn on the day-night cycle with <code>/cycle on</code>; beware the Shadows that come out at night.</small></div>
      <div class="card"><div class="ic">💨</div><b>Fart</b><small>Press <kbd>G</kbd> (or the 💨 button) to let one rip. It even scares the animals.</small></div>
      <div class="card"><div class="ic">👥</div><b>Players</b><small>Press <kbd>P</kbd> to switch player — each keeps their own AI settings, voice, bag, progress and chat log</small></div>
      <div class="card"><div class="ic">📱</div><b>Editions</b><small>Pick <b>JAVA EDITION</b> for keyboard &amp; mouse (with the <kbd>F3</kbd> debug screen), or <b>BEDROCK EDITION</b> for touch controls with a virtual joystick</small></div>
      <div class="card"><div class="ic">⌘</div><b>Minecraft-style commands</b><small>Press <kbd>T</kbd> or <kbd>/</kbd>. Move <code>/tp /teleport /locate /fly</code> · Build <code>/setblock /fill /clone /give /clear</code> · World <code>/gamemode /time /weather /cycle</code> · Chat <code>/say /me /title /tellraw /stopsound</code> · Info <code>/list /seed /summon /mobs /pets</code> · Life <code>/kill /spawnpoint /heal /feed</code>. Coordinates support <code>~</code>. Type <code>/help</code> for all. Close the console with <kbd>ESC</kbd> or ✕.</small></div>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:18px">
      <button id="btn-help-close" class="ghost">Close (H)</button>
    </div>
  </div>
</div>

<div id="showcase">
  <div id="sc-top" class="panel"></div>
  <div id="sc-sub"></div>
  <div id="sc-ctrl">
    <button id="sc-prev" class="ghost">◀ Prev</button>
    <button id="sc-next" class="primary">Next ▶</button>
    <button id="sc-replay">🔁 Replay</button>
    <button id="sc-skip" class="ghost">Skip ESC</button>
  </div>
  <div id="sc-step"></div>
  <div id="sc-bar"></div>
</div>

<div id="title-screen">
  <div>
    <div class="logo">BlockAcademy</div>
    <div class="tag">BlockAcademy · a primary-science world where AI teachers live</div>
    <div class="edition-row">
      <button class="edition-btn active" data-ed="java">
        <b>JAVA EDITION</b>
        <small>⌨️ Keyboard &amp; Mouse</small>
      </button>
      <button class="edition-btn" data-ed="bedrock">
        <b>BEDROCK EDITION</b>
        <small>📱 Touch / Mobile</small>
      </button>
    </div>
    <div id="title-player" class="title-player"></div>
    <div class="row" style="justify-content:center">
      <button id="btn-start" class="primary" style="font-size:16px;padding:12px 32px">▶ Start Exploring</button>
      <button id="btn-start-llm" class="ghost" style="font-size:14px;padding:12px 22px">Connect an LLM</button>
      <button id="btn-profiles" class="ghost" style="font-size:14px;padding:12px 22px">👥 Players</button>
    </div>
    <div class="keys">
      <kbd>W A S D</kbd> Move · <kbd>Space</kbd> Jump · <kbd>F</kbd> Fly · <kbd>L-click</kbd> Mine · <kbd>R-click</kbd> Place<br />
      <kbd>E</kbd> Talk / Inventory · <kbd>I</kbd> Inventory · <kbd>G</kbd> Fart · <kbd>V</kbd> Wave · <kbd>C</kbd> Left hand · <kbd>M</kbd> Map<br />
      <kbd>O</kbd> Settings · <kbd>P</kbd> Players · <kbd>H</kbd> Help · <kbd>T</kbd> Chat &amp; Commands · <kbd>ESC</kbd> Menu · <kbd>F3</kbd> Debug
    </div>
  </div>
</div>

<div id="loading">
  <div style="text-align:center">
    <div class="spinner"></div>
    Generating the blocky world…
  </div>
</div>

<div id="cmd-console">
  <div id="cmd-head">
    <span class="cmd-title">⌘ 命令台</span>
    <span class="cmd-tip">回车发送 · <kbd>ESC</kbd> 或点 ✕ 关闭</span>
    <button id="cmd-close" type="button" title="关闭命令台 (ESC)">✕</button>
  </div>
  <div id="cmd-log"></div>
  <div id="cmd-row">
    <span class="prompt">/</span>
    <input id="cmd-input" placeholder="输入命令…（/help 查看全部指令）" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" />
    <button id="cmd-send" type="button">发送</button>
  </div>
</div>
`;
