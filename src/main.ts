/** BlockAcademy — main entry: wires the voxel engine, AI NPCs, teaching scenes, and UI together */
import * as THREE from 'three';
import { World } from './core/world';
import { Player } from './core/player';
import { Input } from './core/input';
import { Sky } from './core/sky';
import { ViewModel } from './core/viewmodel';
import { TouchControls } from './core/touch';
import { sfx } from './core/sfx';
import { blockDef, BLOCK_LIST } from './core/blockRegistry';
import { blocks, BLOCK_NAMES } from './world/blockIds';
import { MobManager, type Mob, type MobKind } from './mob/mobs';
import { Inventory, type Slot } from './craft/inventory';
import { item, breakDrop, keyOfBlock, hasItem, blockItems, type ItemDef } from './craft/items';
import type { InvTarget, PauseAction } from './ui/ui';
import type { Tab } from './craft/inventory';
import type { VoxelHit } from './core/world';
import { SCENES, SCENE_BY_ID, type SceneDef, type Pad } from './world/scenes';
import { Landmarks } from './world/landmarks';
import { NPCActor, stopSpeaking } from './npc/npcActor';
import { BY_ID, PERSONALITIES } from './npc/personalities';
import { loadLLMConfig, saveLLMConfig, type LLMConfig, type SceneContext } from './npc/brain';
import { UI } from './ui/ui';
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
  type ChatEntry,
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
import { NetClient, type Identity } from './net/net';
import { RemotePlayers } from './net/avatars';
import {
  DEFAULT_BROKER,
  sanitizeRoom,
  type ChatMsg,
  type EditMsg,
  type EventMsg,
  type NetConfig,
  type NetStatus,
  type PlayerState,
} from './net/protocol';

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
  sky = new Sky();
  mobs = new MobManager();
  vm = new ViewModel();
  inv = new Inventory();
  touch!: TouchControls;
  highlight: THREE.LineSegments;
  /** 破坏方块时的碎屑粒子 */
  private particles: THREE.Points | null = null;
  private pData: { p: THREE.Vector3; v: THREE.Vector3; life: number; c: THREE.Color }[] = [];

  npcs: NPCActor[] = [];
  sceneDef: SceneDef = SCENES[0];
  pads: Pad[] = [];
  progress: Progress = loadProgress();
  llm: LLMConfig = loadLLMConfig();
  userMeta: ProfileMeta = getActiveState().meta;
  hotbarIndex = 0;

  // ───────── 生存要素 ─────────
  health = 100;
  readonly maxHealth = 100;
  hunger = 100;
  private fallFrom = 0;
  private wasOnGround = true;
  private hurtCd = 0;
  private regenT = 0;
  private stepT = 0;
  private fartCd = 0;
  private swingCd = 0;
  private mineT = 0;
  private mineKey = '';

  // ───────── 版本 / 显示 ─────────
  /** JAVA = 键鼠，BEDROCK = 触屏 */
  edition: 'java' | 'bedrock' = 'java';
  private f3On = false;
  private cycleOn = false;
  private soundOn = true;
  soundVolume = 0.55;

  // ───────── 社交与记录 ─────────
  friendship: Record<string, number> = {};
  chatLog: ChatEntry[] = [];
  achievements: Record<string, number> = {};

  /** 《我的世界》风格游戏模式：survival 生存 / creative 创造 / adventure 冒险 / spectator 旁观 */
  gameMode: 'survival' | 'creative' | 'adventure' | 'spectator' = 'survival';
  /** /spawnpoint 设定的重生点（绝对坐标），null = 用场景默认出生点 */
  spawnPoint: THREE.Vector3 | null = null;

  mode: 'title' | 'play' | 'dialog' | 'showcase' | 'overlay' = 'title';
  activeNpc: NPCActor | null = null;

  // ───────── 多人联机 ─────────
  netCfg: NetConfig;
  net!: NetClient;
  remote!: RemotePlayers;
  private netStatus: NetStatus = 'off';
  private netToastAt = 0;
  private playersRefreshT = 0;

  private clock = new THREE.Clock();
  private padCooldown = 0;
  private nearPad: Pad | null = null;
  private npcCooldown = 0;
  /** 探索任务计时器（离出生点距离检查节流） */
  private exploreT = 0;

  private consoleOpen = false;
  private seed = Math.floor(Math.random() * 1_000_000_000);
  private rain: THREE.Points | null = null;
  private raining = false;
  private timeNorm = 0;
  private sceneHasStars = false;
  private playerLight: THREE.PointLight;

  private readonly canvas: HTMLCanvasElement;
  private isTouch = false;
  /** 无敌（Grayson 爽模式）：掉血/岩浆/窒息全部免疫 */
  private godMode = false;
  private landmarks = new Landmarks();

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    const boot = getActiveState();
    initSpeech(boot.state.speech);
    this.canvas = canvas;
    this.isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    // 触屏设备挂 is-touch：横屏提示与触控布局都靠这个类（与版本选择无关）
    if (this.isTouch) document.body.classList.add('is-touch');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.isTouch, powerPreference: 'high-performance' });
    // 手机上限制像素比，帧率优先
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.isTouch ? 1 : 1.6));
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
      onInvClick: (t, i) => this.onInvClick(t, i),
      onInvTab: (t) => this.onInvTab(t),
      onFart: () => this.fart(),
      onPause: (a) => this.onPauseAction(a),
      onChatlogClear: () => this.clearChatLog(),
      onEdition: (e) => this.setEdition(e),
      onGift: () => this.giveGift(),
      onEat: () => this.eatHeld(),
      onNetSave: (cfg) => this.saveNet(cfg),
      onLandscape: () => this.requestLandscape(),
      onNetInfo: () => ({
        enabled: this.netCfg.enabled,
        status: this.netStatus,
        room: this.net.room,
        broker: this.net.broker,
        players: this.net.getPlayers(),
        invite: this.net.inviteUrl(),
      }),
    });

    this.touch = new TouchControls(uiRoot, this.input, (a) => this.onTouchAction(a));
    // 触屏：命令台开着时点命令台外面（触屏层整体隐藏，点击会落到画布上）= 关闭，
    // 手机上多一条退路，横屏也照样管用
    canvas.addEventListener('pointerdown', () => {
      if (this.consoleOpen && this.isTouch) this.closeConsole();
    });
    this.sky.attach(this.scene);
    this.mobs.attach(this.scene);
    this.landmarks.attach(this.scene);
    this.vm.setSleeve(boot.meta.color);

    // ───────── 多人联机：URL ?room= 优先，其次玩家存档，最后默认 main ─────────
    const st0 = boot.state;
    const urlRoom = new URLSearchParams(location.search).get('room');
    this.netCfg = {
      enabled: st0.net?.enabled ?? true,
      broker: st0.net?.broker || DEFAULT_BROKER,
      room: sanitizeRoom(urlRoom || st0.net?.room || 'main'),
    };
    this.remote = new RemotePlayers();
    this.remote.attach(this.scene);
    this.net = new NetClient(this.netCfg, {
      onStatus: (s, detail) => this.onNetStatus(s, detail),
      onPlayer: (p) => {
        this.remote.upsert(p);
        this.refreshOnline();
      },
      onPlayerGone: (id) => {
        this.remote.remove(id);
        this.refreshOnline();
      },
      onChat: (m) => this.onNetChat(m),
      onEdit: (m) => this.applyNetEdit(m),
      onEvent: (m) => this.onNetEvent(m),
    });
    this.net.setIdentity(this.identity());
    // 胶囊先画一帧初始状态（避免关闭联机时顶栏空白）
    this.ui.setNetStatus(this.netCfg.enabled ? 'connecting' : 'off', this.netCfg.room, 0);
    if (this.netCfg.enabled) this.net.connect();
    // 页面隐藏/关闭：主动退出联机（broker 遗嘱会兜底异常断线）
    window.addEventListener('pagehide', () => this.net.disconnect());

    // 载入玩家存档（版本 / 背包 / 聊天 / 好感 / 成就）
    const st = boot.state;
    this.edition = st.edition ?? (this.isTouch ? 'bedrock' : 'java');
    if (st.inventory) this.inv.load(st.inventory);
    this.chatLog = st.chatLog ?? [];
    this.friendship = st.friendship ?? {};
    this.achievements = st.achievements ?? {};
    this.soundOn = st.sound;
    this.soundVolume = st.volume;
    sfx.setEnabled(this.soundOn);
    sfx.setVolume(this.soundVolume);

    // 浏览器要求：音频必须在一次真实手势里解锁
    const unlock = () => {
      sfx.unlock();
      if (this.soundOn) sfx.play('click');
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    // 崩落的方块碎屑
    this.buildParticles();

    this.scene.add(this.world.group, this.hemi, this.sun);
    this.sun.position.set(60, 120, 40);
    this.scene.fog = new THREE.FogExp2(0xcfe8ff, 0.008);

    // A soft light that follows the player — keeps dark scenes (caves, observatory) playable
    this.playerLight = new THREE.PointLight(0xfff2d6, 0.0, 22, 1.4);
    this.scene.add(this.playerLight);


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
    // 版本：第一次进游戏按设备自动选，之后用玩家存的
    const saved = getActiveState().state;
    const ed = saved.edition ?? (this.isTouch ? 'bedrock' : 'java');
    this.setEdition(ed);
    // 选中的版本按钮高亮
    const btn = document.querySelector(`.edition-btn[data-ed="${ed}"]`);
    document.querySelectorAll('.edition-btn').forEach((b) => b.classList.remove('active'));
    btn?.classList.add('active');
    // 背包开局为空（需求：空背包探索、自行收集合成）；创造模式有调色板可随取随用
    this.refreshHud();
    this.populateMobs();
    if (location.search.includes('autoplay')) this.start();
    this.loop();
  }

  private giveStarterKit(): void {
    const kit: string[] = ['grass', 'plank', 'stone_brick', 'brick', 'glass', 'lamp', 'wood', 'crafting_table', 'torch'];
    kit.forEach((k, i) => {
      this.inv.slots[i] = { key: k, count: 1 };
    });
  }

  start(): void {
    this.ui.hideTitle();
    this.mode = 'play';
    if (this.edition === 'java') this.input.requestLock();
    // 触屏设备：尽量锁横屏（Android/Chrome 有效；iOS 不支持会静默失败，由 CSS 提示手动旋转）
    if (this.isTouch) this.requestLandscape();
    // 移动端防护：误选 JAVA 版会没有触控按钮，这里提醒一句并指路
    if (this.isTouch && this.edition === 'java') {
      setTimeout(
        () =>
          this.ui.toast(
            '📱 检测到触屏设备：当前是 JAVA 键鼠版。点 ☰ 菜单 → Edition 可切换到 BEDROCK 触屏版（虚拟摇杆）',
            'warn',
            7000,
          ),
        900,
      );
    }
    // 致敬小小作者之一
    setTimeout(
      () =>
        this.ui.toast(
          '💙 这个世界由 Grayson 共同创作：去村庄东北角看看「Grayson 小屋」，广场西北角还有他的雕像！（/grayson 查看）',
          'info',
          7000,
        ),
      1400,
    );
    if (!this.progress.chatTurns) {
      setTimeout(() => this.playDemo('intro'), 300);
    } else {
      this.ui.toast('Welcome back! Press H for controls, M for the map', 'info', 5000);
    }
  }

  /** 尝试进入全屏并锁定横屏。必须在用户手势里调用；iOS 会静默失败（用横屏提示兜底） */
  private requestLandscape(): void {
    const lock = () => {
      try {
        (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape')?.catch?.(() => {});
      } catch {
        /* iOS Safari 不支持，忽略 */
      }
    };
    if (document.fullscreenElement) {
      lock();
      return;
    }
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().then(lock).catch(() => {});
  }

  // ───────── 生物 ─────────
  private populateMobs(): void {
    this.mobs.clear();
    const [sx, sz] = this.sceneDef.spawn;
    const table: Record<string, MobKind[]> = {
      village: ['cow', 'pig', 'sheep', 'chicken', 'dog', 'cat'],
      forest: ['pig', 'sheep', 'chicken', 'slime'],
      river: ['chicken', 'pig', 'sheep'],
      cave: ['slime'],
      observatory: ['cat'],
      lab: ['slime'],
    };
    const kinds = table[this.sceneDef.id] ?? ['chicken'];
    this.mobs.populate(kinds, this.world, sx, sz, this.isTouch ? 6 : 10);
  }

  /** 空手 / 拿着食物跟动物互动 */
  private interactMob(): boolean {
    const p = this.player.position;
    const m = this.mobs.nearest(p, this.player.forwardVector(), 3.0);
    if (!m) return false;
    const slot = this.heldSlot();
    const want = m.def.tameFood;
    if (slot && want && slot.key === want) {
      if (slot.count <= 1) this.inv.slots[this.hotbarIndex] = null;
      else slot.count -= 1;
      m.friendship++;
      sfx.play(m.def.sound);
      this.burst(m.position.x, m.position.y + 1, m.position.z, 0xffd27a, 6, 1.2);
      if (m.friendship >= 3 && !m.pet) {
        m.pet = true;
        sfx.play('levelup');
        this.ui.toast(`${m.def.icon} ${m.def.cn} is now your pet!`, 'good', 3800);
        this.unlock('pet', '🐾 You tamed a pet!');
      } else {
        this.ui.toast(`${m.def.icon} ${m.def.cn} liked the ${item(slot.key).cn}! (${m.friendship}/3)`, 'good', 2600);
      }
      this.refreshHud();
      this.saveAll();
      return true;
    }
    // 空手互动：收产品（有冷却）
    if (!slot && m.def.gift) {
      const now = performance.now();
      if (now - m.lastGift > 25000) {
        m.lastGift = now;
        this.collect(m.def.gift, 1);
        sfx.play(m.def.sound);
        this.ui.toast(`${m.def.icon} Got ${item(m.def.gift).name}!`, 'good', 2600);
        this.unlock('farm', '🥚 Your first farm product!');
        return true;
      }
      this.ui.toast(`${m.def.icon} ${m.def.cn} needs a little rest…`, 'info', 2200);
      return true;
    }
    sfx.play(m.def.sound);
    this.ui.toast(`${m.def.icon} ${m.def.cn} says hi!`, 'info', 2000);
    return true;
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
    this.renderPadBeacons();
    // 静态地标名牌（Grayson 小屋 / 雕像）——只对村庄场景挂
    this.landmarks.clear();
    if (scene.id === 'village') this.landmarks.buildVillage(this.world);
    if (scene.id === 'math') this.landmarks.buildMath(this.world);
    const spawnY = scene.groundY ?? this.world.groundY(scene.spawn[0], scene.spawn[1]);
    this.player.teleport(scene.spawn[0] + 0.5, spawnY + 0.6, scene.spawn[1] + 0.5);
    this.player.velocity.set(0, 0, 0);

    this.populateMobs();
    this.ui.setScene(scene, this.doneScenes.size);
    this.ui.renderQuests(scene.id, this.progress);
    if (!silent) this.ui.toast(`${scene.icon} ${scene.name} · ${scene.subtitle}`, 'info', 4200);
    // 新手最常见的卡点：在村里转半天找不到出口。传送台现在都有光柱信标，这里再口头点一句。
    if (scene.id === 'village') {
      setTimeout(
        () => this.ui.toast('💡 跟着彩色光柱走，踩上发光传送台就能出村（按 M 直接看地图）', 'info', 6500),
        600,
      );
    }
  }

  // ───────── 传送台信标：光柱 + 浮动图标，让出口在村口就看得见 ─────────
  private padBeacons: THREE.Group | null = null;

  private renderPadBeacons(): void {
    this.clearPadBeacons();
    if (!this.pads.length) return;
    const g = new THREE.Group();
    for (const pad of this.pads) {
      const y = (pad.y ?? this.world.groundY(pad.x, pad.z)) + 0.5;
      const isDemo = !!pad.demo;
      const color = isDemo ? 0x8be9ff : 0xffd27a;
      // 直达天际的柔光柱（像 MC 的信标），穿透雾气与地形
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.22, 60, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      beam.position.set(pad.x + 0.5, y + 28, pad.z + 0.5);
      beam.renderOrder = 2;
      g.add(beam);
      // 头顶浮动图标（emoji 画进 canvas 当贴图）
      const icon = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: padIconTexture(pad.label),
          transparent: true,
          depthTest: false,
          fog: false,
        }),
      );
      icon.position.set(pad.x + 0.5, y + 2.9, pad.z + 0.5);
      icon.scale.set(1.5, 1.5, 1);
      icon.renderOrder = 3;
      g.add(icon);
    }
    this.padBeacons = g;
    this.scene.add(g);
  }

  private clearPadBeacons(): void {
    if (!this.padBeacons) return;
    this.scene.remove(this.padBeacons);
    this.padBeacons.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
    this.padBeacons = null;
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
    // 天空：洞穴之类的室内场景没有天空，其他场景按场景默认时间摆放日月
    const indoor = scene.id === 'cave';
    this.sky.setEnabled(!indoor);
    this.setTimeOfDay(scene.night ? 0.78 : 0.08);
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
      // 换场景后立刻广播一次，让房间里的人知道我去哪了
      this.publishNetState(true);
      this.refreshOnline();
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
    // 聊天记录存档（玩家说的 + 村民回的）
    this.logChat(npc.personality.name, npc.personality.emoji, res.text, false);
    this.progress.chatTurns++;
    if (!isGreet) {
      this.bumpQuest((q) => q.kind === 'talk' && q.target === npc.personality.id);
    } else {
      this.bumpQuest((q) => q.kind === 'talk' && q.target === npc.personality.id);
    }
    saveProgress(this.progress);
  }

  private ask(text: string): void {
    const npc = this.activeNpc;
    if (!npc) return;
    this.ui.bubble('me', text);
    this.logChat('You', this.userMeta.avatar, text, true);
    void this.runTalk(npc, text);
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
    // 联机身份跟随当前玩家（改名/换头像/换颜色即时生效）
    this.net.setIdentity(this.identity());
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
          // 推理型模型（如 openai/gpt-oss-120b）会先把预算全花在思考上，
          // 测试必须给足 token，否则 content 为空、误判成「模型名错误」
          max_tokens: 800,
          messages: [{ role: 'user', content: '只回复两个字：成功' }],
        }),
      });
      if (!res.body) return `HTTP ${res.status}`;
      // 代理层把上游错误（404 模型不存在 / 401 密钥无效等）包装成 JSON 透传，
      // 必须先读出来，否则会被 SSE 解析器吞掉、误报成「empty reply」
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        let detail = txt.slice(0, 220);
        try {
          const j = JSON.parse(txt);
          detail = String(j?.error?.message || j?.error || detail);
        } catch {
          /* keep raw */
        }
        const groqHint = /groq/i.test(cfg.baseUrl)
          ? '。若用 Groq：地址填 https://api.groq.com/openai/v1，模型名如 llama-3.3-70b-versatile'
          : '';
        return `❌ ${res.status}：${detail.slice(0, 180)}${groqHint}`;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let out = '';
      let reasoning = '';
      let upstreamErr = '';
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const data = s.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            // 有的供应商用 200 + SSE 错误帧返回失败
            if (j?.error) upstreamErr = j.error?.message || JSON.stringify(j.error);
            out += j?.choices?.[0]?.delta?.content ?? '';
            reasoning += j?.choices?.[0]?.delta?.reasoning ?? j?.choices?.[0]?.delta?.reasoning_content ?? '';
          } catch {
            /* ignore partial packet */
          }
        }
      }
      if (upstreamErr) return `❌ Upstream error: ${upstreamErr.slice(0, 160)}`;
      if (out.trim()) return `✅ Connection OK, model replied: ${out.trim().slice(0, 20)}`;
      if (reasoning.trim()) {
        return '⚠️ 已连通，但这是个「推理型」模型：预算全耗在思考上，正文为空。NPC 对话建议换成对话模型（gpt-4o-mini / deepseek-chat / qwen-plus / grok-3-mini）';
      }
      return '⚠️ Connected but got empty reply — check the model name';
    } catch (e) {
      return `❌ Failed: ${(e as Error).message}`;
    }
  }

  private setHotbar(i: number): void {
    this.hotbarIndex = i;
    this.refreshHud();
  }

  // ───────── command console ─────────
  private openConsole(): void {
    if (this.mode !== 'play') return;
    this.consoleOpen = true;
    this.input.exitLock();
    this.ui.openConsole();
  }

  private closeConsole(): void {
    this.consoleOpen = false;
    this.ui.closeConsole();
    this.input.clearClicks(); // 吃掉关闭时的误触点击，避免顺手挖/放一个方块
    if (this.mode === 'play') this.input.requestLock();
  }

  // ───────── 多人联机 ─────────
  private identity(): Identity {
    return {
      id: this.userMeta.id,
      name: this.userMeta.name,
      avatar: this.userMeta.avatar,
      color: this.userMeta.color,
    };
  }

  private onNetStatus(s: NetStatus, detail?: string): void {
    this.netStatus = s;
    this.ui.setNetStatus(s, this.net.room, this.net.getPlayers().length);
    const now = performance.now();
    if (s === 'online') {
      this.ui.toast(`🌐 已联机 · 房间「${this.net.room}」`, 'good', 3000);
      this.refreshOnline();
    } else if (s === 'error' && now - this.netToastAt > 8000) {
      this.netToastAt = now;
      this.ui.toast(`🌐 联机失败：${detail || 'broker 暂时不可达'}（单人游玩不受影响）`, 'warn', 4800);
    } else if (s === 'off') {
      this.ui.toast('🌐 已退出联机（单人模式）', 'info', 2200);
      this.refreshOnline();
    }
  }

  private refreshOnline(): void {
    this.ui.setOnline(this.net.getPlayers().length);
  }

  /** 远程聊天：进聊天记录 + 头顶气泡 + 简短提示 */
  private onNetChat(m: ChatMsg): void {
    this.logChat(m.name, m.avatar, m.text, false);
    this.remote.say(m);
    this.ui.netChatLine(m);
  }

  /** 远程方块编辑：只应用到自己所在场景，忽略自己的回显 */
  private applyNetEdit(m: EditMsg): void {
    if (m.by === this.net.myId) return;
    if (m.scene !== this.sceneDef.id) return;
    if (this.world.get(m.x, m.y, m.z) === m.block) return;
    this.world.set(m.x, m.y, m.z, m.block);
  }

  private onNetEvent(m: EventMsg): void {
    if (m.scene !== this.sceneDef.id) return;
    if (m.kind === 'fart') {
      this.burst(m.x, m.y + 0.7, m.z, 0xb9d96a, 9, 1.2);
      sfx.play('fart');
      this.ui.toast(`💨 ${m.name} 放了个屁！`, 'info', 2600);
    } else if (m.kind === 'wave') {
      this.remote.wave(m.id);
      this.ui.toast(`👋 ${m.name} 向你挥手`, 'info', 2600);
    }
  }

  /** 每帧调用：内部按 120ms 节流广播位置，2s 一次心跳 */
  private publishNetState(force = false): void {
    if (!this.netCfg.enabled) return;
    const p = this.player.position;
    this.net.publishState(force, { scene: this.sceneDef.id, x: p.x, y: p.y, z: p.z, yaw: this.player.yaw });
  }

  /** 设置页保存联机配置（换 broker/房间会自动重连） */
  private saveNet(cfg: NetConfig): void {
    this.netCfg = { ...cfg, room: sanitizeRoom(cfg.room) };
    this.net.setConfig(this.netCfg);
    saveActive({ net: this.netCfg });
    this.refreshOnline();
  }

  /** 在线玩家面板数据 */
  netInfo(): {
    enabled: boolean;
    status: NetStatus;
    room: string;
    broker: string;
    players: PlayerState[];
    invite: string;
  } {
    return {
      enabled: this.netCfg.enabled,
      status: this.netStatus,
      room: this.net.room,
      broker: this.net.broker,
      players: this.net.getPlayers(),
      invite: this.net.inviteUrl(),
    };
  }

  /** 👋 挥手（V 键 / /wave） */
  wave(): void {
    const p = this.player.position;
    this.vm.swingLeft();
    this.net.event('wave', this.sceneDef.id, p.x, p.y, p.z);
    this.ui.toast('👋 你挥了挥手', 'info', 1800);
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
      // 不带 / 的输入 = 聊天：本地记录 + 广播给同房间的玩家
      this.ui.consolePrint('You (said): ' + line, 'me');
      this.ui.toast('📣 ' + line, 'info', 4000);
      this.net.chat(line);
      this.logChat('You', this.userMeta.avatar, line, true);
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
        out('           /wave (wave at online players)   /list online (who is online)', 'sys');
        out('【Info】    /list [scenes|npcs|players|blocks|online]   /seed      /summon <npc>', 'sys');
        out('【Life】    /kill (respawn)   /spawnpoint [x y z]   /setworldspawn [x y z]', 'sys');
        out('           /heal   /feed   /craft (inventory)   /bag   /fart   /pets   /mobs', 'sys');
        out('【Fun】     /cycle on|off (day-night)   /sound on|off   /volume <0-100>', 'sys');
        out('           /grayson (meet the co-author)   /edition java|bedrock', 'sys');
        out('Coordinates support MC-style ~ : e.g. /tp ~ ~10 ~   /setblock ~ ~1 ~ lamp', 'sys');
        out('Multiplayer: typing without / broadcasts to everyone in the room; block edits sync too.', 'sys');
        out('Keys: E inventory · I inventory · G fart · V wave · C left hand · F3 debug (Java) · ESC menu', 'sys');
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
        // 先按方块名找，找不到再按物品名找（工具、食物、资源都能给）
        const id = this.blockFromName(args[0] ?? '');
        const key = id !== null ? keyOfBlock(id) : hasItem(args[0] ?? '') ? (args[0] as string) : null;
        if (!key) return out(`Unknown item "${args[0]}". Try stone, glass, bread, wood_pickaxe`, 'err');
        const count = Math.max(1, Math.min(9999, num(args[1]) ?? 1));
        const left = this.inv.add(key, count);
        this.refreshHud();
        return out(`Gave you ${count - left} × ${item(key).name}${left ? ' (bag full!)' : ''}`, 'ok');
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
        this.refreshHud();
        return out('Hotbar reset to the default set', 'ok');
      }
      case 'god':
      case 'invincible':
      case 'godmode':
      case '无敌': {
        this.godMode = !this.godMode;
        this.refreshHud();
        if (this.godMode) {
          this.ui.toast('🛡️ 无敌模式 ON：摔不坏、岩浆烧不到、怪打不动（再输一次 /god 关闭）', 'good', 5000);
          return out('🛡️ God mode ON — fall damage / lava / mobs can no longer hurt you', 'ok');
        }
        this.ui.toast('🛡️ 无敌模式 OFF：小心脚下！', 'info', 3000);
        return out('🛡️ God mode OFF', 'ok');
      }
      case 'grayson':
      case 'author': {
        this.ui.toast('💙 Grayson 是这个世界的小小作者之一！他的小屋在村庄东北角（发光的蓝屋顶），雕像在广场西北角', 'good', 6500);
        out('💙 Grayson — co-author of BlockAcademy', 'me');
        out('· Grayson 小屋：村庄东北角，石英墙 + 蓝屋顶 + 水晶柱的那座', 'sys');
        out('· Grayson 雕像：村庄广场西北角，蓝衣举灯小人', 'sys');
        return;
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
      case 'wave':
        this.wave();
        return out('👋 You waved at everyone online', 'ok');
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
        if (what === 'online') {
          const ps = this.net.getPlayers();
          const status = this.netStatus === 'online' ? '🌐 在线' : '📴 未联机';
          out(`${status} · 房间「${this.net.room}」 · ${ps.length} 位在线玩家`, 'sys');
          for (const q of ps) out(`   ${q.avatar} ${q.name} — ${q.scene}`, 'sys');
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
      case 'fart':
        this.fart();
        return out('💨 Pffffft! (key: G)', 'me');
      case 'heal':
        this.health = this.maxHealth;
        this.ui.setStats(this.health, this.maxHealth, this.hunger, this.godMode);
        return out('Health restored', 'ok');
      case 'feed':
        this.hunger = 100;
        this.ui.setStats(this.health, this.maxHealth, this.hunger, this.godMode);
        return out('You are full', 'ok');
      case 'sound': {
        const v = (args[0] ?? '').toLowerCase();
        if (v !== 'on' && v !== 'off') return out('Usage: /sound on|off', 'err');
        this.soundOn = v === 'on';
        sfx.setEnabled(this.soundOn);
        this.saveAll();
        return out(`Sound ${v}`, 'ok');
      }
      case 'volume': {
        const n = num(args[0]);
        if (n === null) return out('Usage: /volume <0-100>', 'err');
        this.soundVolume = Math.max(0, Math.min(100, n)) / 100;
        sfx.setVolume(this.soundVolume);
        this.saveAll();
        return out(`Volume ${n}%`, 'ok');
      }
      case 'edition': {
        const v = (args[0] ?? '').toLowerCase();
        if (v !== 'java' && v !== 'bedrock') return out('Usage: /edition java|bedrock', 'err');
        this.setEdition(v);
        return out(v === 'bedrock' ? '📱 BEDROCK EDITION (touch)' : '🖥️ JAVA EDITION (keyboard & mouse)', 'ok');
      }
      case 'craft':
      case 'bag':
        this.openInventory();
        return out('Inventory opened', 'ok');
      case 'cycle': {
        const v = (args[0] ?? '').toLowerCase();
        if (v !== 'on' && v !== 'off') return out('Usage: /cycle on|off (day-night cycle)', 'err');
        this.cycleOn = v === 'on';
        return out(`Day-night cycle ${v}`, 'ok');
      }
      case 'mobs': {
        const kinds = new Map<string, number>();
        for (const m of this.mobs.mobs) kinds.set(m.def.cn, (kinds.get(m.def.cn) ?? 0) + 1);
        if (!kinds.size) return out('No mobs nearby', 'sys');
        for (const [k, n] of kinds) out(`${k} × ${n}`, 'sys');
        return;
      }
      case 'pets': {
        const pets = this.mobs.mobs.filter((m) => m.pet);
        if (!pets.length) return out('No pets yet — feed an animal 3 times!', 'sys');
        for (const m of pets) out(`${m.def.icon} ${m.def.cn}`, 'sys');
        return;
      }
      default:
        return out(`Unknown command "/${cmd}". Type /help`, 'err');
    }
  }

  private setTimeOfDay(norm: number): void {
    norm = Math.max(0, Math.min(1, norm));
    this.timeNorm = norm;
    this.sky.setTime(norm);
    const day = new THREE.Color(0x9ecbff);
    const night = new THREE.Color(0x070a16);
    const sky = day.clone().lerp(night, norm);
    (this.scene.background as THREE.Color).copy(sky);
    (this.scene.fog as THREE.FogExp2).color.copy(sky.clone().multiplyScalar(0.9));
    this.hemi.intensity = 0.95 - 0.78 * norm;
    this.hemi.color.setHex(norm > 0.5 ? 0x384a70 : 0xffffff);
    this.sun.intensity = 1.0 - 0.95 * norm;
    this.playerLight.intensity = norm > 0.5 ? 0.7 : this.sceneDef.ambient < 0.6 ? 1.0 : 0;
  }

  private get isNight(): boolean {
    return this.timeNorm > 0.62;
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
  private updateHighlight(): VoxelHit | null {
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
      this.hitResult = hit;
      return hit;
    }
    this.highlight.visible = false;
    this.hitResult = null;
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
    // 切到创造且背包为空时送一套起步方块（生存永远是空背包开局：自己伐木合成）
    if (m === 'creative' && !this.inv.slots.some((s) => s)) this.giveStarterKit();
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

  // ───────── 粒子：破坏碎屑 / 放屁 / 打怪 ─────────
  private buildParticles(): void {
    const n = 240;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    this.particles = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 0.17, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.particles.frustumCulled = false;
    this.particles.visible = false;
    this.scene.add(this.particles);
  }

  private burst(x: number, y: number, z: number, color: number, count = 10, spread = 2.2): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.pData.length >= 240) this.pData.shift();
      this.pData.push({
        p: new THREE.Vector3(x, y, z),
        v: new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * spread * 0.7 + 0.5,
          (Math.random() - 0.5) * spread,
        ),
        life: 0.6 + Math.random() * 0.6,
        c,
      });
    }
  }

  private updateParticles(dt: number): void {
    if (!this.particles) return;
    let n = 0;
    for (let i = this.pData.length - 1; i >= 0; i--) {
      const d = this.pData[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.pData.splice(i, 1);
        continue;
      }
      d.v.y -= 8 * dt;
      d.p.addScaledVector(d.v, dt);
    }
    const pos = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.particles.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (const d of this.pData) {
      pos.setXYZ(n, d.p.x, d.p.y, d.p.z);
      col.setXYZ(n, d.c.r, d.c.g, d.c.b);
      n++;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.particles.geometry.setDrawRange(0, n);
    this.particles.visible = n > 0;
  }

  // ───────── 背包与手持 ─────────
  private heldSlot(): Slot | null {
    return this.inv.slots[this.hotbarIndex];
  }
  private heldItem(): ItemDef | null {
    const s = this.heldSlot();
    return s ? item(s.key) : null;
  }

  private refreshHud(): void {
    this.ui.renderHotbar(this.inv, this.hotbarIndex);
    this.vm.setRight(this.heldSlot()?.key ?? null);
    this.vm.setLeft(this.inv.offhand?.key ?? null);
    this.ui.setStats(this.health, this.maxHealth, this.hunger, this.godMode);
  }

  /** 获得物品，背包满了会提示 */
  private collect(key: string, n = 1): void {
    const left = this.inv.add(key, n);
    if (left > 0) this.ui.toast(`🎒 Bag full — dropped ${item(key).name}`, 'warn', 2600);
    else sfx.play('xp');
  }

  // ───────── 挖掘 / 放置 ─────────
  private breakBlock(x: number, y: number, z: number): void {
    const id = this.world.get(x, y, z);
    if (id === 0) return;
    const d = blockDef(id);
    if (id === blocks.bedrock) {
      this.ui.toast('🛡 Bedrock cannot be broken!', 'warn', 2200);
      return;
    }
    this.world.set(x, y, z, 0);
    this.net.edit(this.sceneDef.id, x, y, z, 0);
    this.burst(x + 0.5, y + 0.5, z + 0.5, d.color, 12, 2.4);
    sfx.play('break');
    if (this.gameMode !== 'creative') {
      for (const k of breakDrop(id)) this.collect(k, 1);
      this.unlock('mine', '⛏ First block broken!');
    }
    this.bumpQuest((q) => q.kind === 'build');
  }

  private swingT = 0;
  private placeCd = 0;
  private hitResult: VoxelHit | null = null;

  private doMine(dt: number): void {
    const hit = this.updateHighlight();
    const click = this.input.takeClick(0);
    const held = this.input.mouseHeld(0);

    // 准星对着怪 → 先打怪
    if (click || (held && this.swingCd <= 0)) {
      const p = this.player.position;
      const foe = this.mobs.nearestHostile(p, this.player.forwardVector());
      if (foe && this.swingCd <= 0) {
        this.swingCd = 0.4;
        const it = this.heldItem();
        const dmg = it?.tool === 'sword' ? 4 + (it.tier ?? 0) * 2 : 2;
        this.vm.swingRight();
        this.mobs.strike(p, this.player.forwardVector(), dmg);
        sfx.play('pop');
        this.burst(foe.position.x, foe.position.y + 0.9, foe.position.z, 0x7a5cff, 10, 1.8);
        this.unlock('fight', '⚔️ You stood up to a Shadow!');
        if (!held) return;
      }
    }
    this.swingCd -= dt;

    if (!hit || !this.canEdit) {
      this.mineT = 0;
      return;
    }
    if (!click && !held) {
      this.mineT = 0;
      return;
    }
    const it = this.heldItem();
    let speed = 1;
    if (it?.tool && it.tool !== 'sword' && it.tool !== 'hoe') speed = 1.5 + (it.tier ?? 0) * 0.95;
    const need = this.gameMode === 'creative' ? 0.02 : 0.62 / speed;

    this.swingT -= dt;
    if (this.swingT <= 0) {
      this.swingT = 0.28;
      this.vm.swingRight();
      sfx.play('mine', Math.floor(Math.random() * 3));
    }
    this.mineT += dt;
    if (this.mineT >= need) {
      this.breakBlock(hit.x, hit.y, hit.z);
      this.mineT = 0;
    }
  }

  private doPlace(dt: number): void {
    const hit = this.hitResult;
    this.placeCd -= dt;
    if (!hit || !this.canEdit || this.placeCd > 0) return;
    const click = this.input.takeClick(2);
    const held = this.input.mouseHeld(2);
    if (!click && !held) return;
    const slot = this.heldSlot();
    if (!slot) return;
    const it = item(slot.key);
    if (it.block === undefined) {
      if (click) this.ui.toast(`${it.icon} ${it.name} can't be placed — put it in your ${'bag'} first`, 'warn', 2200);
      return;
    }
    const x = hit.x + hit.nx;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz;
    const px = this.player.position;
    const overlap =
      x + 1 > px.x - 0.34 && x < px.x + 0.34 && z + 1 > px.z - 0.34 && z < px.z + 0.34 && y + 1 > px.y && y < px.y + 1.8;
    if (overlap || y < 1) return;
    if (this.gameMode !== 'creative') {
      if (slot.count <= 1) this.inv.slots[this.hotbarIndex] = null;
      else slot.count -= 1;
    }
    this.world.set(x, y, z, it.block);
    this.net.edit(this.sceneDef.id, x, y, z, it.block);
    this.placeCd = 0.2;
    this.vm.swingRight();
    sfx.play('place');
    this.bumpQuest((q) => q.kind === 'build');
    this.refreshHud();
    // 好感满的村民会帮你一起搭
    this.villagerHelpsBuild(x, y, z);
  }

  /** 跟着你的村民会在旁边添一块，跟你一起盖房子 */
  private villagerHelpsBuild(x: number, y: number, z: number): void {
    if (!this.followers.size) return;
    const helper = this.npcs.find((n) => this.followers.has(n.personality.id));
    if (!helper) return;
    if (helper.position.distanceTo(this.player.position) > 5) return;
    if (Math.random() > 0.45) return;
    const dirs = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    const [dx, dy, dz] = dirs[Math.floor(Math.random() * dirs.length)];
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;
    if (this.world.get(nx, ny, nz) !== 0) return;
    const picks = [blocks.plank, blocks.brick, blocks.stoneBrick, blocks.woolWhite, blocks.glass];
    const id = picks[Math.floor(Math.random() * picks.length)];
    this.world.set(nx, ny, nz, id);
    this.net.edit(this.sceneDef.id, nx, ny, nz, id);
    this.burst(nx + 0.5, ny + 0.5, nz + 0.5, blockDef(id).color, 6, 1.2);
    sfx.play('place');
    this.ui.toast(`${helper.personality.emoji} ${helper.personality.name} helped you build!`, 'good', 2600);
    this.unlock('build2', '🏗️ Built together with a friend!');
  }

  // ───────── 生存：脚步 / 饥饿 / 摔落 / 战斗 ─────────
  private updateSurvival(dt: number): void {
    this.hurtCd -= dt;
    this.fartCd -= dt;

    // 脚步声
    if (this.player.moving && this.player.onGround && !this.player.fly) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.32;
        sfx.play('step', Math.floor(Math.random() * 3));
      }
    }

    // 摔落伤害
    if (!this.player.onGround) {
      this.fallFrom = Math.max(this.fallFrom, this.player.position.y);
    } else if (!this.wasOnGround) {
      const fall = this.fallFrom - this.player.position.y;
      if (fall > 4.5 && this.gameMode !== 'creative' && !this.player.fly) {
        this.damage(Math.round((fall - 4) * 2.2));
        sfx.play('land');
      }
      this.fallFrom = this.player.position.y;
    }
    this.wasOnGround = this.player.onGround;

    // 岩浆烫伤
    const p = this.player.position;
    const foot = this.world.get(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z));
    if (foot === blocks.lava) this.damage(6);

    // 饥饿与回血
    this.hunger = Math.max(0, this.hunger - dt * 0.2);
    this.regenT -= dt;
    if (this.regenT <= 0) {
      this.regenT = 1;
      if (this.hunger > 55) this.heal(1.5);
      else if (this.hunger <= 0) this.damage(1);
      this.ui.setStats(this.health, this.maxHealth, this.hunger, this.godMode);
    }

  }

  private swingLeft(): void {
    if (!this.vm.hasLeft) return;
    this.vm.swingLeft();
    sfx.play('equip');
    const p = this.player.position;
    const it = this.inv.offhand ? item(this.inv.offhand.key) : null;
    const dmg = it?.tool === 'sword' ? 4 + (it.tier ?? 0) * 2 : 2;
    const hits = this.mobs.strike(p, this.player.forwardVector(), dmg);
    if (hits) sfx.play('pop');
  }

  private damage(n: number): void {
    if (this.gameMode === 'creative' || this.gameMode === 'spectator') return;
    if (this.godMode) return; // 无敌模式：掉血/岩浆/摔落/窒息全部免疫
    if (this.hurtCd > 0) return;
    this.hurtCd = 0.4;
    this.health = Math.max(0, this.health - n);
    sfx.play('hurt');
    const p = this.player.position;
    this.burst(p.x, p.y + 1, p.z, 0xff4d4d, 8, 1.4);
    this.ui.setStats(this.health, this.maxHealth, this.hunger, this.godMode);
    if (this.health <= 0) this.die();
  }

  private heal(n: number): void {
    if (this.health >= this.maxHealth) return;
    this.health = Math.min(this.maxHealth, this.health + n);
  }

  private die(): void {
    this.health = this.maxHealth;
    this.hunger = 55;
    if (this.spawnPoint) {
      const s = this.spawnPoint;
      this.player.teleport(s.x + 0.5, s.y + 1.2, s.z + 0.5);
    } else {
      const [x, z] = this.sceneDef.spawn;
      this.player.teleport(x + 0.5, this.world.groundY(x, z) + 0.8, z + 0.5);
    }
    this.ui.bigTitle('💀 You died!');
    this.ui.toast('You woke up back at your spawn point. Your bag is safe.', 'warn', 4600);
    this.ui.setStats(this.health, this.maxHealth, this.hunger, this.godMode);
  }

  // ───────── 放屁 ─────────
  private fartCount = 0;
  fart(): void {
    if (this.fartCd > 0) return;
    this.fartCd = 0.85;
    this.fartCount++;
    sfx.play('fart');
    const p = this.player.position;
    const f = this.player.forwardVector();
    for (let i = 0; i < 3; i++) {
      this.burst(p.x - f.x * (0.4 + i * 0.2), p.y + 0.7, p.z - f.z * (0.4 + i * 0.2), 0xb9d96a, 9, 1.2);
    }
    for (const m of this.mobs.mobs) {
      if (m.position.distanceTo(p) < 7) m.scare(p.x, p.z, 5);
    }
    this.net.event('fart', this.sceneDef.id, p.x, p.y, p.z);
    if (this.fartCount === 1) this.unlock('fart', '💨 First toot!');
    if (this.fartCount === 25) this.unlock('fart25', '💨 Master of the wind!');
  }

  // ───────── 触控按钮 ─────────
  private onTouchAction(a: string): void {
    switch (a) {
      case 'fly':
        this.player.fly = !this.player.fly;
        this.ui.toast(this.player.fly ? '🪶 Flight on' : '🪶 Flight off', 'info', 2200);
        break;
      case 'fart':
        this.fart();
        break;
      case 'inventory':
        this.toggleInventory();
        break;
      case 'chat':
        // 💬 = 互动：命令台开着就关掉；有 NPC 就聊天，有传送台就传送，否则打开命令台
        if (this.consoleOpen) {
          this.closeConsole();
          break;
        }
        if (this.nearestNpc()) this.openDialog(this.nearestNpc()!);
        else if (this.nearPad) {
          const p = this.nearPad;
          if (p.demo) this.playDemo(p.demo);
          else if (p.goto) this.gotoScene(p.goto);
        } else {
          this.openConsole();
          this.ui.toast('身边没有 NPC，先打开了命令台（/help）', 'info', 2600);
        }
        break;
      case 'cmd':
        // ⌘ = 命令台开关（再点一次即关闭）
        if (this.consoleOpen) this.closeConsole();
        else this.openConsole();
        break;
      case 'menu':
        this.openPause();
        break;
      default:
        break;
    }
  }

  // ───────── 背包界面 ─────────
  private toggleInventory(): void {
    if (this.ui.isOverlayOpen('inventory')) this.closeInventory();
    else this.openInventory();
  }

  private openInventory(): void {
    if (this.mode !== 'play') return;
    sfx.play('open');
    this.ui.renderInventory(this.inv, this.gameMode === 'creative');
    this.ui.openOverlay('inventory');
    this.input.exitLock();
  }

  private closeInventory(): void {
    this.inv.clearCraft();
    this.inv.cursor = null;
    this.ui.closeOverlay('inventory');
    this.ui.renderInventory(this.inv, false);
    this.refreshHud();
    this.saveAll();
    if (this.edition === 'java') this.input.requestLock();
  }

  /** 附近有没有这种方块（工作台 / 熔炉的判定） */
  private nearBlock(id: number, r = 6): boolean {
    const p = this.player.position;
    const x0 = Math.floor(p.x);
    const y0 = Math.floor(p.y);
    const z0 = Math.floor(p.z);
    for (let x = x0 - r; x <= x0 + r; x++)
      for (let y = Math.max(1, y0 - 3); y <= Math.min(this.world.sy - 1, y0 + 3); y++)
        for (let z = z0 - r; z <= z0 + r; z++) if (this.world.get(x, y, z) === id) return true;
    return false;
  }

  private onInvTab(tab: Tab): void {
    if (tab === 'craft' && !this.nearBlock(blocks.craftingTable)) {
      this.ui.toast('🪚 Place a crafting table nearby first!', 'warn', 3000);
      return;
    }
    if (tab === 'furnace' && !this.nearBlock(blocks.furnace)) {
      this.ui.toast('🔥 Place a furnace nearby first!', 'warn', 3000);
      return;
    }
    this.inv.tab = tab;
    sfx.play('click');
    this.ui.renderInventory(this.inv, this.gameMode === 'creative');
  }

  private paletteKeys(): string[] {
    if (!this.paletteCache) this.paletteCache = blockItems().map((i) => i.key);
    return this.paletteCache;
  }
  private paletteCache: string[] | null = null;

  private slotGet(target: InvTarget, index: number): Slot | null {
    const inv = this.inv;
    if (target === 'storage' || target === 'hotbar') return inv.slots[index];
    if (target === 'craft') return inv.craft[index];
    if (target === 'offhand') return inv.offhand;
    if (target === 'fin') return inv.furnaceIn;
    return null;
  }

  private slotSet(target: InvTarget, index: number, s: Slot | null): void {
    const inv = this.inv;
    if (target === 'storage' || target === 'hotbar') inv.slots[index] = s;
    else if (target === 'craft') inv.craft[index] = s;
    else if (target === 'offhand') inv.offhand = s;
    else if (target === 'fin') inv.furnaceIn = s;
  }

  private onInvClick(target: InvTarget, index: number): void {
    const inv = this.inv;
    const creative = this.gameMode === 'creative';

    if (target === 'out' || target === 'fout') {
      this.takeCraftResult();
      return;
    }
    if (target === 'palette') {
      // 创造模式的物品栏：点一下就拿一组，不消耗
      const key = this.paletteKeys()[index];
      if (key) inv.cursor = { key, count: 1 };
      this.ui.renderInventory(inv, creative);
      return;
    }

    const cur = inv.cursor;
    const slot = this.slotGet(target, index);
    if (!cur) {
      if (slot) {
        this.slotSet(target, index, null);
        inv.cursor = slot;
      }
    } else if (!slot) {
      this.slotSet(target, index, { key: cur.key, count: cur.count });
      inv.cursor = null;
    } else if (slot.key === cur.key) {
      const max = item(cur.key).stack;
      const put = Math.min(max - slot.count, cur.count);
      slot.count += put;
      cur.count -= put;
      if (cur.count <= 0) inv.cursor = null;
    } else {
      this.slotSet(target, index, cur);
      inv.cursor = slot;
    }
    sfx.play('click');
    this.ui.renderInventory(inv, creative);
    this.refreshHud();
    this.saveAll();
  }

  private takeCraftResult(): void {
    const inv = this.inv;
    const r = inv.craftResult;
    if (!r) return;
    if (inv.tab === 'craft' && !this.nearBlock(blocks.craftingTable)) return;
    if (inv.tab === 'furnace' && !this.nearBlock(blocks.furnace)) return;

    if (inv.tab === 'furnace') {
      if (inv.furnaceIn) {
        inv.furnaceIn.count -= 1;
        if (inv.furnaceIn.count <= 0) inv.furnaceIn = null;
      }
    } else {
      const ids = inv.tab === 'craft' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 3, 4];
      for (const i of ids) {
        const s = inv.craft[i];
        if (!s) continue;
        s.count -= 1;
        if (s.count <= 0) inv.craft[i] = null;
      }
    }

    const got: Slot = { key: r.key, count: r.count };
    if (inv.cursor && inv.cursor.key === got.key) {
      const max = item(got.key).stack;
      const put = Math.min(max - inv.cursor.count, got.count);
      inv.cursor.count += put;
      if (put < got.count) inv.add(got.key, got.count - put);
    } else if (inv.cursor) {
      if (inv.add(got.key, got.count) > 0) this.ui.toast('🎒 Bag is full!', 'warn', 2400);
    } else {
      inv.cursor = got;
    }
    sfx.play(inv.tab === 'furnace' ? 'craft' : 'craft');
    this.unlock('craft', '🔨 Your first craft!');
    if (item(r.key).tool) this.unlock('tool', '⛏ A tool of your own!');
    this.ui.renderInventory(inv, this.gameMode === 'creative');
    this.refreshHud();
    this.saveAll();
  }

  // ───────── 暂停菜单 ─────────
  private openPause(): void {
    if (this.mode !== 'play') return;
    this.input.exitLock();
    this.ui.setPauseLabels({
      mode: this.gameMode[0].toUpperCase() + this.gameMode.slice(1),
      edition: this.edition === 'bedrock' ? 'BEDROCK' : 'JAVA',
      sound: this.soundOn,
      scene: `${this.sceneDef.icon} ${this.sceneDef.name}`,
      player: `${this.userMeta.avatar} ${this.userMeta.name}`,
    });
    this.ui.openPause();
    sfx.play('open');
  }

  private onPauseAction(a: PauseAction): void {
    switch (a) {
      case 'resume':
        this.ui.closeOverlay('pause');
        if (this.edition === 'java') this.input.requestLock();
        break;
      case 'gamemode':
        this.ui.closeOverlay('pause');
        this.cycleGameMode();
        break;
      case 'inventory':
        this.ui.closeOverlay('pause');
        this.openInventory();
        break;
      case 'chatlog':
        this.ui.renderChatLog(
          this.chatLog.map((c) => ({ ...c, at: new Date(c.at).toLocaleTimeString() })),
        );
        this.ui.openOverlay('chatlog');
        break;
      case 'players':
        this.ui.closeOverlay('pause');
        this.ui.openPlayers();
        break;
      case 'help':
        this.ui.closeOverlay('pause');
        this.ui.openOverlay('help');
        break;
      case 'settings':
        this.ui.closeOverlay('pause');
        this.ui.openSettings();
        break;
      case 'sound':
        this.soundOn = !this.soundOn;
        sfx.setEnabled(this.soundOn);
        this.ui.setPauseLabels({
          mode: this.gameMode[0].toUpperCase() + this.gameMode.slice(1),
          edition: this.edition === 'bedrock' ? 'BEDROCK' : 'JAVA',
          sound: this.soundOn,
          scene: `${this.sceneDef.icon} ${this.sceneDef.name}`,
          player: `${this.userMeta.avatar} ${this.userMeta.name}`,
        });
        this.saveAll();
        break;
      case 'edition':
        this.ui.closeOverlay('pause');
        this.setEdition(this.edition === 'bedrock' ? 'java' : 'bedrock');
        break;
      case 'title':
        this.ui.closeOverlay('pause');
        this.backToTitle();
        break;
    }
  }

  private backToTitle(): void {
    this.saveAll();
    this.mode = 'title';
    this.ui.closeAllOverlays();
    this.ui.showTitle();
    this.ui.setTitlePlayer(this.userMeta);
    this.input.exitLock();
  }

  private cycleGameMode(): void {
    const order = ['creative', 'survival', 'adventure', 'spectator'] as const;
    const i = order.indexOf(this.gameMode);
    const label = this.setGameMode(order[(i + 1) % order.length]);
    this.ui.toast(`🎮 ${label}`, 'info', 3500);
  }

  private setEdition(e: 'java' | 'bedrock'): void {
    this.edition = e;
    this.input.virtualLock = e === 'bedrock';
    this.touch.setEnabled(e === 'bedrock');
    document.body.classList.toggle('touch-mode', e === 'bedrock');
    this.ui.toast(
      e === 'bedrock' ? '📱 BEDROCK EDITION · touch controls on' : '🖥️ JAVA EDITION · keyboard & mouse',
      'info',
      3600,
    );
    if (e === 'bedrock') this.input.exitLock();
    this.saveAll();
  }

  // ───────── 记录与成就 ─────────
  private saveAll(): void {
    saveActive({
      edition: this.edition,
      inventory: this.inv.serialize(),
      chatLog: this.chatLog,
      friendship: this.friendship,
      achievements: this.achievements,
      sound: this.soundOn,
      volume: this.soundVolume,
      net: this.netCfg,
    });
  }

  /** 吃掉手上拿的食物（饥饿越高回血越快） */
  private eatHeld(): void {
    const slot = this.heldSlot();
    if (!slot) {
      this.ui.toast('🍽 Nothing to eat in your hand', 'warn', 2200);
      return;
    }
    const it = item(slot.key);
    if (!it.heal) {
      this.ui.toast(`${it.icon} ${it.name} is not food!`, 'warn', 2400);
      return;
    }
    if (slot.count <= 1) this.inv.slots[this.hotbarIndex] = null;
    else slot.count -= 1;
    this.hunger = Math.min(100, this.hunger + it.heal * 8);
    this.heal(it.heal * 2);
    sfx.play('eat');
    sfx.play('xp');
    this.ui.toast(`🍽 Ate ${it.name} (+${it.heal * 8} food)`, 'good', 2400);
    // 魔法豆：吃完必放屁
    if (slot.key === 'bean') setTimeout(() => this.fart(), 400);
    this.unlock('eat', '🍞 First meal!');
    this.ui.setStats(this.health, this.maxHealth, this.hunger, this.godMode);
    this.refreshHud();
    this.saveAll();
  }

  private logChat(who: string, emoji: string, text: string, me: boolean): void {
    this.chatLog.push({ who, emoji, text, me, at: Date.now() });
    if (this.chatLog.length > 400) this.chatLog = this.chatLog.slice(-300);
    this.saveAll();
  }

  private clearChatLog(): void {
    this.chatLog = [];
    this.ui.renderChatLog([]);
    this.saveAll();
  }

  private unlock(id: string, label: string): void {
    if (this.achievements[id]) return;
    this.achievements[id] = Date.now();
    this.ui.toast(`🏆 ${label}`, 'good', 4200);
    sfx.play('levelup');
    this.saveAll();
  }

  /** 把手里拿的东西送给面前的村民 */
  private giveGift(): void {
    const npc = this.activeNpc;
    if (!npc) {
      this.ui.bubble('sys', '🎁 Walk up to a resident first.');
      return;
    }
    const slot = this.heldSlot();
    if (!slot) {
      this.ui.bubble('sys', '🎁 You need to hold something to give.');
      return;
    }
    const it = item(slot.key);
    const id = npc.personality.id;
    const before = this.friendship[id] ?? 0;
    this.friendship[id] = before + 1;
    if (slot.count <= 1) this.inv.slots[this.hotbarIndex] = null;
    else slot.count -= 1;
    sfx.play('ding');
    const f = Math.min(3, this.friendship[id]);
    this.ui.bubble('sys', `🎁 ${npc.personality.name} loves the ${it.name}! Friendship ${f}/3`);
    if (this.friendship[id] >= 3 && before < 3) {
      this.unlock('friend', '🤝 You made a best friend!');
      this.ui.bubble('sys', `🤝 ${npc.personality.name} says: "I'll come with you!"`);
      this.followers.add(id);
    }
    this.logChat('You', '🙂', `Gave ${it.name} to ${npc.personality.name}`, true);
    this.refreshHud();
    this.saveAll();
  }

  private followers = new Set<string>();
  private wasPointer = false;
  private fpsN = 0;
  private fps = 0;

  /** 好感满 3 颗心的村民会跟着你走 */
  private updateFollowers(dt: number): void {
    if (!this.followers.size) return;
    const p = this.player.position;
    let i = 0;
    for (const n of this.npcs) {
      if (!this.followers.has(n.personality.id)) continue;
      const to = new THREE.Vector3().subVectors(p, n.position);
      to.y = 0;
      const d = to.length();
      if (d > 7) {
        // 太远就直接传送到身边，避免跟丢
        n.position.set(p.x + Math.cos(i) * 1.8, this.world.groundY(Math.floor(p.x), Math.floor(p.z)), p.z + Math.sin(i) * 1.8);
      } else if (d > 2.4) {
        to.normalize().multiplyScalar(dt * 2.2);
        n.position.x += to.x;
        n.position.z += to.z;
        n.position.y = this.world.groundY(Math.floor(n.position.x), Math.floor(n.position.z));
      }
      i++;
    }
  }

  /** JAVA 版的 F3 调试屏 */
  private updateF3(): void {
    this.fpsN++;
    const now = performance.now();
    if (!this.f3Last) this.f3Last = now;
    if (now - this.f3Last > 500) {
      this.fps = Math.round((this.fpsN * 1000) / (now - this.f3Last));
      this.fpsN = 0;
      this.f3Last = now;
    }
    if (!this.f3On) return;
    const p = this.player.position;
    const d = this.player.forwardVector();
    const facing =
      Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? 'East (+X)' : 'West (-X)') : d.z > 0 ? 'South (+Z)' : 'North (-Z)';
    const mobs = this.mobs.mobs.length;
    const held = this.heldItem();
    this.ui.setF3(
      true,
      [
        `BlockAcademy — JAVA EDITION`,
        `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `Facing: ${facing}   Biome: ${this.sceneDef.name}`,
        `Game mode: ${this.gameMode}   Seed: ${this.seed}`,
        `Time: ${(this.timeNorm * 100).toFixed(0)}% dark   ${this.isNight ? 'Night' : 'Day'}`,
        `HP: ${Math.round(this.health)}/${this.maxHealth}   Food: ${Math.round(this.hunger)}`,
        `FPS: ${this.fps}   Entities: ${mobs + this.npcs.length}`,
        `Held: ${held ? held.name : 'Empty hand'}`,
        `Edition: ${this.edition.toUpperCase()}`,
      ].join('<br>'),
    );
  }
  private f3Last = 0;

  // ───────── 主循环 ─────────
  private loop(): void {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    const asp = innerWidth / innerHeight;
    this.camera.aspect = asp;
    this.vm.setAspect(asp);

    if (this.mode === 'showcase') {
      this.showcase.update(dt, asp);
      this.renderer.render(this.showcase.scene, this.showcase.camera);
      this.input.endFrame();
      return;
    }

    const frozen =
      this.mode !== 'play' || this.consoleOpen || this.ui.anyOverlayOpen() || !this.input.locked;

    // 触屏层：只要有界面开着（命令台/物品栏/菜单/对话框）就整体关掉，
    // 否则摇杆和视角区会盖在界面上，打字时蹭一下就乱转视角。
    const wantTouch =
      this.edition === 'bedrock' &&
      this.mode === 'play' &&
      !this.consoleOpen &&
      !this.ui.anyOverlayOpen() &&
      !this.ui.isConsoleOpen();
    if (wantTouch !== this.touch.enabled) this.touch.setEnabled(wantTouch);
    this.player.update(dt, this.input, this.world, frozen);
    this.player.applyCamera(this.camera);
    this.playerLight.position.copy(this.camera.position);
    // 多人联机：广播自己的位置（内部节流），驱动远程玩家化身
    this.publishNetState();
    this.remote.update(dt, performance.now(), this.sceneDef.id);
    // 在线玩家面板打开时每秒刷新
    if (this.ui.isOverlayOpen('players')) {
      this.playersRefreshT -= dt;
      if (this.playersRefreshT <= 0) {
        this.playersRefreshT = 1;
        this.ui.renderNetPlayers(this.netInfo());
      }
    }
    if (this.rain && this.rain.visible) this.updateRain(dt);

    const t = performance.now() / 1000;
    for (const n of this.npcs) n.update(dt, t, this.world, this.player.position, frozen);
    this.mobs.update(dt, this.world, this.player.position, {
      night: this.isNight,
      onDamage: (n) => this.damage(n),
    });
    this.checkProximity();

    // 昼夜循环（默认关闭，可用 /time cycle on 或菜单打开）
    if (this.cycleOn && !frozen) this.setTimeOfDay((this.timeNorm + dt / 900) % 1);

    this.handleKeys();
    if (!frozen) {
      this.doMine(dt);
      this.doPlace(dt);
      const w = this.input.takeWheel();
      if (w) this.setHotbar((this.hotbarIndex - w + 9) % 9);
      this.updateSurvival(dt);
    } else {
      this.highlight.visible = false;
      this.hitResult = null;
    }

    this.sky.update(dt, this.camera.position);
    this.updateParticles(dt);
    this.world.flushDirty(this.isTouch ? 2 : 3);

    const moving = this.player.moving && this.player.onGround;
    this.vm.update(dt, moving);
    this.updateHint();
    this.updateFollowers(dt);
    this.updateF3();

    // 探索任务：离场景出生点越远越好（每 0.5s 检查一次，走够 30 格即完成）
    if (!frozen && this.mode === 'play') {
      this.exploreT += dt;
      if (this.exploreT > 0.5) {
        this.exploreT = 0;
        const sp = this.sceneDef.spawn;
        const d = Math.hypot(this.player.position.x - sp[0], this.player.position.z - sp[1]);
        if (d > 30) this.bumpQuest((q) => q.kind === 'explore', 'Keep walking — there is more to find!');
      }
    }

    // JAVA 版：ESC 会自动解除指针锁定，这时就弹出暂停菜单
    if (this.edition === 'java' && this.mode === 'play' && !this.consoleOpen) {
      if (this.wasPointer && !this.input.realLocked && !this.ui.anyOverlayOpen()) this.openPause();
      else if (!this.wasPointer && this.input.realLocked) this.ui.closeOverlay('pause');
      this.wasPointer = this.input.realLocked;
    }

    this.renderer.render(this.scene, this.camera);
    this.vm.render(this.renderer);
    this.input.endFrame();
  }

  private handleKeys(): void {
    const i = this.input;
    // 命令台开着时：输入框自己处理打字；焦点移出后按 T / ESC 也能关
    if (this.consoleOpen) {
      if (i.pressed('KeyT') || i.pressed('Escape')) this.closeConsole();
      return;
    }
    if (this.mode === 'play' && this.input.locked && (i.pressed('KeyT') || i.pressed('Slash'))) {
      this.openConsole();
      return;
    }
    for (let k = 0; k < 9; k++) {
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
    // 《我的世界》键位：E 打开物品栏（面前有 NPC / 演示台时优先互动）
    if (i.pressed('KeyE')) {
      if (this.nearPad) {
        const p = this.nearPad;
        if (p.demo) this.playDemo(p.demo);
        else if (p.goto) this.gotoScene(p.goto);
      } else if (this.nearestNpc()) {
        this.openDialog(this.nearestNpc()!);
      } else if (!this.interactMob()) {
        this.toggleInventory();
      }
    }
    if (i.pressed('KeyI')) this.toggleInventory();
    if (i.pressed('KeyG')) this.fart();
    if (i.pressed('KeyV')) this.wave();
    if (i.pressed('KeyC')) this.swingLeft();
    if (i.pressed('F3') && this.edition === 'java') this.f3On = !this.f3On;
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
    // 走到 Grayson 小屋附近：解锁「拜访作者小屋」成就
    if (this.sceneDef.id === 'village' && Math.hypot(78.5 - p.x, 90.5 - p.z) < 8) {
      this.unlock('grayson_house', "💙 Visited Grayson's House — hi, co-author!");
    }
    this.ui.hint(null);
    if (this.npcCooldown++ > 60) this.npcCooldown = 0;
  }

  private padCooldownTick(): void {
    if (this.padCooldown > 0) this.padCooldown--;
  }
}

/** 信标浮动图标：把 label 里的 emoji 画进一张canvas，做成 sprite 贴图（按 label 缓存） */
const padIconCache = new Map<string, THREE.CanvasTexture>();
function padIconTexture(label: string): THREE.CanvasTexture {
  const cached = padIconCache.get(label);
  if (cached) return cached;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  // 深色圆底，保证任何天空背景下都看得清
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 16, 28, 0.72)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.stroke();
  const emoji = (label.match(/^\S+/) ?? ['🗺️'])[0];
  ctx.font = '72px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  padIconCache.set(label, tex);
  return tex;
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;
const game = new Game(canvas, uiRoot);
game.boot();

export { game };
