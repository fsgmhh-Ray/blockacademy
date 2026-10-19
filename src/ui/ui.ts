/** All DOM UI: HUD, dialog, quests, map, settings, demo player, title screen */
import { blockDef } from '../core/blockRegistry';
import { atlasCanvas, TILE, tileIdOf } from '../core/textures';
import { blocks } from '../world/blockIds';
import { PERSONALITIES } from '../npc/personalities';
import { setSpeechEnabled, speechEnabled } from './speech';
import { loadLLMConfig, type LLMConfig } from '../npc/brain';
import type { SceneDef } from '../world/scenes';
import { questsOf, type Quest, type Progress } from '../edu/quests';

export interface UIHooks {
  onStart: () => void;
  onGotoScene: (id: string) => void;
  onAsk: (text: string) => void;
  onDialogClose: () => void;
  onSettingSave: (cfg: LLMConfig) => void;
  onTestLLM: (cfg: LLMConfig) => Promise<string>;
  onHotbar: (i: number) => void;
  onDemo: (action: 'next' | 'prev' | 'skip' | 'replay') => void;
  onPlayDemo: (id: string) => void;
  onCommand: (raw: string) => void;
  onConsoleClose: () => void;
}

export interface HotbarItem {
  id: number;
  tile: string;
  name?: string;
}

