/** BlockAcademy — main entry: wires the voxel engine, AI NPCs, teaching scenes, and UI together */
import * as THREE from 'three';
import { World } from './core/world';
import { Player } from './core/player';
import { Input } from './core/input';
import { blockDef, BLOCK_LIST } from './core/blockRegistry';
import { blocks, HOTBAR as HOTBAR_DEF, BLOCK_NAMES } from './world/blockIds';
import { SCENES, SCENE_BY_ID, type SceneDef, type Pad } from './world/scenes';
import { NPCActor, stopSpeaking } from './npc/npcActor';
import { BY_ID, PERSONALITIES } from './npc/personalities';
import { loadLLMConfig, saveLLMConfig, type LLMConfig, type SceneContext } from './npc/brain';
import { UI, type HotbarItem } from './ui/ui';
import { ShowcasePlayer } from './ui/showcase';
import { setSpeechEnabled, initSpeech } from './ui/speech';
import {
  getActiveState,
  listProfiles,
  activeId as activeProfileId,
  createProfile as createUserProfile,
  selectProfile,
  deleteProfile as deleteUserProfile,
  saveActive,
  type ProfileMeta,
} from './user/profile';
import {
  bump,
  isDone,
  loadProgress,
  questsOf,
  saveProgress,
  sceneProgress,
  REWARDS,
  type Progress,
  type Quest,
} from './edu/quests';

