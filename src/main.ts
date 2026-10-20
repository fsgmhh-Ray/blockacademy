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
import { ChestStore, CHEST_SLOTS } from './world/chests';
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
  addCoins,
  grantPass,
  hasPass,
  isUnlocked,
  unlockItem,
  setGrade as setProfileGrade,
  setOutfit as setProfileOutfit,
  setParentSettings,
  setPassword,
  bumpExpansion,
  profileIsLocked,
  checkProfilePassword,
  type ProfileMeta,
  type ChatEntry,
  type ParentSettings,
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

/**
 * Web Speech API 的最小类型声明。
 * 浏览器（Chrome / Edge / Safari）自带，TypeScript 的 lib 里没有，所以自己写一份。
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: { [index: number]: SpeechRecognitionResultLike; length: number };
}
interface SpeechRecognitionErrorLike {
  error?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

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
import { PASSES, passById, COINS_PER_TASK, COINS_PER_LESSON, type Pass } from './edu/shop';
import { emoteById } from './edu/emotes';
import { quizById } from './edu/quizzes';
import { unlockFor } from './edu/unlocks';
import { clampGrade, GRADE_BANDS } from './edu/grades';
import { normalizeOutfit, type Outfit } from './user/wardrobe';
import { hashPin, verifyPin, validPin } from './user/parent';
import { scrub, blockedReason } from './net/wordfilter';
import { expandWorld, EXPANSION_BANNER } from './world/expansion';
import { buildRecipeBook } from './craft/recipeBook';

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
  /** 通行证效果：护盾 / 加速 / 夜视 */
  private shieldOn = false;
  private speedBoost = false;
  private nightVision = false;
  /** 换装后需要重新广播一次外观 */
  private outfitChanged = false;

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
      onProfiles: () => ({
        list: listProfiles(),
        activeId: activeProfileId() ?? '',
        locked: Object.fromEntries(listProfiles().map((m) => [m.id, profileIsLocked(m.id)])),
      }),
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
      onParentChange: (patch) => this.applyParentSettings(patch),
      onParentUnlocked: () => this.ui.toast('🔓 Parent settings unlocked', 'good', 1800),
      onBuyPass: (id) => this.buyPass(id),
      onQuizUnlock: (itemKey, correct) => this.onQuizAnswer(itemKey, correct),
      onOutfit: (o) => this.setOutfit(o),
      onGrade: (g) => this.setGrade(g),
      onCook: (out) => this.cookFromBook(out),
      onEmote: (id) => this.playEmote(id),
      onVoice: (text) => this.onVoiceText(text),
      onMicToggle: () => this.toggleMic(),
      onUnlockProfile: (id, hash) => this.onProfileUnlocked(id, hash),
      onSetPassword: (hash) => {
        setPassword(hash);
        this.ui.toast('🔒 Account password saved', 'good', 2200);
      },
      onChestClose: () => this.closeChest(),
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
    this.chests = new ChestStore(st.chests);
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
    this.ui.renderMap(SCENES, this.sceneDef.id, this.progress, this.doneScenes, this.playerGrade());
    this.ui.renderQuests(this.sceneDef.id, this.progress, this.playerGrade());
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
            '📱 Touch device detected: you are on the JAVA keyboard & mouse edition. Open the ☰ menu → Edition to switch to BEDROCK touch edition (virtual joystick)',
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
          '💙 This world was co-created by Grayson: visit "Grayson\'s Cottage" in the northeast corner of the village, and find his statue in the northwest of the square! (type /grayson)',
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
      const q = questsOf(scene.id, this.playerGrade()).find((x) => x.kind === 'talk' && x.target === n.personality.id);
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
    this.ui.renderQuests(scene.id, this.progress, this.playerGrade());
    if (!silent) this.ui.toast(`${scene.icon} ${scene.name} · ${scene.subtitle}`, 'info', 4200);
    // 新手最常见的卡点：在村里转半天找不到出口。传送台现在都有光柱信标，这里再口头点一句。
    if (scene.id === 'village') {
      setTimeout(
        () => this.ui.toast('💡 Follow the colored light beams and step on a glowing teleport pad to leave the village (press M for the map)', 'info', 6500),
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
      this.ui.renderMap(SCENES, id, this.progress, this.doneScenes, this.playerGrade());
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
    const q = questsOf(this.sceneDef.id, this.playerGrade()).find((x) => x.kind === 'demo' && x.target === id);
    if (q) this.completeQuest(q, 'Demo watched');
    if (id === 'intro') {
      this.ui.toast(
        this.edition === 'bedrock'
          ? 'Walk up to any resident and tap 💬 (or the green TALK button) to chat with them'
          : 'Walk up to any resident and press E to chat with them',
        'good',
        6000,
      );
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
    for (const q of questsOf(this.sceneDef.id, this.playerGrade())) {
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
    this.ui.renderQuests(this.sceneDef.id, this.progress, this.playerGrade());
    for (const n of this.npcs) {
      const q = questsOf(this.sceneDef.id, this.playerGrade()).find((x) => x.kind === 'talk' && x.target === n.personality.id);
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
    this.ui.renderQuests(this.sceneDef.id, this.progress, this.playerGrade());
    saveProgress(this.progress);
    // 完成任务 = 得金币 + 世界扩张
    this.rewardForTask(q);
  }

  /**
   * 任务奖励：金币 + 世界扩张。
   * 世界每次扩张都会在场景里多搭出一样东西，让「学习让世界变大」看得见。
   */
  private rewardForTask(q: Quest): void {
    const coins = addCoins(COINS_PER_TASK);
    this.ui.toast(`🪙 +${COINS_PER_TASK} coins (you have ${coins})`, 'good', 2600);

    const level = bumpExpansion();
    const scene = SCENE_BY_ID.get(this.sceneDef.id);
    const cx = scene?.spawn?.[0] ?? 0;
    const cz = scene?.spawn?.[1] ?? 0;
    const built = expandWorld(this.world, level, this.sceneDef.id, cx, cz);
    this.ui.toast(`🌍 ${EXPANSION_BANNER}`, 'info', 4200);
    if (built) this.ui.toast(`${built.icon} ${built.name} — ${built.desc}`, 'good', 4200);
  }

  // ───────── 对话 ─────────
  private sceneContext(): SceneContext {
    return {
      sceneId: this.sceneDef.id,
      sceneName: `${this.sceneDef.name} (${this.sceneDef.subtitle})`,
      topics: this.sceneDef.topics,
      nearby: this.pads.slice(0, 3).map((p) => p.label.replace(/^\S+\s*/, '')),
      grade: this.playerGrade(),
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

  // ══════════════ 新增系统：家长控制 / 金币商店 / 答题解锁 / 换装 / 年级 / 表情 / 麦克风 ══════════════

  /** 家长设置里的敏感词过滤是否开启（运行时缓存） */
  private wordFilterOn = true;
  /** 家长设置的每日聊天上限（分钟，0 = 不限） */
  private chatLimit = 0;
  /** 今天已经用掉的聊天分钟数 */
  private chatUsedToday = 0;
  /** 表情：当前播放中的动画 */
  private emoteId = '';
  private emoteUntil = 0;
  /** 语音识别实例 */
  private recog: SpeechRecognitionLike | null = null;
  private micActive = false;
  /** 麦克风识别到的文字，用来判断是发给 NPC 还是发给房间 */
  private voiceTarget: 'npc' | 'room' = 'room';

  /** 当前玩家的年级（决定任务/知识难度） */
  private playerGrade(): number {
    return getActiveState().state.grade;
  }

  // ───────── 面板入口 ─────────
  openParentPanel(): void {
    const st = getActiveState().state;
    const list = questsOf(this.sceneDef.id, this.playerGrade());
    const done = list.filter((q) => isDone(q, this.progress)).length;
    this.ui.openParent(st.parent, { coins: st.coins, done, total: list.length });
  }

  openShopPanel(): void {
    const st = getActiveState().state;
    this.ui.openShop(st.coins, st.passes);
  }

  openBookPanel(): void {
    const counts: Record<string, number> = {};
    for (const s of this.inv.slots) if (s) counts[s.key] = (counts[s.key] ?? 0) + s.count;
    if (this.inv.offhand) counts[this.inv.offhand.key] = (counts[this.inv.offhand.key] ?? 0) + this.inv.offhand.count;
    this.ui.openBook(counts);
  }

  openWardrobePanel(): void {
    this.ui.openWardrobe(getActiveState().state.outfit);
  }

  // ───────── 家长设置 ─────────
  private applyParentSettings(patch: Partial<ParentSettings>): void {
    setParentSettings(patch);
    const st = getActiveState().state;
    this.wordFilterOn = st.parent.wordFilter;
    this.chatLimit = st.parent.chatMinutes;
    if (patch.multiplayer !== undefined) {
      this.netCfg.enabled = st.parent.multiplayer;
      if (this.netCfg.enabled) this.net.connect();
      else this.net.disconnect();
    }
    if (patch.ai !== undefined && this.llm.enabled && !st.parent.ai) {
      this.llm.enabled = false;
      saveLLMConfig(this.llm);
    }
    if (patch.chatMinutes !== undefined) this.chatLimit = st.parent.chatMinutes;
    // 跨天自动清零聊天时长
    const today = new Date().toISOString().slice(0, 10);
    if (st.chatDay !== today) saveActive({ chatUsed: 0, chatDay: today });
    this.chatUsedToday = st.chatDay === today ? st.chatUsed : 0;
    this.ui.toast('👪 Parent settings saved', 'good', 2000);
  }

  // ───────── 金币与通行证 ─────────
  /** 飞行要用通行证：创造模式免费，普通模式要买 Flight Pass。返回是否成功切换 */
  private toggleFlight(): boolean {
    if (this.gameMode === 'creative' || this.gameMode === 'spectator') {
      this.player.fly = !this.player.fly;
      return true;
    }
    if (!hasPass('pass_fly')) {
      this.ui.toast('🔒 Flight is a Pass — buy the Flight Pass to unlock it', 'warn', 3200);
      this.openShopPanel();
      return false;
    }
    this.player.fly = !this.player.fly;
    return true;
  }

  private buyPass(id: string): void {
    const p = passById(id);
    if (!p) return;
    let st = getActiveState().state;
    if (st.passes.includes(id)) {
      this.ui.toast('You already own that pass', 'info', 2000);
      return;
    }
    // 需要先答题才能买
    if (p.quiz && !st.unlocked.includes('quiz:' + p.quiz)) {
      const q = quizById(p.quiz);
      if (q) {
        this.ui.openQuiz(q, {
          title: `🪙 Unlock ${p.name}`,
          why: 'Answer right to unlock this pass.',
          onAnswer: (correct) => {
            if (!correct) {
              this.ui.toast('❌ Not right this time — you can try again later', 'warn', 2600);
              return;
            }
            unlockItem('quiz:' + p.quiz);
            this.buyPass(id);
          },
        });
        return;
      }
    }
    st = getActiveState().state;
    if (st.coins < p.cost) {
      this.ui.toast(`🪙 You need ${p.cost - st.coins} more coins for ${p.name}`, 'warn', 3000);
      return;
    }
    addCoins(-p.cost);
    grantPass(id);
    this.ui.toast(`${p.icon} ${p.name} unlocked!`, 'good', 3000);
    this.applyPassEffect(p);
    this.ui.openShop(getActiveState().state.coins, getActiveState().state.passes);
  }

  private applyPassEffect(p: Pass): void {
    if (p.effect === 'fly' && !this.player.fly) {
      this.player.fly = true;
      this.ui.toast('🪶 Flight is ON', 'good', 2200);
    }
    if (p.effect === 'shield') this.shieldOn = true;
    if (p.effect === 'speed') this.speedBoost = true;
    if (p.effect === 'night_vision') this.nightVision = true;
  }

  // ───────── 答题解锁物品 ─────────
  private promptUnlockQuiz(itemKey: string): void {
    const u = unlockFor(itemKey);
    if (!u) return;
    const q = quizById(u.quiz);
    if (!q) {
      unlockItem(itemKey);
      return;
    }
    this.ui.openQuiz(q, {
      title: `🔒 ${item(itemKey).name} is locked`,
      why: u.reason,
      onAnswer: (correct) => {
        if (correct) {
          unlockItem(itemKey);
          this.ui.toast(`✅ ${item(itemKey).name} unlocked!`, 'good', 2800);
        } else {
          this.ui.toast('❌ Not right — try again when you have learned it', 'warn', 2800);
        }
      },
    });
  }

  private onQuizAnswer(itemKey: string, correct: boolean): void {
    if (correct) {
      unlockItem(itemKey);
      this.ui.toast(`✅ ${item(itemKey).name} unlocked!`, 'good', 2600);
    } else {
      this.ui.toast('❌ Not quite right — have another go', 'warn', 2400);
    }
  }

  // ───────── 换装 ─────────
  private setOutfit(o: Outfit): void {
    const norm = normalizeOutfit(o);
    setProfileOutfit(norm);
    this.vm.setSleeve(norm.shirt);
    this.outfitChanged = true; // 让下一次状态广播带上新外观
    this.ui.toast('👕 Look updated!', 'good', 1600);
  }

  // ───────── 年级 ─────────
  private setGrade(g: number): void {
    const grade = clampGrade(g);
    setProfileGrade(grade);
    const band = GRADE_BANDS.find((x) => x.grade === grade);
    this.ui.toast(`🎓 Now learning at ${band?.label ?? 'Grade ' + grade}`, 'good', 2600);
  }

  // ───────── 配方书：直接合成 ─────────
  private cookFromBook(out: string): void {
    const counts: Record<string, number> = {};
    for (const s of this.inv.slots) if (s) counts[s.key] = (counts[s.key] ?? 0) + s.count;
    const entries = buildRecipeBook().filter((e) => e.out === out);
    if (!entries.length) {
      this.ui.toast('There is no recipe for that yet', 'warn', 2200);
      return;
    }
    // 需要工作台/熔炉的配方要先站在旁边
    const usable = entries.filter((e) => {
      if (e.station === 'Crafting Table') return this.nearBlock(blocks.craftingTable);
      if (e.station === 'Furnace') return this.nearBlock(blocks.furnace);
      return true;
    });
    if (!usable.length) {
      this.ui.toast(
        entries[0].station === 'Furnace'
          ? '🔥 Stand next to a furnace to make that'
          : '🪚 Place a crafting table nearby first!',
        'warn',
        3000,
      );
      return;
    }
    // 锁定的物品要先答题
    if (unlockFor(out) && !isUnlocked(out)) {
      this.promptUnlockQuiz(out);
      return;
    }
    const ready = usable.find((e) => e.need.every((n) => (counts[n.item] ?? 0) >= n.want));
    if (!ready) {
      const missing = usable[0].need
        .filter((n) => (counts[n.item] ?? 0) < n.want)
        .map((n) => `${n.name} ×${n.want - (counts[n.item] ?? 0)}`)
        .join(', ');
      this.ui.toast(`Still missing: ${missing}`, 'warn', 3400);
      return;
    }
    for (const n of ready.need) this.inv.remove(n.item, n.want);
    this.inv.add(out, ready.count);
    sfx.play('craft');
    this.ui.toast(`⚒️ Crafted ${ready.count} × ${ready.name}!`, 'good', 2600);
    this.saveAll();
    this.ui.renderInventory(this.inv, this.gameMode === 'creative');
    this.openBookPanel();
  }

  // ───────── 表情 ─────────
  private playEmote(id: string): void {
    const e = emoteById(id);
    if (!e) return;
    this.emoteId = e.anim;
    this.emoteUntil = performance.now() + e.dur * 1000;
    this.ui.showEmote(e.icon, e.dur * 1000);
    this.net.event('emote', this.sceneDef.id, this.player.position.x, this.player.position.y, this.player.position.z, e.anim);
  }

  // ───────── 麦克风 ─────────
  private toggleMic(): void {
    if (this.micActive) {
      this.stopMic();
      return;
    }
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) {
      this.ui.toast('🎤 This browser has no speech recognition — try Chrome or Edge', 'warn', 4000);
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onresult = (ev: SpeechRecognitionEventLike) => {
        const text = String(ev.results?.[0]?.[0]?.transcript ?? '').trim();
        if (text) this.onVoiceText(text);
      };
      rec.onerror = (ev: SpeechRecognitionErrorLike) => {
        this.stopMic();
        const code = ev?.error ?? 'error';
        this.ui.toast(
          code === 'not-allowed'
            ? '🎤 Microphone permission was blocked — allow it in the browser settings'
            : '🎤 I could not hear anything. Try again.',
          'warn',
          3600,
        );
      };
      rec.onend = () => this.stopMic();
      this.recog = rec;
      rec.start();
      this.micActive = true;
      this.ui.setMicState(true, 'Listening… tap again to stop');
      this.ui.toast('🎤 Listening — say something!', 'info', 2200);
    } catch {
      this.ui.toast('🎤 The microphone could not be started', 'warn', 3000);
    }
  }

  private stopMic(): void {
    if (this.recog) {
      try {
        this.recog.stop();
      } catch {
        /* ignore */
      }
      this.recog = null;
    }
    if (this.micActive) {
      this.micActive = false;
      this.ui.setMicState(false, 'Tap to speak');
    }
  }

  /** 麦克风识别到的文字：和在聊 NPC 时发给 NPC，否则发给房间 */
  private onVoiceText(text: string): void {
    this.stopMic();
    if (this.mode === 'dialog' && this.activeNpc) {
      this.ui.setAskText(text);
      this.ask(text);
      return;
    }
    this.sendChat(text);
  }

  // ───────── 聊天（带家长限制 + 敏感词过滤） ─────────
  private sendChat(text: string): void {
    const st = getActiveState().state;
    if (!st.parent.freeChat) {
      this.ui.toast('👪 A grown-up has turned off chat for now', 'warn', 3000);
      return;
    }
    if (st.parent.chatMinutes > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const used = st.chatDay === today ? st.chatUsed : 0;
      if (used >= st.parent.chatMinutes) {
        this.ui.toast('👪 Chat time is over for today — ask a grown-up for more', 'warn', 4000);
        return;
      }
      saveActive({ chatUsed: used + 1, chatDay: today });
    }
    // 敏感词：整条消息变成 ###
    let out = text;
    if (this.wordFilterOn) {
      const reason = blockedReason(text);
      if (reason) {
        out = '###';
        this.ui.toast('👪 That message was blocked by the parent word filter', 'warn', 3200);
      }
    }
    this.ui.consolePrint('You (said): ' + out, 'me');
    this.ui.toast('📣 ' + out, 'info', 4000);
    this.net.chat(out);
    this.logChat('You', this.userMeta.avatar, out, true);
  }

  // ───────── 切换档案的密码校验 ─────────
  private onProfileUnlocked(id: string, hash: string): boolean {
    if (checkProfilePassword(id, hash)) {
      this.switchProfile(id);
      return true;
    }
    return false;
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
    this.ui.renderQuests(this.sceneDef.id, this.progress, this.playerGrade());
    this.ui.renderMap(SCENES, this.sceneDef.id, this.progress, this.doneScenes, this.playerGrade());
    // refresh NPC talk-badges for the newly active progress
    for (const n of this.npcs) {
      const q = questsOf(this.sceneDef.id, this.playerGrade()).find((x) => x.kind === 'talk' && x.target === n.personality.id);
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
          messages: [{ role: 'user', content: 'Reply with just two words: success' }],
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
          ? '. For Groq: use the base URL https://api.groq.com/openai/v1, with a model like llama-3.3-70b-versatile'
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
        return '⚠️ Connected, but this is a "reasoning" model: it spent its budget on thinking, so the reply is empty. For NPC chat, switch to a chat model (gpt-4o-mini / deepseek-chat / qwen-plus / grok-3-mini)';
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
      this.ui.toast(`🌐 Connected · Room "${this.net.room}"`, 'good', 3000);
      this.refreshOnline();
    } else if (s === 'error' && now - this.netToastAt > 8000) {
      this.netToastAt = now;
      this.ui.toast(`🌐 Connection failed: ${detail || 'broker temporarily unreachable'} (single-player still works)`, 'warn', 4800);
    } else if (s === 'off') {
      this.ui.toast('🌐 Left multiplayer (single-player mode)', 'info', 2200);
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
      this.ui.toast(`💨 ${m.name} farted!`, 'info', 2600);
    } else if (m.kind === 'wave') {
      this.remote.wave(m.id);
      this.ui.toast(`👋 ${m.name} waved at you`, 'info', 2600);
    } else if (m.kind === 'emote') {
      const e = emoteById(m.data ?? '');
      this.remote.emote(m.id, m.data ?? 'wave', e?.icon ?? '🙂', e?.dur ?? 1.5);
      this.ui.toast(`${e?.icon ?? '🙂'} ${m.name} is doing ${e?.name ?? 'something'}`, 'info', 2600);
    }
  }

  /** 每帧调用：内部按 120ms 节流广播位置，2s 一次心跳 */
  private publishNetState(force = false): void {
    if (!this.netCfg.enabled) return;
    const p = this.player.position;
    // 换装后要把新外观一起广播出去
    const outfit = this.outfitChanged ? JSON.stringify(getActiveState().state.outfit) : undefined;
    if (this.outfitChanged) this.outfitChanged = false;
    this.net.publishState(force || !!outfit, {
      scene: this.sceneDef.id,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: this.player.yaw,
      outfit,
    });
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
    this.ui.toast('👋 You waved', 'info', 1800);
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
      // 不带 / 的输入 = 聊天：走家长控制（时长限制 + 敏感词过滤）后广播
      this.sendChat(line);
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
        out('[Move]    /tp (/teleport) <x y z> | <scene> | ~ ~10 ~      /locate      /fly', 'sys');
        out('[Build]   /setblock <x y z> <block>     /fill <region> <block> [replace <blk>]', 'sys');
        out('          /clone <region> <tx ty tz>    /give <block> [count]    /clear', 'sys');
        out('[World]   /gamemode <survival|creative|adventure|spectator> (or 0/1/2/3)', 'sys');
        out('          /time day|night|noon|sunrise|sunset|set <0-100>|add <0-100>   /weather clear|rain|thunder', 'sys');
        out('[Chat]    /say <text>   /me <text>   /title <text>   /tellraw <text>   /stopsound', 'sys');
        out('          /wave (wave at online players)   /list online (who is online)', 'sys');
        out('[Info]    /list [scenes|npcs|players|blocks|online]   /seed      /summon <npc>', 'sys');
        out('[Life]    /kill (respawn)   /spawnpoint [x y z]   /setworldspawn [x y z]', 'sys');
        out('          /heal   /feed   /craft (inventory)   /bag   /fart   /pets   /mobs', 'sys');
        out('[Fun]     /cycle on|off (day-night)   /sound on|off   /volume <0-100>', 'sys');
        out('          /grayson (meet the co-author)   /edition java|bedrock', 'sys');
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
          this.ui.toast('🛡️ God mode ON — fall damage / lava / mobs can no longer hurt you (type /god again to turn off)', 'good', 5000);
          return out('🛡️ God mode ON — fall damage / lava / mobs can no longer hurt you', 'ok');
        }
        this.ui.toast('🛡️ God mode OFF — watch your step!', 'info', 3000);
        return out('🛡️ God mode OFF', 'ok');
      }
      case 'grayson':
      case 'author': {
        this.ui.toast('💙 Grayson is one of the little co-authors of this world! His cottage is in the northeast corner of the village (the glowing blue roof), and his statue is in the northwest of the square', 'good', 6500);
        out('💙 Grayson — co-author of BlockAcademy', 'me');
        out('· Grayson\'s Cottage: in the northeast corner of the village — the one with quartz walls, a blue roof, and crystal pillars', 'sys');
        out('· Grayson statue: in the northwest of the village square — the little blue figure holding a lantern', 'sys');
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
        if (!this.toggleFlight()) return out('🔒 Flight is a Pass. Buy the Flight Pass in the Pass Shop (Pause → Pass Shop).', 'err');
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
          const status = this.netStatus === 'online' ? '🌐 Online' : '📴 Offline';
          out(`${status} · Room "${this.net.room}" · ${ps.length} player(s) online`, 'sys');
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

  /** 打败一只动物后的掉落与提示（小孩向的说法，不说「杀」） */
  private onAnimalDefeated(m: Mob): void {
    const drop = MobManager.dropOf(m.kind);
    this.unlock('hunt', `🥩 You worked out how to ${m.def.name.toLowerCase()}s — and where their food comes from.`);
    if (drop) {
      const n = this.inv.add(drop, 1);
      if (n <= 0) {
        this.ui.toast(`${m.def.icon} ${m.def.name} defeated — your bag was full, so the ${item(drop).name} was lost`, 'warn', 3600);
      } else {
        this.ui.toast(`${m.def.icon} ${m.def.name} defeated — you got 1 × ${item(drop).name}`, 'good', 3200);
      }
      this.refreshHud();
      this.saveAll();
    } else {
      this.ui.toast(`${m.def.icon} ${m.def.name} defeated. ${m.def.name}s are friends — maybe feed it instead next time.`, 'info', 3200);
    }
  }

  private doMine(dt: number): void {    const hit = this.updateHighlight();
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
      } else {
        // 也可以对普通动物下手（但不能打自己的宠物）
        const animal = this.mobs.nearest(p, this.player.forwardVector(), 3.0);
        if (animal && !animal.pet && this.swingCd <= 0) {
          this.swingCd = 0.4;
          const it = this.heldItem();
          const dmg = it?.tool === 'sword' ? 4 + (it.tier ?? 0) * 2 : 2;
          this.vm.swingRight();
          this.mobs.strike(p, this.player.forwardVector(), dmg, 3.0, (m) => m === animal);
          sfx.play('pop');
          this.burst(animal.position.x, animal.position.y + 0.9, animal.position.z, 0xffd27a, 10, 1.8);
          if (animal.isDead) this.onAnimalDefeated(animal);
          if (!held) return;
        }
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

  /**
   * 玩具发射器：只打夜里的暗影怪。
   * 瞄着动物、小朋友或别的玩家时它会拒绝开火 —— 这是安全设定，不是限制。
   */
  private fireBlaster(): void {
    if (this.placeCd > 0) return;
    this.placeCd = 0.45;
    this.vm.swingRight();
    sfx.play('click');
    const p = this.player.position;
    const fwd = this.player.forwardVector();
    // 面前最近的任何生物
    const target = this.mobs.nearest(p, fwd, 8.0);
    if (target) {
      if (target.def.hostile) {
        this.mobs.strike(p, fwd, 3, 8.0, (m) => m === target);
        this.burst(target.position.x, target.position.y + 0.9, target.position.z, 0x9fe8ff, 12, 2.0);
        this.ui.toast('💥 Foam dart hit the Shadow!', 'good', 1800);
        return;
      }
      this.ui.toast('🛡️ The toy blaster is foam-only — it will not hurt animals', 'warn', 2800);
      return;
    }
    // 面前有别的玩家？也不能打
    if (this.nearRemotePlayer()) {
      this.ui.toast('🛡️ Never aim that at another player', 'warn', 2800);
      return;
    }
    this.burst(p.x + fwd.x * 4, p.y + 1.2, p.z + fwd.z * 4, 0x9fe8ff, 6, 1.4);
    this.ui.toast('💨 Pfff! Foam dart flies off into the distance', 'info', 1800);
  }

  /** 面前 8 格内有没有别的玩家 */
  private nearRemotePlayer(): boolean {
    const p = this.player.position;
    const fwd = this.player.forwardVector();
    const list = this.net.getPlayers();
    for (const s of list) {
      if (s.id === this.net.myId) continue;
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 8 || d < 0.001) continue;
      const dot = (dx / d) * fwd.x + (dz / d) * fwd.z;
      if (dot > 0.6) return true;
    }
    return false;
  }

  private doPlace(dt: number): void {
    const hit = this.hitResult;
    this.placeCd -= dt;
    if (!hit || !this.canEdit || this.placeCd > 0) return;
    const click = this.input.takeClick(2);
    const held = this.input.mouseHeld(2);
    if (!click && !held) return;
    // 右键对着箱子 = 开箱子（优先于放置）
    const chest = this.chestUnderAim();
    if (chest) {
      this.openChest(chest.x, chest.y, chest.z);
      return;
    }
    const slot = this.heldSlot();
    if (!slot) return;
    const it = item(slot.key);
    if (it.key === 'toy_blaster') {
      this.fireBlaster();
      return;
    }
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
        if (!this.toggleFlight()) {
          this.ui.toast('🔒 Flight is a Pass — buy it in the Pass Shop (Pause → Pass Shop)', 'warn', 3400);
          break;
        }
        this.ui.toast(this.player.fly ? '🪶 Flight on' : '🪶 Flight off', 'info', 2200);
        break;
      case 'fart':
        this.fart();
        break;
      case 'inventory':
        this.toggleInventory();
        break;
      case 'chat':
        // 💬 = 触屏版的 E 键：命令台开着就关掉；有 NPC/传送台就走完整互动逻辑，
        // 否则打开命令台（不带 / 的发言会广播给在线玩家）
        if (this.consoleOpen) {
          this.closeConsole();
          break;
        }
        if (this.nearestNpc() || this.nearPad) {
          this.doInteract();
        } else {
          this.openConsole();
          this.ui.toast('No resident nearby — opened the command console instead (/help)', 'info', 2600);
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

  // ───────── 箱子 ─────────
  private chests!: ChestStore;
  /** 当前打开的箱子坐标；null 表示没开箱子 */
  private openChestAt: { x: number; y: number; z: number } | null = null;

  /** 打开脚下的箱子（坐标已由调用方确认） */
  private openChest(x: number, y: number, z: number): void {
    if (this.mode !== 'play') return;
    this.openChestAt = { x, y, z };
    this.chestBuffer = this.chests.get(this.sceneDef.id, x, y, z);
    this.inv.cursor = null;
    sfx.play('open');
    this.ui.openChest(this.chestBuffer, this.inv);
    this.input.exitLock();
    this.bumpQuest((q) => q.kind === 'explore');
  }

  private closeChest(): void {
    const c = this.openChestAt;
    if (c) this.chests.set(this.sceneDef.id, c.x, c.y, c.z, this.chestBuffer);
    this.openChestAt = null;
    // 光标上还拿着东西：放回背包，别让它凭空消失
    if (this.inv.cursor) {
      const left = this.inv.add(this.inv.cursor.key, this.inv.cursor.count);
      if (left > 0) this.ui.toast(`🎒 No room for ${item(this.inv.cursor.key).name} — ${left} left behind`, 'warn', 3000);
      this.inv.cursor = null;
    }
    this.ui.closeOverlay('chest');
    this.refreshHud();
    this.saveAll();
    if (this.edition === 'java') this.input.requestLock();
  }

  /** 箱子面板里点格子：光标式存取，和背包完全一致 */
  private chestBuffer: (Slot | null)[] = Array.from({ length: CHEST_SLOTS }, () => null);
  private onChestClick(index: number): void {
    const c = this.openChestAt;
    if (!c) return;
    const inv = this.inv;
    const cur = inv.cursor;
    const slot = this.chestBuffer[index];
    if (!cur) {
      if (slot) {
        this.chestBuffer[index] = null;
        inv.cursor = slot;
      }
    } else if (!slot) {
      this.chestBuffer[index] = cur;
      inv.cursor = null;
    } else if (slot.key === cur.key) {
      const max = item(cur.key).stack;
      const put = Math.min(max - slot.count, cur.count);
      if (put > 0) {
        slot.count += put;
        cur.count -= put;
        if (cur.count <= 0) inv.cursor = null;
      } else {
        this.chestBuffer[index] = cur;
        inv.cursor = slot;
      }
    } else {
      this.chestBuffer[index] = cur;
      inv.cursor = slot;
    }
    sfx.play('click');
    this.ui.openChest(this.chestBuffer, inv);
  }

  /** 关掉箱子时把改动写回存档（ChestStore 持有同一份引用） */
  private flushChest(): void {
    const c = this.openChestAt;
    if (!c) return;
    this.chests.set(this.sceneDef.id, c.x, c.y, c.z, this.chestBuffer);
  }

  /** 准星对着箱子时，E / 右键 / 触屏 💬 都能打开 */
  private chestUnderAim(): { x: number; y: number; z: number } | null {
    const hit = this.hitResult;
    if (!hit) return null;
    if (this.world.get(hit.x, hit.y, hit.z) !== blocks.chest) return null;
    const p = this.player.position;
    // 别隔着墙开箱子
    if (Math.hypot(hit.x + 0.5 - p.x, hit.y + 0.5 - p.y, hit.z + 0.5 - p.z) > 5.2) return null;
    return { x: hit.x, y: hit.y, z: hit.z };
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

    // 箱子面板：走箱子自己的存取逻辑
    if (target === 'chest') {
      this.onChestClick(index);
      return;
    }

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

    // ✂ Split 模式：把这一叠拆成两半（8 个木板 → 4 + 4）
    if (this.ui.splitArmed && (target === 'storage' || target === 'hotbar')) {
      const s = this.slotGet(target, index);
      if (s && s.count > 1) {
        const half = Math.floor(s.count / 2);
        s.count -= half;
        // 拆出来的那半放到光标上（可以再放到别的格子）
        inv.cursor = { key: s.key, count: half };
        sfx.play('click');
        this.ui.renderInventory(inv, creative);
        this.refreshHud();
        this.saveAll();
        return;
      }
      this.ui.toast('That stack cannot be split (needs 2 or more)', 'info', 1800);
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
      // 合成格每次只放 1 个（《我的世界》就是这样）：
      // 否则一叠 8 个木板会整叠卡在一个格子里，2×2 的工作台配方永远凑不齐。
      const n = target === 'craft' ? 1 : cur.count;
      this.slotSet(target, index, { key: cur.key, count: n });
      cur.count -= n;
      if (cur.count <= 0) inv.cursor = null;
    } else if (slot.key === cur.key) {
      const max = item(cur.key).stack;
      const put = target === 'craft' ? 1 : Math.min(max - slot.count, cur.count);
      const real = Math.min(put, max - slot.count);
      if (real > 0) {
        slot.count += real;
        cur.count -= real;
        if (cur.count <= 0) inv.cursor = null;
      } else {
        this.slotSet(target, index, cur);
        inv.cursor = slot;
      }
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

    // 锁定的物品：先答对题才能做出来
    if (unlockFor(r.key) && !isUnlocked(r.key)) {
      this.promptUnlockQuiz(r.key);
      return;
    }

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
      case 'book':
        this.ui.closeOverlay('pause');
        this.openBookPanel();
        break;
      case 'shop':
        this.ui.closeOverlay('pause');
        this.openShopPanel();
        break;
      case 'wardrobe':
        this.ui.closeOverlay('pause');
        this.openWardrobePanel();
        break;
      case 'parent':
        this.ui.closeOverlay('pause');
        this.openParentPanel();
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
    this.flushChest();
    saveActive({
      edition: this.edition,
      inventory: this.inv.serialize(),
      chatLog: this.chatLog,
      friendship: this.friendship,
      achievements: this.achievements,
      sound: this.soundOn,
      volume: this.soundVolume,
      net: this.netCfg,
      chests: this.chests.serialize(),
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
      this.ui.renderMap(SCENES, this.sceneDef.id, this.progress, this.doneScenes, this.playerGrade());
      this.ui.toggleOverlay('map');
      i.exitLock();
    }
    if (i.pressed('KeyO')) {
      this.ui.fillSettings(this.llm);
      this.ui.renderGradeRow(getActiveState().state.grade);
      this.ui.toggleOverlay('settings');
      i.exitLock();
    }
    if (i.pressed('KeyP')) {
      this.ui.openProfiles();
      i.exitLock();
    }
    if (i.pressed('KeyH')) this.ui.toggleOverlay('help');
    if (i.pressed('Escape') && this.mode === 'dialog') this.closeDialog();
    if (i.pressed('Escape') && this.ui.isOverlayOpen('chest')) {
      this.closeChest();
      i.exitLock();
    }
    // 《我的世界》键位：E 打开物品栏（面前有 NPC / 演示台时优先互动）
    if (i.pressed('KeyE')) this.doInteract();
    if (i.pressed('KeyI')) this.toggleInventory();
    if (i.pressed('KeyG')) this.fart();
    if (i.pressed('KeyV')) this.wave();
    if (i.pressed('KeyC')) this.swingLeft();
    if (i.pressed('F3') && this.edition === 'java') this.f3On = !this.f3On;
  }

  /**
   * 「互动」动作：电脑端按 E，触屏端点 💬 按钮 / TALK 大按钮，走同一条逻辑。
   * 面前有传送台就用传送台，有 NPC 就开对话框，有动物就互动，否则打开背包。
   */
  private doInteract(): void {
    // 箱子优先：面前有箱子就开箱子
    const chest = this.chestUnderAim();
    if (chest) {
      this.openChest(chest.x, chest.y, chest.z);
      return;
    }
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
    // 触屏专属的「交谈」大按钮：默认先收起，只有真正靠近 NPC / 演示台时才弹出
    const touch = this.edition === 'bedrock';
    const clearAll = () => {
      this.ui.hint(null);
      this.ui.setTalkBtn(null);
    };
    if (this.consoleOpen || this.ui.anyOverlayOpen()) {
      clearAll();
      return;
    }
    if (this.mode !== 'play') {
      clearAll();
      return;
    }
    if (!this.input.locked) {
      this.ui.setTalkBtn(null);
      this.ui.hint(
        touch ? 'Tap the screen to keep playing' : 'Click the screen to resume (<kbd>ESC</kbd> to release mouse)',
      );
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
      if (touch) {
        this.ui.hint(null);
        this.ui.setTalkBtn(`💬 ${this.nearPad.label}`, () => this.doInteract());
      } else {
        this.ui.setTalkBtn(null);
        this.ui.hint(`<kbd>E</kbd> ${this.nearPad.label}`);
      }
      return;
    }
    const npc = this.nearestNpc();
    if (npc) {
      const q = questsOf(this.sceneDef.id, this.playerGrade()).find((x) => x.kind === 'talk' && x.target === npc.personality.id);
      const doneTag = q && isDone(q, this.progress) ? ' ✓' : '';
      if (touch) {
        this.ui.hint(null);
        this.ui.setTalkBtn(`💬 Talk to ${npc.personality.name}${doneTag}`, () => this.openDialog(npc));
      } else {
        this.ui.setTalkBtn(null);
        this.ui.hint(
          `<kbd>E</kbd> Talk with ${npc.personality.emoji} ${npc.personality.name} ${doneTag ? '(already chatted)' : ''}`,
        );
      }
      this.npcCooldown = 0;
      return;
    }
    // 走到 Grayson 小屋附近：解锁「拜访作者小屋」成就
    if (this.sceneDef.id === 'village' && Math.hypot(78.5 - p.x, 90.5 - p.z) < 8) {
      this.unlock('grayson_house', "💙 Visited Grayson's House — hi, co-author!");
    }
    // 瞄着箱子：提示怎么打开
    const chest = this.chestUnderAim();
    if (chest) {
      if (touch) {
        this.ui.hint(null);
        this.ui.setTalkBtn('🧰 Open chest', () => this.openChest(chest.x, chest.y, chest.z));
      } else {
        this.ui.setTalkBtn(null);
        this.ui.hint('<kbd>E</kbd> or right-click to open the chest');
      }
      return;
    }
    this.ui.hint(null);
    this.ui.setTalkBtn(null);
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