const PRESETS: { name: string; baseUrl: string; model: string; tip: string }[] = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', tip: 'Official API; needs a reachable network' },
  { name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini', tip: 'Built-in X real-time data — great for up-to-date NPCs' },
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
  private hotbarItems: HotbarItem[] = HOTBAR.map((h) => ({ ...h }));
  private cmdInput!: HTMLInputElement;
  private cmdLog!: HTMLElement;

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
    q('hotbar');
    q('dialog');
    q('chat');
    this.chipsHost = q('quick');
    this.askInput = q('ask-input') as HTMLInputElement;
    q('quests');
    q('overlay-map');
    q('overlay-settings');
    q('overlay-help');
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
    this.cmdInput = q('cmd-input') as HTMLInputElement;
    this.cmdLog = q('cmd-log');
    // dialog & overlay inner elements
    ['dialog-avatar', 'dialog-name', 'dialog-role', 'dialog-engine', 'map-cards', 'preset-row', 'preset-tip', 'llm-enabled', 'llm-base', 'llm-key', 'llm-model', 'llm-save', 'llm-test', 'voice-toggle', 'ask-send'].forEach(
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
    (q('sc-next') as HTMLButtonElement).onclick = () => hooks.onDemo('next');
    (q('sc-prev') as HTMLButtonElement).onclick = () => hooks.onDemo('prev');
    (q('sc-skip') as HTMLButtonElement).onclick = () => hooks.onDemo('skip');
    (q('sc-replay') as HTMLButtonElement).onclick = () => hooks.onDemo('replay');

    this.cmdInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.submitCommand();
      else if (e.key === 'Escape') {
        e.preventDefault();
        this.hooks.onConsoleClose();
      }
    });
    this.cmdInput.addEventListener('keyup', (e) => e.stopPropagation());

    this.buildHotbar();
    this.buildSettings();
  }

  // ───────── basic display ─────────
  loadingDone(): void {
    this.el['loading'].classList.add('hide');
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

  setScene(scene: SceneDef, badges: number): void {
    this.el['topbar'].innerHTML = `<span class="scene-name">${scene.icon} ${scene.name}</span><span class="dot"></span><span>${scene.subtitle}</span><span class="dot"></span>Badges <span class="bad">${badges}</span>`;
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
  setHotbarItems(items: HotbarItem[]): void {
    this.hotbarItems = items.map((h) => ({ ...h }));
    this.buildHotbar();
  }

  private buildHotbar(): void {
    const host = this.el['hotbar'];
    host.innerHTML = '';
    this.hotbarItems.forEach((item, i) => {
      const def = blockDef(item.id);
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === 0 ? ' active' : '');
      slot.dataset.index = String(i);
      slot.title = item.name ?? def.name;
      const cv = document.createElement('canvas');
      cv.width = 32;
      cv.height = 32;
      this.paintTile(cv, item.tile);
      slot.appendChild(cv);
      const lb = document.createElement('span');
      lb.textContent = String(i + 1);
      lb.style.cssText = 'position:absolute;right:2px;top:1px;font-size:9px;color:#7f8ea8';
      slot.appendChild(lb);
      slot.onclick = () => this.hooks.onHotbar(i);
      host.appendChild(slot);
    });
  }

  // ───────── command console ─────────
  openConsole(): void {
    this.el['cmd-console'].classList.add('show');
    this.cmdLog.innerHTML = '';
    this.consolePrint('Command console — type /help for a list of commands.', 'sys');
    setTimeout(() => this.cmdInput.focus(), 30);
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
    setTimeout(() => this.askInput.focus(), 60);
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

  // ───────── overlays ─────────
  openOverlay(which: 'map' | 'settings' | 'help'): void {
    this.el[`overlay-${which}`].classList.add('show');
  }
  closeOverlay(which: 'map' | 'settings' | 'help'): void {
    this.el[`overlay-${which}`].classList.remove('show');
    this.askInput?.focus?.();
  }
  openSettings(): void {
    this.fillSettings(loadLLMConfig());
    this.openOverlay('settings');
  }
  toggleOverlay(which: 'map' | 'settings' | 'help'): void {
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
      setSpeechEnabled(!speechEnabled());
      this.syncVoice();
      this.toast(speechEnabled() ? 'NPC voice reading enabled' : 'Voice reading disabled');
    };
    this.syncVoice();
  }

  private syncVoice(): void {
    (this.el['voice-toggle'] as HTMLButtonElement).textContent = speechEnabled() ? '🔊 Voice: On' : '🔇 Voice: Off';
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

<div id="toast"></div>

<div id="hint"></div>

<div id="hotbar" class="panel"></div>

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
    </div>

    <div class="row">
      <button id="llm-save" class="primary">Save</button>
      <button id="llm-test">Test connection</button>
      <button id="voice-toggle" class="ghost">🔇 Voice: Off</button>
      <button id="btn-settings-close" class="ghost">Close (O)</button>
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
      <div class="card"><div class="ic">💬</div><b>Talk to NPCs</b><small>Walk up and press E to chat, ESC to close; type any science question</small></div>
      <div class="card"><div class="ic">🎬</div><b>3D Demo</b><small>Step onto a glowing demo pad and press E for a narrated animation</small></div>
      <div class="card"><div class="ic">🗺️</div><b>Change Scene</b><small>Press M for the map to teleport, or step on a teleport pad</small></div>
      <div class="card"><div class="ic">🎯</div><b>Quests</b><small>Talking, watching demos, and building all advance quests; finish to earn badges</small></div>
      <div class="card"><div class="ic">⌘</div><b>Commands</b><small>Press <kbd>T</kbd> or <kbd>/</kbd> to open the console. Try <code>/help</code>, <code>/tp</code>, <code>/give</code>, <code>/fly</code>, <code>/time</code>, <code>/weather</code></small></div>
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
    <div class="row" style="justify-content:center">
      <button id="btn-start" class="primary" style="font-size:16px;padding:12px 32px">▶ Start Exploring</button>
      <button id="btn-start-llm" class="ghost" style="font-size:14px;padding:12px 22px">Connect an LLM</button>
    </div>
    <div class="keys">
      <kbd>W A S D</kbd> Move · <kbd>Space</kbd> Jump · <kbd>F</kbd> Fly · <kbd>L-click</kbd> Mine · <kbd>R-click</kbd> Place<br />
      <kbd>E</kbd> Talk / Trigger Demo · <kbd>M</kbd> Map · <kbd>O</kbd> Settings · <kbd>H</kbd> Help · <kbd>T</kbd> Commands · <kbd>ESC</kbd> Release Mouse
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
  <div id="cmd-log"></div>
  <div id="cmd-row">
    <span class="prompt">/</span>
    <input id="cmd-input" placeholder="Type a command…  (try /help)" autocomplete="off" spellcheck="false" />
  </div>
</div>
`;