class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(72, 1, 0.1, 420);
  world = new World(128, 48, 128);
  player = new Player();
  input: Input;
  ui: UI;
  showcase = new ShowcasePlayer();

  hemi = new THREE.HemisphereLight(0xffffff, 0x404860, 0.8);
  sun = new THREE.DirectionalLight(0xffffff, 0.9);
  starField: THREE.Points | null = null;
  highlight: THREE.LineSegments;

  npcs: NPCActor[] = [];
  sceneDef: SceneDef = SCENES[0];
  pads: Pad[] = [];
  progress: Progress = loadProgress();
  llm: LLMConfig = loadLLMConfig();
  userMeta: ProfileMeta = getActiveState().meta;
  hotbarIndex = 0;

  /** 《我的世界》风格游戏模式：survival 生存 / creative 创造 / adventure 冒险 / spectator 旁观 */
  gameMode: 'survival' | 'creative' | 'adventure' | 'spectator' = 'creative';
  /** /spawnpoint 设定的重生点（绝对坐标），null = 用场景默认出生点 */
  spawnPoint: THREE.Vector3 | null = null;

  mode: 'title' | 'play' | 'dialog' | 'showcase' | 'overlay' = 'title';
  activeNpc: NPCActor | null = null;
  private clock = new THREE.Clock();
  private padCooldown = 0;
  private nearPad: Pad | null = null;
  private npcCooldown = 0;

  private hotbar: HotbarItem[] = [];
  private consoleOpen = false;
  private seed = Math.floor(Math.random() * 1_000_000_000);
  private rain: THREE.Points | null = null;
  private raining = false;
  private timeNorm = 0;
  private sceneHasStars = false;
  private playerLight: THREE.PointLight;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    initSpeech(getActiveState().state.speech);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setSize(innerWidth, innerHeight);

    this.input = new Input(canvas);
    this.ui = new UI(uiRoot, {
      onStart: () => this.start(),
      onGotoScene: (id) => this.gotoScene(id),
      onAsk: (text) => this.ask(text),
      onDialogClose: () => this.closeDialog(),
      onSettingSave: (cfg) => this.saveSettings(cfg),
      onTestLLM: (cfg) => this.testLLM(cfg),
      onSpeech: (v) => this.onSpeech(v),
      onProfiles: () => ({ list: listProfiles(), activeId: activeProfileId() ?? '' }),
      onCreateProfile: (name, avatar, color) => this.createProfile(name, avatar, color),
      onSwitchProfile: (id) => this.switchProfile(id),
      onDeleteProfile: (id) => this.deleteProfile(id),
      onHotbar: (i) => this.setHotbar(i),
      onDemo: (a) => this.controlDemo(a),
      onPlayDemo: (id) => this.playDemo(id),
      onCommand: (raw) => this.handleCommand(raw),
      onConsoleClose: () => this.closeConsole(),
    });

    this.scene.add(this.world.group, this.hemi, this.sun);
    this.sun.position.set(60, 120, 40);
    this.scene.fog = new THREE.FogExp2(0xcfe8ff, 0.008);

    // A soft light that follows the player — keeps dark scenes (caves, observatory) playable
    this.playerLight = new THREE.PointLight(0xfff2d6, 0.0, 22, 1.4);
    this.scene.add(this.playerLight);

    this.hotbar = HOTBAR_DEF.map((h) => ({ id: h.id, name: h.name, tile: this.tileOf(h.id) }));
    this.ui.setHotbarItems(this.hotbar);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.003, 1.003, 1.003));
    this.highlight = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.65 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.showcase.init({
      onFrame: (info) => this.ui.showcaseFrame(info),
      onEnd: (id) => this.onDemoEnd(id),
    });

    canvas.addEventListener('click', () => {
      if (this.consoleOpen) return;
      if (this.mode === 'play' && !this.input.locked) this.input.requestLock();
    });

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  private resize(): void {
    const asp = innerWidth / innerHeight;
    this.camera.aspect = asp;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // ───────── 生命周期 ─────────
  boot(): void {
    this.buildScene(this.sceneDef, true);
    this.ui.renderMap(SCENES, this.sceneDef.id, this.progress, this.doneScenes);
    this.ui.renderQuests(this.sceneDef.id, this.progress);
    this.ui.setScene(this.sceneDef, this.doneScenes.size);
    this.ui.setTitlePlayer(this.userMeta);
    this.ui.setPlayer(this.userMeta);
    this.ui.setSettingsPlayer(this.userMeta);
    this.ui.fillSettings(this.llm);
    this.ui.loadingDone();
    if (location.search.includes('autoplay')) this.start();
    this.loop();
  }

  start(): void {
    this.ui.hideTitle();
    this.mode = 'play';
    this.input.requestLock();
    if (!this.progress.chatTurns) {
      setTimeout(() => this.playDemo('intro'), 300);
    } else {
      this.ui.toast('Welcome back! Press H for controls, M for the map', 'info', 5000);
    }
  }

  // ───────── 场景构建 ─────────
  private buildScene(scene: SceneDef, silent = false): void {
    this.sceneDef = scene;
    this.clearNpcs();
    this.world.data.fill(0);
    scene.build(this.world);
    this.world.rebuildAll();
    this.applyEnvironment(scene);

    // NPC
    this.npcs = scene.npcs
      .map((cfg) => {
        const p = BY_ID.get(cfg.p);
        if (!p) return null;
        const y = cfg.y ?? Math.max(2, this.world.groundY(cfg.x, cfg.z));
        const actor = new NPCActor(p, new THREE.Vector3(cfg.x + 0.5, y, cfg.z + 0.5), cfg.roam ?? 5, cfg.y);
        this.scene.add(actor.group);
        return actor;
      })
      .filter(Boolean) as NPCActor[];
    for (const n of this.npcs) {
      const q = questsOf(scene.id).find((x) => x.kind === 'talk' && x.target === n.personality.id);
      n.setBadge(true, q && isDone(q, this.progress) ? '✓' : '?');
    }

    this.pads = scene.pads;
    const spawnY = scene.groundY ?? this.world.groundY(scene.spawn[0], scene.spawn[1]);
    this.player.teleport(scene.spawn[0] + 0.5, spawnY + 0.6, scene.spawn[1] + 0.5);
    this.player.velocity.set(0, 0, 0);

    this.ui.setScene(scene, this.doneScenes.size);
    this.ui.renderQuests(scene.id, this.progress);
    if (!silent) this.ui.toast(`${scene.icon} ${scene.name} · ${scene.subtitle}`, 'info', 4200);
  }

  private applyEnvironment(scene: SceneDef): void {
    this.scene.background = new THREE.Color(scene.sky);
    (this.scene.fog as THREE.FogExp2).color.setHex(scene.fogColor);
    (this.scene.fog as THREE.FogExp2).density = scene.fogDensity;
    this.hemi.intensity = scene.ambient;
    this.hemi.color.setHex(scene.night ? 0x384a70 : 0xffffff);
    this.sun.intensity = scene.sun;
    this.sceneHasStars = !!scene.stars;
    this.timeNorm = 0;
    // A gentle light that follows the player so dark scenes stay playable
    this.playerLight.intensity = scene.ambient < 0.6 ? 1.0 : 0;
    if (scene.stars) {
      if (!this.starField) {
        const n = 900;
        const g = new THREE.BufferGeometry();
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const b = Math.random() * Math.PI * 0.45;
          const r = 240;
          arr[i * 3] = Math.cos(a) * Math.sin(b + 0.2) * r;
          arr[i * 3 + 1] = Math.cos(b) * r;
          arr[i * 3 + 2] = Math.sin(a) * Math.sin(b + 0.2) * r;
        }
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        this.starField = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }));
        this.starField.frustumCulled = false;
      }
      this.scene.add(this.starField);
    } else if (this.starField) {
      this.scene.remove(this.starField);
    }
  }

  private clearNpcs(): void {
    for (const n of this.npcs) {
      this.scene.remove(n.group);
      n.dispose();
    }
    this.npcs = [];
  }

  private gotoScene(id: string): void {
    if (id === this.sceneDef.id && id !== 'village') return;
    const s = SCENE_BY_ID.get(id);
    if (!s) return;
    stopSpeaking();
    this.mode = 'play';
    this.ui.toast(`Generating ${s.icon} ${s.name} …`, 'info', 2500);
    // 让提示先渲染出来，再做同步的地形生成
    setTimeout(() => {
      this.buildScene(s);
      this.ui.renderMap(SCENES, id, this.progress, this.doneScenes);
      saveProgress(this.progress);
    }, 60);
  }

  // ───────── 演示播放 ─────────
  private playDemo(id: string): void {
    if (this.showcase.play(id)) {
      this.mode = 'showcase';
      this.ui.showcaseShow(true);
      this.input.exitLock();
    }
  }

  private onDemoEnd(id: string): void {
    this.ui.showcaseShow(false);
    this.mode = 'play';
    this.input.requestLock();
    if (!id) return;
    const q = questsOf(this.sceneDef.id).find((x) => x.kind === 'demo' && x.target === id);
    if (q) this.completeQuest(q, 'Demo watched');
    if (id === 'intro') {
      this.ui.toast('Walk up to any resident and press E to chat with them', 'good', 6000);
    }
  }

  private controlDemo(a: 'next' | 'prev' | 'skip' | 'replay'): void {
    if (!this.showcase.active) return;
    if (a === 'next') this.showcase.next();
    else if (a === 'prev') this.showcase.prev();
    else if (a === 'skip') this.showcase.skip();
    else {
      const id = this.showcase.demoId;
      if (id) this.showcase.play(id);
    }
  }

  // ───────── 任务 ─────────
  get doneScenes(): Set<string> {
    const s = new Set<string>();
    for (const sc of SCENES) {
      const p = sceneProgress(sc.id, this.progress);
      if (p.total > 0 && p.done >= p.total) s.add(sc.id);
    }
    return s;
  }

  /** 走近时 NPC 会自己先开口招呼一句 */
  private checkProximity(): void {
    if (this.mode !== 'play' || !this.input.locked) return;
    const p = this.player.position;
    for (const n of this.npcs) {
      const d = n.position.distanceTo(p);
      if (d < 7.5 && n.shouldGreet()) {
        void n
          .talk('', this.sceneContext(), this.llm)
          .then((r) => {
            if (this.npcs.includes(n)) n.showBubble(r.text);
          })
          .catch(() => {
            /* ignore */
          });
      } else if (d < 7.5 && n.brain.history.length === 0 && Math.random() < 0.004) {
        // 偶尔没话题也会嘟囔一句
        n.showBubble('…', 2);
      }
    }
  }

  private bumpQuest(predicate: (q: Quest) => boolean, note = ''): void {
    for (const q of questsOf(this.sceneDef.id)) {
      if (!predicate(q)) continue;
      if (isDone(q, this.progress)) continue;
      bump(this.progress, q, 1);
      if (isDone(q, this.progress)) {
        this.ui.toast(`✅ ${q.title} — done! ${note}`, 'good');
        const sp = sceneProgress(this.sceneDef.id, this.progress);
        if (sp.done >= sp.total) {
          const r = REWARDS[this.sceneDef.id];
          this.ui.toast(`${r.icon} Earned the "${r.name}" badge! This stop is fully explored`, 'good', 6000);
        }
      }
    }
    this.ui.renderQuests(this.sceneDef.id, this.progress);
    for (const n of this.npcs) {
      const q = questsOf(this.sceneDef.id).find((x) => x.kind === 'talk' && x.target === n.personality.id);
      n.setBadge(true, q && isDone(q, this.progress) ? '✓' : '?');
    }
    saveProgress(this.progress);
  }

  private completeQuest(q: Quest, note: string): void {
    if (isDone(q, this.progress)) return;
    bump(this.progress, q, q.need);
    this.ui.toast(`✅ ${q.title} — done! ${note}`, 'good');
    const sp = sceneProgress(this.sceneDef.id, this.progress);
    if (sp.done >= sp.total) {
      const r = REWARDS[this.sceneDef.id];
      this.ui.toast(`${r.icon} Earned the "${r.name}" badge! This stop is fully explored`, 'good', 6000);
    }
    this.ui.renderQuests(this.sceneDef.id, this.progress);
    saveProgress(this.progress);
  }

  // ───────── 对话 ─────────
  private sceneContext(): SceneContext {
    return {
      sceneId: this.sceneDef.id,
      sceneName: `${this.sceneDef.name} (${this.sceneDef.subtitle})`,
      topics: this.sceneDef.topics,
      nearby: this.pads.slice(0, 3).map((p) => p.label.replace(/^\S+\s*/, '')),
    };
  }

  private openDialog(npc: NPCActor): void {
    this.mode = 'dialog';
    this.activeNpc = npc;
    npc.setSpeaking(true);
    this.ui.openDialog(npc.personality.id);
    this.ui.setEngineTag(this.llm.enabled && this.llm.apiKey ? 'LLM' : 'Local engine');
    const first = this.activeNpc.brain.history.length === 0;
    if (first) {
      void this.runTalk(this.activeNpc, '', true);
    }
  }

  private closeDialog(): void {
    if (this.activeNpc) this.activeNpc.setSpeaking(false);
    this.activeNpc = null;
    this.ui.closeDialog();
    stopSpeaking();
    this.mode = 'play';
    this.input.requestLock();
  }

  private async runTalk(npc: NPCActor, text: string, isGreet = false): Promise<void> {
    this.ui.busy(true);
    let bubble: HTMLElement | null = null;
    const startedAt = performance.now();
    const res = await npc.talk(text, this.sceneContext(), this.llm, (partial) => {
      if (!bubble) {
        bubble = this.ui.bubble('npc', partial);
        // 思考时延的直观反馈
        void startedAt;
      } else {
        this.ui.updateBubble(bubble, partial);
      }
    });
    if (!bubble) bubble = this.ui.bubble('npc', res.text);
    else this.ui.updateBubble(bubble, res.text);
    if (res.error) {
      this.ui.setEngineTag('Local engine (fallback)', true);
      this.ui.bubble('sys', `Couldn't reach the LLM: ${res.error.slice(0, 90)}. Auto-switched to the local knowledge engine.`);
    } else {
      this.ui.setEngineTag(res.engine === 'llm' ? 'LLM' : 'Local engine');
    }
    this.ui.busy(false);
    this.progress.chatTurns++;
    if (!isGreet) {
      this.bumpQuest((q) => q.kind === 'talk' && q.target === npc.personality.id);
    } else {
      this.bumpQuest((q) => q.kind === 'talk' && q.target === npc.personality.id);
    }
    saveProgress(this.progress);
  }

  private ask(text: string): void {
    if (!this.activeNpc) return;
    this.ui.bubble('me', text);
    void this.runTalk(this.activeNpc, text);
  }

  // ───────── 设置 ─────────
  private saveSettings(cfg: LLMConfig): void {
    this.llm = cfg;
    saveLLMConfig(cfg);
  }

  private onSpeech(v: boolean): void {
    setSpeechEnabled(v);
    saveActive({ speech: v });
    initSpeech(v);
  }

  // ───────── 玩家系统 ─────────
  /** Switch the whole game to the active profile, syncing llm / progress / speech / badges. */
  private applyUser(id: string): void {
    const a = getActiveState();
    this.userMeta = a.meta;
    this.llm = a.state.llm;
    this.progress = a.state.progress;
    initSpeech(a.state.speech);
    this.ui.refreshVoice();
    this.ui.setTitlePlayer(this.userMeta);
    this.ui.setPlayer(this.userMeta);
    this.ui.setSettingsPlayer(this.userMeta);
    this.ui.fillSettings(this.llm);
    this.ui.setScene(this.sceneDef, this.doneScenes.size);
    this.ui.renderQuests(this.sceneDef.id, this.progress);
    this.ui.renderMap(SCENES, this.sceneDef.id, this.progress, this.doneScenes);
    // refresh NPC talk-badges for the newly active progress
    for (const n of this.npcs) {
      const q = questsOf(this.sceneDef.id).find((x) => x.kind === 'talk' && x.target === n.personality.id);
      n.setBadge(true, q && isDone(q, this.progress) ? '✓' : '?');
    }
    void id;
  }

  private createProfile(name: string, avatar: string, color: string): void {
    const m = createUserProfile(name, avatar, color);
    selectProfile(m.id);
    this.applyUser(m.id);
    this.ui.renderProfiles();
    this.ui.toast(`Added player "${m.name}"`, 'good');
  }

  private switchProfile(id: string): void {
    selectProfile(id);
    this.applyUser(id);
    this.ui.renderProfiles();
    const m = listProfiles().find((x) => x.id === id);
    this.ui.toast(m ? `Switched to "${m.name}"` : 'Switched player', 'info');
  }

  private deleteProfile(id: string): void {
    if (!deleteUserProfile(id)) {
      this.ui.toast('Keep at least one player', 'warn');
      this.ui.renderProfiles();
      return;
    }
    const cur = activeProfileId();
    if (cur) this.applyUser(cur);
    this.ui.renderProfiles();
    this.ui.toast('Player deleted', 'info');
  }

  private async testLLM(cfg: LLMConfig): Promise<string> {
    if (!cfg.baseUrl || !cfg.apiKey) return 'Missing address or key';
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          model: cfg.model,
          max_tokens: 24,
          messages: [{ role: 'user', content: '只回复两个字：成功' }],
        }),
      });
      if (!res.body) return `HTTP ${res.status}`;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let out = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          if (s.slice(5).trim() === '[DONE]') break;
          try {
            const j = JSON.parse(s.slice(5).trim());
            out += j?.choices?.[0]?.delta?.content ?? '';
          } catch {
            /* ignore */
          }
        }
      }
      return out ? `✅ Connection OK, model replied: ${out.trim().slice(0, 20)}` : '⚠️ Connected but got empty reply — check the model name';
    } catch (e) {
      return `❌ Failed: ${(e as Error).message}`;
    }
  }

  private setHotbar(i: number): void {
    this.hotbarIndex = i;
    this.ui.setHotbarIndex(i);
  }

  // ───────── command console ─────────
  private tileOf(id: number): string {
    const d = blockDef(id);
    return typeof d.tiles === 'string' ? d.tiles : d.tiles.top;
  }

  private openConsole(): void {
    if (this.mode !== 'play') return;
    this.consoleOpen = true;
    this.input.exitLock();
    this.ui.openConsole();
  }

  private closeConsole(): void {
    this.consoleOpen = false;
    this.ui.closeConsole();
    if (this.mode === 'play') this.input.requestLock();
  }

  private blockFromName(name: string): number | null {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key in BLOCK_NAMES) return BLOCK_NAMES[key];
    // also accept raw block keys (e.g. stone_brick)
    const byKey = BLOCK_LIST.find((b) => b.key.replace(/[^a-z0-9]/g, '') === key);
    return byKey ? byKey.id : null;
  }

  private handleCommand(raw: string): void {
    const line = raw.trim();
    if (!line) return;
    if (!line.startsWith('/')) {
      this.ui.consolePrint('You (said): ' + line, 'me');
      this.ui.toast('📣 ' + line, 'info', 4000);
      return;
    }
    const parts = line.slice(1).split(/\s+/).filter(Boolean);
    const cmd = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);
    const out = (text: string, kind: 'ok' | 'err' | 'sys' | 'me' = 'ok') => this.ui.consolePrint(text, kind);
    const num = (s: string | undefined): number | null => {
      if (s === undefined) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const p = this.player.position;
    /** MC 风格相对坐标：~ = 当前位置，~5 = 偏移 +5 */
    const cd = (s: string | undefined, base: number): number | null => {
      if (s === undefined) return null;
      if (s.startsWith('~')) {
        const rest = s.slice(1);
        if (rest === '') return base;
        const n = Number(rest);
        return Number.isFinite(n) ? base + n : null;
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const bx = Math.floor(p.x);
    const by = Math.floor(p.y);
    const bz = Math.floor(p.z);
    const MAXVOL = 200_000;

    switch (cmd) {
      case 'help':
        out('【Move】    /tp (/teleport) <x y z> | <scene> | ~ ~10 ~      /locate      /fly', 'sys');
        out('【Build】   /setblock <x y z> <block>     /fill <region> <block> [replace <blk>]', 'sys');
        out('           /clone <region> <tx ty tz>    /give <block> [count]    /clear', 'sys');
        out('【World】   /gamemode <survival|creative|adventure|spectator> (or 0/1/2/3)', 'sys');
        out('           /time day|night|noon|sunrise|sunset|set <0-100>|add <0-100>   /weather clear|rain|thunder', 'sys');
        out('【Chat】    /say <text>   /me <text>   /title <text>   /tellraw <text>   /stopsound', 'sys');
        out('【Info】    /list [scenes|npcs|players|blocks]   /seed      /summon <npc>', 'sys');
        out('【Life】    /kill (respawn)   /spawnpoint [x y z]   /setworldspawn [x y z]', 'sys');
        out('Coordinates support MC-style ~ : e.g. /tp ~ ~10 ~   /setblock ~ ~1 ~ lamp', 'sys');
        return;
      case 'tp':
      case 'teleport': {
        if (args.length >= 3) {
          const x = cd(args[0], bx);
          const y = cd(args[1], by);
          const z = cd(args[2], bz);
          if (x === null || y === null || z === null) return out('Usage: /tp <x> <y> <z>  (use ~ for relative)', 'err');
          this.player.teleport(x + 0.5, y + 0.6, z + 0.5);
          return out(`Teleported to (${x}, ${y}, ${z})`, 'ok');
        }
        const target = args[0]?.toLowerCase() ?? '';
        const scene = SCENES.find((s) => s.id === target || s.name.toLowerCase().includes(target) || s.id.includes(target));
        if (!scene) return out(`Unknown scene "${args[0]}". Try /list`, 'err');
        this.gotoScene(scene.id);
        return out(`Teleported to ${scene.icon} ${scene.name}`, 'ok');
      }
      case 'give': {
        const id = this.blockFromName(args[0] ?? '');
        if (id === null) return out(`Unknown block "${args[0]}". Try a name like stone, glass, lamp`, 'err');
        const count = Math.max(1, Math.min(9999, num(args[1]) ?? 64));
        const existing = this.hotbar.findIndex((h) => h.id === id);
        if (existing >= 0) {
          this.setHotbar(existing);
        } else {
          if (this.hotbar.length >= 18) return out('Hotbar is full (max 18 slots)', 'err');
          this.hotbar.push({ id, name: blockDef(id).name, tile: this.tileOf(id) });
          this.ui.setHotbarItems(this.hotbar);
          this.setHotbar(this.hotbar.length - 1);
        }
        return out(`Gave you ${count} × ${blockDef(id).name}`, 'ok');
      }
      case 'setblock': {
        const x = cd(args[0], bx);
        const y = cd(args[1], by);
        const z = cd(args[2], bz);
        const id = this.blockFromName(args[3] ?? '');
        if (x === null || y === null || z === null || id === null) return out('Usage: /setblock <x> <y> <z> <block>', 'err');
        this.world.set(x, y, z, id);
        return out(`Set (${x}, ${y}, ${z}) to ${blockDef(id).name}`, 'ok');
      }
      case 'fill': {
        const nums = [cd(args[0], bx), cd(args[1], by), cd(args[2], bz), cd(args[3], bx), cd(args[4], by), cd(args[5], bz)];
        if (nums.some((n) => n === null)) return out('Usage: /fill <x1> <y1> <z1> <x2> <y2> <z2> <block> [replace <target>]', 'err');
        const id = this.blockFromName(args[6] ?? '');
        if (id === null) return out(`Unknown block "${args[6]}"`, 'err');
        const [x0, y0, z0, x1, y1, z1] = nums as number[];
        const [mx, my, mz, Mx, My, Mz] = [
          Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1),
          Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1),
        ];
        const vol = (Mx - mx + 1) * (My - my + 1) * (Mz - mz + 1);
        if (vol > MAXVOL) return out(`Region too large (${vol} blocks, max ${MAXVOL})`, 'err');
        let n = 0;
        if ((args[7] || '').toLowerCase() === 'replace') {
          const only = this.blockFromName(args[8] ?? '');
          if (only === null) return out('Usage: /fill ... <block> replace <target>', 'err');
          for (let x = mx; x <= Mx; x++)
            for (let y = my; y <= My; y++)
              for (let z = mz; z <= Mz; z++)
                if (this.world.get(x, y, z) === only) {
                  this.world.set(x, y, z, id);
                  n++;
                }
        } else {
          this.world.fill(mx, my, mz, Mx, My, Mz, id);
          n = vol;
        }
        return out(`Filled ${n} block(s) with ${blockDef(id).name}`, 'ok');
      }
      case 'clone': {
        const nums = [cd(args[0], bx), cd(args[1], by), cd(args[2], bz), cd(args[3], bx), cd(args[4], by), cd(args[5], bz)];
        const t = [cd(args[6], bx), cd(args[7], by), cd(args[8], bz)];
        if (nums.some((n) => n === null) || t.some((n) => n === null))
          return out('Usage: /clone <x1> <y1> <z1> <x2> <y2> <z2> <tx> <ty> <tz>', 'err');
        const [x0, y0, z0, x1, y1, z1] = nums as number[];
        const [mx, my, mz, Mx, My, Mz] = [
          Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1),
          Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1),
        ];
        const vol = (Mx - mx + 1) * (My - my + 1) * (Mz - mz + 1);
        if (vol > MAXVOL) return out(`Region too large (${vol} blocks, max ${MAXVOL})`, 'err');
        const [tx, ty, tz] = t as number[];
        let n = 0;
        for (let x = mx; x <= Mx; x++)
          for (let y = my; y <= My; y++)
            for (let z = mz; z <= Mz; z++) {
              this.world.set(tx + (x - mx), ty + (y - my), tz + (z - mz), this.world.get(x, y, z));
              n++;
            }
        return out(`Cloned ${n} block(s) to (${tx}, ${ty}, ${tz})`, 'ok');
      }
      case 'gamemode': {
        const m = (args[0] || '').toLowerCase();
        const map: Record<string, 'survival' | 'creative' | 'adventure' | 'spectator'> = {
          survival: 'survival', s: 'survival', '0': 'survival',
          creative: 'creative', c: 'creative', '1': 'creative',
          adventure: 'adventure', a: 'adventure', '2': 'adventure',
          spectator: 'spectator', sp: 'spectator', '3': 'spectator',
        };
        const target = map[m];
        if (!target) return out('Usage: /gamemode <survival|creative|adventure|spectator>  (also 0/1/2/3, s/c/a/sp)', 'err');
        return out(this.setGameMode(target), 'ok');
      }
      case 'kill': {
        const sp = this.spawnPoint;
        if (sp) this.player.teleport(sp.x, sp.y, sp.z);
        else {
          const s = this.sceneDef;
          const y = s.groundY ?? this.world.groundY(s.spawn[0], s.spawn[1]);
          this.player.teleport(s.spawn[0] + 0.5, y + 0.6, s.spawn[1] + 0.5);
        }
        this.player.velocity.set(0, 0, 0);
        this.ui.toast('💀 Respawned at the spawn point', 'info');
        return out('Respawned at the spawn point', 'ok');
      }
      case 'spawnpoint':
      case 'setworldspawn': {
        if (args.length >= 3) {
          const x = cd(args[0], bx);
          const y = cd(args[1], by);
          const z = cd(args[2], bz);
          if (x === null || y === null || z === null) return out('Usage: /spawnpoint [x y z]', 'err');
          this.spawnPoint = new THREE.Vector3(x + 0.5, y + 0.6, z + 0.5);
          return out(`Spawn point set to (${x}, ${y}, ${z})`, 'ok');
        }
        this.spawnPoint = new THREE.Vector3(p.x, p.y + 0.6, p.z);
        return out(`Spawn point set to (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`, 'ok');
      }
      case 'summon': {
        const key = (args[0] || '').toLowerCase();
        if (!key) return out('Usage: /summon <npc>  ·  e.g. /summon quark  ·  see /list npcs', 'err');
        const found = PERSONALITIES.find(
          (x) => x.id === key || x.id.includes(key) || x.name.toLowerCase().includes(key),
        );
        if (!found) return out(`Unknown NPC "${args[0]}". Try /list npcs`, 'err');
        const px = Math.floor(p.x);
        const pz = Math.floor(p.z);
        const y = this.world.groundY(px, pz);
        const actor = new NPCActor(found, new THREE.Vector3(px + 0.5, y, pz + 0.5), 4, y);
        this.scene.add(actor.group);
        this.npcs.push(actor);
        return out(`Summoned ${found.emoji} ${found.name} at (${px}, ${y}, ${pz})`, 'ok');
      }
      case 'clear': {
        this.hotbar = HOTBAR_DEF.map((h) => ({ id: h.id, name: h.name, tile: this.tileOf(h.id) }));
        this.ui.setHotbarItems(this.hotbar);
        this.setHotbar(0);
        return out('Hotbar reset to the default set', 'ok');
      }
      case 'stopsound':
        stopSpeaking();
        return out('Stopped all NPC speech', 'ok');
      case 'me': {
        const t = args.join(' ');
        if (!t) return out('Usage: /me <text>', 'err');
        this.ui.toast(`* ${this.userMeta.name} ${t}`, 'info', 4500);
        return out(`* ${this.userMeta.name} ${t}`, 'me');
      }
      case 'title': {
        const t = args.join(' ');
        if (!t) return out('Usage: /title <text>', 'err');
        this.ui.bigTitle(t);
        return out('Title shown: ' + t, 'ok');
      }
      case 'tellraw': {
        const t = args.join(' ');
        if (!t) return out('Usage: /tellraw <text>', 'err');
        this.ui.toast(t, 'info', 5000);
        return out(t, 'sys');
      }
      case 'fly':
        this.player.fly = !this.player.fly;
        return out(`Flight mode ${this.player.fly ? 'ON' : 'OFF'}`, 'ok');
      case 'locate':
        return out(`Position: X ${p.x.toFixed(1)}  Y ${p.y.toFixed(1)}  Z ${p.z.toFixed(1)}`, 'ok');
      case 'list': {
        const what = (args[0] || 'scenes').toLowerCase();
        if (what === 'players') {
          const cur = activeProfileId();
          for (const m of listProfiles()) out(`${m.id === cur ? '▶ ' : '   '}${m.avatar} ${m.name}`, 'sys');
          return;
        }
        if (what === 'npcs') {
          if (!this.npcs.length) return out('No NPCs here. Try /summon <name>', 'sys');
          for (const n of this.npcs) out(`${n.personality.emoji} ${n.personality.name} — ${n.personality.id}`, 'sys');
          return;
        }
        if (what === 'blocks') {
          out(BLOCK_LIST.map((b) => b.key).join(', '), 'sys');
          return;
        }
        for (const s of SCENES) out(`${s.id} — ${s.icon} ${s.name} (${s.subtitle})`, 'sys');
        return;
      }
      case 'seed':
        return out(`World seed: ${this.seed}`, 'ok');
      case 'say':
        this.ui.toast('📣 ' + args.join(' '), 'info', 4000);
        return out('Broadcast: ' + args.join(' '), 'me');
      case 'day':
      case 'time':
        if (cmd === 'day' && args.length === 0) return this.setTimeOfDay(0), out('Time set to day', 'ok');
        if (cmd === 'time' && args[0] === 'day') return this.setTimeOfDay(0), out('Time set to day', 'ok');
        if (cmd === 'time' && args[0] === 'night') return this.setTimeOfDay(1), out('Time set to night', 'ok');
        if (cmd === 'time' && args[0] === 'noon') return this.setTimeOfDay(0), out('Time set to noon', 'ok');
        if (cmd === 'time' && (args[0] === 'sunrise' || args[0] === 'sunset')) return this.setTimeOfDay(0.5), out(`Time set to ${args[0]}`, 'ok');
        if (cmd === 'time' && args[0] === 'set') {
          const n = num(args[1]);
          if (n === null) return out('Usage: /time set <0-100> (darkness %)', 'err');
          return this.setTimeOfDay(Math.max(0, Math.min(100, n)) / 100), out(`Time set (darkness ${n}%)`, 'ok');
        }
        if (cmd === 'time' && args[0] === 'add') {
          const n = num(args[1]);
          if (n === null) return out('Usage: /time add <0-100>', 'err');
          return this.setTimeOfDay(Math.max(0, Math.min(100, this.timeNorm * 100 + n)) / 100), out(`Time advanced by ${n}`, 'ok');
        }
        return out('Usage: /time day|night|noon|sunrise|sunset|set <0-100>|add <0-100>', 'err');
      case 'night':
        return this.setTimeOfDay(1), out('Time set to night', 'ok');
      case 'weather': {
        const w = (args[0] ?? '').toLowerCase();
        if (w !== 'clear' && w !== 'rain' && w !== 'thunder') return out('Usage: /weather clear|rain|thunder', 'err');
        if (w === 'thunder') {
          this.setWeather(true);
          this.setTimeOfDay(1);
          return out('Thunderstorm — rain + night', 'ok');
        }
        this.setWeather(w === 'rain');
        return out(`Weather: ${w}`, 'ok');
      }
      default:
        return out(`Unknown command "/${cmd}". Type /help`, 'err');
    }
  }

  private ensureStars(): void {
    if (this.starField) {
      if (!this.scene.children.includes(this.starField)) this.scene.add(this.starField);
      return;
    }
    const n = 900;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI * 0.45;
      const r = 240;
      arr[i * 3] = Math.cos(a) * Math.sin(b + 0.2) * r;
      arr[i * 3 + 1] = Math.cos(b) * r;
      arr[i * 3 + 2] = Math.sin(a) * Math.sin(b + 0.2) * r;
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    this.starField = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }));
    this.starField.frustumCulled = false;
    this.scene.add(this.starField);
  }

  private setTimeOfDay(norm: number): void {
    norm = Math.max(0, Math.min(1, norm));
    this.timeNorm = norm;
    const day = new THREE.Color(0x9ecbff);
    const night = new THREE.Color(0x070a16);
    const sky = day.clone().lerp(night, norm);
    (this.scene.background as THREE.Color).copy(sky);
    (this.scene.fog as THREE.FogExp2).color.copy(sky.clone().multiplyScalar(0.9));
    this.hemi.intensity = 0.95 - 0.78 * norm;
    this.hemi.color.setHex(norm > 0.5 ? 0x384a70 : 0xffffff);
    this.sun.intensity = 1.0 - 0.95 * norm;
    this.playerLight.intensity = norm > 0.5 ? 0.7 : this.sceneDef.ambient < 0.6 ? 1.0 : 0;
    if (norm > 0.5) this.ensureStars();
    else if (this.starField && !this.sceneHasStars) this.scene.remove(this.starField);
  }

  private buildRain(): void {
    const n = 1400;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 42;
      pos[i * 3 + 1] = Math.random() * 46;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 42;
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xbcd2ff, size: 0.14, transparent: true, opacity: 0.65 });
    this.rain = new THREE.Points(g, m);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  private updateRain(dt: number): void {
    if (!this.rain) return;
    const attr = this.rain.geometry.getAttribute('position') as THREE.Float32BufferAttribute;
    const a = attr.array as Float32Array;
    for (let i = 1; i < a.length; i += 3) {
      a[i] -= dt * 34;
      if (a[i] < 0) a[i] += 46;
    }
    attr.needsUpdate = true;
    this.rain.position.set(this.camera.position.x, 0, this.camera.position.z);
  }

  private setWeather(rain: boolean): void {
    this.raining = rain;
    const fog = this.scene.fog as THREE.FogExp2;
    if (rain) {
      if (!this.rain) this.buildRain();
      this.rain!.visible = true;
      fog.density = Math.max(this.sceneDef.fogDensity, 0.02) * 2.6;
    } else {
      if (this.rain) this.rain.visible = false;
      fog.density = this.sceneDef.fogDensity;
    }
  }

  // ───────── 世界交互 ─────────
  private updateHighlight(): { x: number; y: number; z: number } | null {
    const hit = this.world.raycast(
      this.player.position.x,
      this.player.position.y + 1.62,
      this.player.position.z,
      ...this.dirTuple(),
      6,
    );
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      return hit;
    }
    this.highlight.visible = false;
    return null;
  }

  private dirTuple(): [number, number, number] {
    const d = this.player.forwardVector();
    return [d.x, d.y, d.z];
  }

  /** 创造 / 生存可以放置和挖掘；冒险 / 旁观只能看 */
  get canEdit(): boolean {
    return this.gameMode === 'creative' || this.gameMode === 'survival';
  }

  private setGameMode(m: 'survival' | 'creative' | 'adventure' | 'spectator'): string {
    this.gameMode = m;
    this.player.fly = m === 'creative' || m === 'spectator';
    this.player.noclip = m === 'spectator';
    const label = { survival: 'Survival', creative: 'Creative', adventure: 'Adventure', spectator: 'Spectator' }[m];
    const note =
      m === 'creative'
        ? ' (fly on, free building)'
        : m === 'spectator'
          ? ' (fly + pass through blocks, no building)'
          : m === 'adventure'
            ? ' (no placing or mining)'
            : ' (fly off, normal building)';
    this.ui.toast(`🎮 ${label}${note}`, 'info', 4200);
    return `Game mode set to ${label}`;
  }

  private doEdit(): void {
    if (!this.canEdit) return;
    const hit = this.world.raycast(
      this.player.position.x,
      this.player.position.y + 1.62,
      this.player.position.z,
      ...this.dirTuple(),
      6,
    );
    const placeId = this.hotbar[this.hotbarIndex].id;
    if (this.input.takeClick(0)) {
      if (hit && hit.y > 1) {
        this.world.set(hit.x, hit.y, hit.z, 0);
      }
    }
    if (this.input.takeClick(2)) {
      if (hit) {
        const x = hit.x + hit.nx;
        const y = hit.y + hit.ny;
        const z = hit.z + hit.nz;
        const px = this.player.position;
        const overlap =
          x + 1 > px.x - 0.34 && x < px.x + 0.34 && z + 1 > px.z - 0.34 && z < px.z + 0.34 && y + 1 > px.y && y < px.y + 1.8;
        if (!overlap && y > 0) {
          this.world.set(x, y, z, placeId);
          this.bumpQuest((q) => q.kind === 'build');
        }
      }
    }
  }

  // ───────── 主循环 ─────────
  private loop(): void {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    const asp = innerWidth / innerHeight;

    if (this.mode === 'showcase') {
      this.showcase.update(dt, asp);
      this.renderer.render(this.showcase.scene, this.showcase.camera);
      this.input.endFrame();
      return;
    }

    const frozen = this.mode !== 'play' || !this.input.locked;
    this.player.update(dt, this.input, this.world, frozen);
    this.player.applyCamera(this.camera);
    this.playerLight.position.copy(this.camera.position);
    if (this.rain && this.rain.visible) this.updateRain(dt);

    const t = performance.now() / 1000;
    for (const n of this.npcs) n.update(dt, t, this.world, this.player.position, frozen);
    this.checkProximity();

    this.handleKeys();
    if (!frozen) {
      this.updateHighlight();
      this.doEdit();
      const w = this.input.takeWheel();
      if (w) this.setHotbar((this.hotbarIndex - w + this.hotbar.length) % this.hotbar.length);
    } else {
      this.highlight.visible = false;
    }

    this.world.flushDirty(3);
    this.updateHint();

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  private handleKeys(): void {
    const i = this.input;
    if (this.consoleOpen) return;
    if (this.mode === 'play' && this.input.locked && (i.pressed('KeyT') || i.pressed('Slash'))) {
      this.openConsole();
      return;
    }
    for (let k = 0; k < this.hotbar.length; k++) {
      if (i.pressed(`Digit${k + 1}`)) this.setHotbar(k);
    }
    if (i.pressed('KeyM')) {
      this.ui.renderMap(SCENES, this.sceneDef.id, this.progress, this.doneScenes);
      this.ui.toggleOverlay('map');
      i.exitLock();
    }
    if (i.pressed('KeyO')) {
      this.ui.fillSettings(this.llm);
      this.ui.toggleOverlay('settings');
      i.exitLock();
    }
    if (i.pressed('KeyP')) {
      this.ui.openProfiles();
      i.exitLock();
    }
    if (i.pressed('KeyH')) this.ui.toggleOverlay('help');
    if (i.pressed('Escape') && this.mode === 'dialog') this.closeDialog();
    if (i.pressed('KeyE')) {
      if (this.nearPad) {
        const p = this.nearPad;
        if (p.demo) this.playDemo(p.demo);
        else if (p.goto) this.gotoScene(p.goto);
      } else {
        const npc = this.nearestNpc();
        if (npc) this.openDialog(npc);
      }
    }
    void blocks;
  }

  private nearestNpc(): NPCActor | null {
    let best: NPCActor | null = null;
    let bestD = 4.6;
    const dir = this.player.forwardVector();
    for (const n of this.npcs) {
      const d = n.position.distanceTo(this.player.position);
      if (d > bestD) continue;
      const to = new THREE.Vector3().subVectors(n.position, this.player.position).setY(0).normalize();
      const fwd = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      if (to.dot(fwd) < 0.25 && d > 2.2) continue;
      best = n;
      bestD = d;
    }
    return best;
  }

  private updateHint(): void {
    if (this.consoleOpen) {
      this.ui.hint(null);
      return;
    }
    if (this.mode !== 'play') {
      this.ui.hint(null);
      return;
    }
    if (!this.input.locked) {
      this.ui.hint('Click the screen to resume (<kbd>ESC</kbd> to release mouse)');
      return;
    }
    // 演示台优先
    this.nearPad = null;
    const p = this.player.position;
    for (const pad of this.pads) {
      const padY = pad.y ?? this.world.groundY(pad.x, pad.z);
      if (Math.hypot(pad.x + 0.5 - p.x, pad.z + 0.5 - p.z) < 2.6 && Math.abs(padY - p.y) < 3) {
        this.nearPad = pad;
        break;
      }
    }
    if (this.nearPad) {
      this.ui.hint(`<kbd>E</kbd> ${this.nearPad.label}`);
      return;
    }
    const npc = this.nearestNpc();
    if (npc) {
      const q = questsOf(this.sceneDef.id).find((x) => x.kind === 'talk' && x.target === npc.personality.id);
      const doneTag = q && isDone(q, this.progress) ? ' (already chatted)' : '';
      this.ui.hint(`<kbd>E</kbd> Talk with ${npc.personality.emoji} ${npc.personality.name} ${doneTag}`);
      // 首次靠近自动打个招呼（由对话面板承担）
      if (npc.shouldGreet() && Math.random() < 0.02) {
        // 低频触发：让 NPC 自己先开口一小句
      }
      this.npcCooldown = 0;
      return;
    }
    this.ui.hint(null);
    if (this.npcCooldown++ > 60) this.npcCooldown = 0;
  }

  private padCooldownTick(): void {
    if (this.padCooldown > 0) this.padCooldown--;
  }
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;
const game = new Game(canvas, uiRoot);
game.boot();

export { game };
