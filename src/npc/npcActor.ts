/** NPC 角色：方块人体模型、名牌、漫游/注视行为、语音朗读 */
import * as THREE from 'three';
import type { World } from '../core/world';
import { mulberry32 } from '../core/noise';
import type { Personality } from './personalities';
import { NPCBrain, type SceneContext, type LLMConfig } from './brain';
import { speechEnabled } from '../ui/speech';

const HEAD = 0.5;
const BODY_W = 0.5;
const BODY_H = 0.72;
const LEG_H = 0.62;

function faceTexture(p: Personality): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#' + p.skin.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#22242c';
  const eyeY = p.id === 'star_see' ? 30 : 32;
  const eyeSize = p.humor > 0.8 ? 6 : 5;
  g.fillRect(16, eyeY, eyeSize, eyeSize);
  g.fillRect(64 - 16 - eyeSize, eyeY, eyeSize, eyeSize);
  g.fillStyle = '#ffffff';
  g.fillRect(16 + 1, eyeY + 1, 2, 2);
  g.fillRect(64 - 15 - eyeSize + 1, eyeY + 1, 2, 2);
  // 嘴
  g.fillStyle = '#8a4a4a';
  const smile = p.humor > 0.5 ? 3 : 1.5;
  g.beginPath();
  g.moveTo(26, 46);
  g.quadraticCurveTo(32, 46 + smile * 3, 38, 46);
  g.strokeStyle = '#8a4a4a';
  g.lineWidth = 2;
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function nameplateSprite(text: string, color: string, sub?: string): THREE.Sprite {
  const pad = 16;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const subW = sub ? (ctx.font = '24px "Microsoft YaHei", sans-serif', Math.ceil(ctx.measureText(sub).width) + pad * 2) : 0;
  c.width = Math.max(w, subW);
  c.height = sub ? 92 : 58;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(14,18,28,0.72)';
  roundRect(g, 0, 0, c.width, c.height, 14);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 3;
  roundRect(g, 1.5, 1.5, c.width - 3, c.height - 3, 14);
  g.stroke();
  g.textAlign = 'center';
  g.fillStyle = color;
  g.font = 'bold 34px "Microsoft YaHei", sans-serif';
  g.fillText(text, c.width / 2, sub ? 40 : 41);
  if (sub) {
    g.fillStyle = 'rgba(230,236,248,0.85)';
    g.font = '24px "Microsoft YaHei", sans-serif';
    g.fillText(sub, c.width / 2, 74);
  }
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set((c.width / 64) * 1.15, (c.height / 64) * 1.15, 1);
  sp.renderOrder = 990;
  return sp;
}

/** NPC 头顶的对白气泡 */
function speechBubble(text: string): THREE.Sprite {
  const size = 26;
  const padding = 18;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${size}px "Microsoft YaHei", sans-serif`;
  const maxW = 340;
  const words: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) {
      words.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) words.push(line);
  const w = Math.ceil(Math.min(maxW, ctx.measureText(line).width)) + padding * 2;
  canvas.width = w;
  canvas.height = words.length * (size + 8) + padding * 2 + 10;
  const g = canvas.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(g, 2, 2, canvas.width - 4, canvas.height - 14, 16);
  g.fill();
  g.beginPath();
  g.moveTo(canvas.width / 2 - 12, canvas.height - 14);
  g.lineTo(canvas.width / 2 + 12, canvas.height - 14);
  g.lineTo(canvas.width / 2, canvas.height - 2);
  g.closePath();
  g.fill();
  g.fillStyle = '#1a2230';
  g.font = `${size}px "Microsoft YaHei", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  words.forEach((l, i) => g.fillText(l, canvas.width / 2, padding + i * (size + 8)));
  const tex = new THREE.CanvasTexture(canvas);
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }),
  );
  sp.scale.set(canvas.width / 46, canvas.height / 46, 1);
  sp.renderOrder = 995;
  return sp;
}

function badgeTexture(char: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const done = char === '✓';
  g.fillStyle = done ? 'rgba(24,60,40,0.85)' : 'rgba(18,30,48,0.85)';
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = done ? '#8fd48f' : '#8fd8ff';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = done ? '#a8f0a8' : '#bfe8ff';
  g.font = 'bold 40px "Microsoft YaHei", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(char, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

export type NPCState = 'idle' | 'walk' | 'talk';

export class NPCActor {
  readonly personality: Personality;
  readonly brain: NPCBrain;
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  /** 有顶场景（矿洞）里固定的站立高度，避免被算到封顶层顶上 */
  readonly fixedY: number | null;
  facing = 0;
  targetFacing = 0;
  state: NPCState = 'idle';

  /** 行为参数 */
  private home = new THREE.Vector3();
  private target = new THREE.Vector3();
  private waitUntil = 0;
  private walkPhase = 0;
  private rnd = mulberry32(Math.floor(Math.random() * 1e9));
  private roamRadius: number;

  private parts: THREE.Mesh[] = [];
  private legL!: THREE.Mesh;
  private legR!: THREE.Mesh;
  private armL!: THREE.Mesh;
  private armR!: THREE.Mesh;
  private head!: THREE.Mesh;
  private plate: THREE.Sprite;
  private badge: THREE.Sprite;
  private speaking = false;
  private greeted = false;
  /** NPC 主动冒 bubbles */
  private bubble: THREE.Sprite | null = null;
  private bubbleUntil = 0;
  /** 最近一次主动搭话的时间戳 */
  lastGreetTime = 0;

  constructor(personality: Personality, pos: THREE.Vector3, roamRadius = 6, fixedY?: number) {
    this.personality = personality;
    this.fixedY = fixedY ?? null;
    this.brain = new NPCBrain(personality);
    this.position.copy(pos);
    this.home.copy(pos);
    this.roamRadius = roamRadius;
    this.target.copy(pos);

    const skinMat = new THREE.MeshLambertMaterial({ color: personality.skin });
    const shirtMat = new THREE.MeshLambertMaterial({ color: personality.shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: personality.pants });
    const hairMat = new THREE.MeshLambertMaterial({ color: personality.hair });
    const faceTex = faceTexture(personality);

    // 头
    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(HEAD, HEAD, HEAD),
      [
        skinMat,
        skinMat,
        hairMat,
        new THREE.MeshLambertMaterial({ color: 0x000000 }),
        new THREE.MeshLambertMaterial({ map: faceTex }),
        skinMat,
      ],
    );
    this.head.position.y = LEG_H + BODY_H + HEAD / 2;
    this.group.add(this.head);
    this.parts.push(this.head);

    // 身体
    const body = new THREE.Mesh(new THREE.BoxGeometry(BODY_W, BODY_H, 0.32), shirtMat);
    body.position.y = LEG_H + BODY_H / 2;
    this.group.add(body);
    this.parts.push(body);

    // 手臂
    const armGeo = new THREE.BoxGeometry(0.18, BODY_H * 0.92, 0.18);
    this.armL = new THREE.Mesh(armGeo, shirtMat);
    this.armR = new THREE.Mesh(armGeo, shirtMat);
    this.armL.position.set(-BODY_W / 2 - 0.1, LEG_H + BODY_H * 0.55, 0);
    this.armR.position.set(BODY_W / 2 + 0.1, LEG_H + BODY_H * 0.55, 0);
    this.armL.geometry.translate(0, -BODY_H * 0.4, 0);
    this.armR.geometry.translate(0, -BODY_H * 0.4, 0);
    this.armL.position.y += BODY_H * 0.4;
    this.armR.position.y += BODY_H * 0.4;
    this.group.add(this.armL, this.armR);
    this.parts.push(this.armL, this.armR);

    // 腿
    const legGeo = new THREE.BoxGeometry(0.2, LEG_H, 0.2);
    this.legL = new THREE.Mesh(legGeo, pantsMat);
    this.legR = new THREE.Mesh(legGeo, pantsMat);
    this.legL.geometry.translate(0, -LEG_H / 2, 0);
    this.legR.geometry.translate(0, -LEG_H / 2, 0);
    this.legL.position.set(-0.14, LEG_H, 0);
    this.legR.position.set(0.14, LEG_H, 0);
    this.group.add(this.legL, this.legR);
    this.parts.push(this.legL, this.legR);

    this.plate = nameplateSprite(personality.name, personality.tag, `${personality.emoji} ${personality.role}`);
    this.plate.position.y = LEG_H + BODY_H + HEAD + 0.42;
    this.group.add(this.plate);

    this.badge = nameplateSprite('?', '#8fd8ff');
    this.badge.position.y = LEG_H + BODY_H + HEAD + 0.95;
    this.badge.scale.multiplyScalar(0.6);
    this.group.add(this.badge);

    this.group.position.copy(pos);
  }

  get badgeVisible(): boolean {
    return this.badge.visible;
  }
  private badgeChar = '?';
  setBadge(v: boolean, char = '?'): void {
    this.badge.visible = v;
    if (this.badgeChar === char) return;
    this.badgeChar = char;
    this.badge.material.map?.dispose();
    this.badge.material.map = badgeTexture(char);
    this.badge.material.needsUpdate = true;
  }

  /** 主动开口：头顶冒一句气泡（走近时触发一次） */
  showBubble(text: string, seconds = 6): void {
    if (this.bubble) {
      this.group.remove(this.bubble);
      this.bubble.material.map?.dispose();
      this.bubble.material.dispose();
    }
    const sp = speechBubble(text.slice(0, 60));
    sp.position.y = LEG_H + BODY_H + HEAD + 1.5;
    this.group.add(sp);
    this.bubble = sp;
    this.bubbleUntil = performance.now() / 1000 + seconds;
  }

  setSpeaking(v: boolean): void {
    this.speaking = v;
  }

  /** 该坐标上 NPC 应该站的高度 */
  private groundFor(world: World, x: number, z: number): number {
    return this.fixedY ?? Math.max(2, world.groundY(Math.floor(x), Math.floor(z)));
  }

  update(dt: number, time: number, world: World, playerPos: THREE.Vector3, frozen: boolean): void {
    const distToPlayer = this.position.distanceTo(playerPos);

    // 行为选择
    if (this.state === 'walk') {
      const dir = new THREE.Vector3().subVectors(this.target, this.position);
      dir.y = 0;
      const len = dir.length();
      if (len < 0.35) {
        this.state = 'idle';
        this.waitUntil = time + 2.5 + this.rnd() * 5;
      } else if (!frozen) {
        dir.normalize();
        const step = Math.min(1.8 * dt, len);
        // 尝试走到目标，遇到障碍就沿 y 抬升
        const nx = this.position.x + dir.x * step;
        const nz = this.position.z + dir.z * step;
        const gy = this.groundFor(world, nx, nz);
        if (gy - this.position.y <= 1.3 && Math.abs(gy - this.position.y) < 4) {
          this.position.x = nx;
          this.position.z = nz;
        } else {
          this.state = 'idle';
          this.waitUntil = time + 1 + this.rnd() * 3;
        }
        this.targetFacing = Math.atan2(dir.x, dir.z);
        this.walkPhase += dt * 7;
      }
    } else if (time > this.waitUntil && !frozen && distToPlayer > 5) {
      // 挑一个新的漫游目标
      const a = this.rnd() * Math.PI * 2;
      const r = 2 + this.rnd() * this.roamRadius;
      const tx = Math.floor(this.home.x + Math.cos(a) * r);
      const tz = Math.floor(this.home.z + Math.sin(a) * r);
      const gy = this.groundFor(world, tx, tz);
      if (gy > 1 && gy < world.sy - 2 && Math.abs(gy - this.home.y) < 3.5) {
        this.target.set(tx + 0.5, gy, tz + 0.5);
        this.state = 'walk';
      } else {
        this.waitUntil = time + 1.5;
      }
    }

    // 贴地
    const ground = this.groundFor(world, this.position.x, this.position.z);
    this.position.y += (ground - this.position.y) * Math.min(1, dt * 9);

    // 靠近玩家时转头注视
    if (distToPlayer < 11) {
      const toP = new THREE.Vector3().subVectors(playerPos, this.position);
      this.targetFacing = Math.atan2(toP.x, toP.z);
    }

    // 朝向插值
    let diff = this.targetFacing - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += diff * Math.min(1, dt * 7);

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;

    // 动画
    const walking = this.state === 'walk';
    const swing = walking ? Math.sin(this.walkPhase) * 0.7 : Math.sin(time * 1.6 + this.badge.id) * 0.05;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    if (this.speaking) {
      this.head.rotation.z = Math.sin(time * 8) * 0.06;
      this.head.position.y = LEG_H + BODY_H + HEAD / 2 + Math.abs(Math.sin(time * 5)) * 0.03;
    } else {
      this.head.rotation.z = 0;
      this.head.position.y = LEG_H + BODY_H + HEAD / 2;
    }

    // 名牌始终面向相机（Sprite 自动实现）；随距离淡出
    const vis = distToPlayer < 26;
    this.plate.visible = vis;
    if (vis) {
      const d = THREE.MathUtils.clamp(distToPlayer, 3, 26);
      this.plate.material.opacity = THREE.MathUtils.clamp(1.25 - d / 26, 0.25, 1);
    }
    this.badge.position.y = LEG_H + BODY_H + HEAD + 0.95 + Math.sin(time * 2) * 0.06;

    // 主动气泡的显示与淡出
    if (this.bubble) {
      const left = this.bubbleUntil - time;
      if (left <= 0) {
        this.group.remove(this.bubble);
        this.bubble.material.map?.dispose();
        this.bubble.material.dispose();
        this.bubble = null;
      } else {
        this.bubble.position.y = LEG_H + BODY_H + HEAD + 1.5 + Math.sin(time * 1.5) * 0.05;
        (this.bubble.material as THREE.SpriteMaterial).opacity = Math.min(1, left / 1.2);
      }
    }
  }

  /** 是否需要主动打招呼 */
  shouldGreet(): boolean {
    if (this.greeted) return false;
    this.greeted = true;
    return true;
  }

  async talk(
    userText: string,
    ctx: SceneContext,
    cfg: LLMConfig,
    onToken?: (partial: string) => void,
  ): Promise<{ text: string; engine: 'llm' | 'local'; error?: string }> {
    const r = userText ? await this.brain.speak(userText, ctx, cfg, onToken) : await this.brain.greet(ctx, cfg, onToken);
    if (speechEnabled()) say(this.personality, r.text);
    return r;
  }

  dispose(): void {
    for (const p of this.parts) (p.geometry as THREE.BufferGeometry).dispose();
    this.plate.material.map?.dispose();
    this.badge.material.map?.dispose();
  }
}

const voices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

export function pickVoice(p: Personality): SpeechSynthesisVoice | null {
  if (!voicesLoaded) {
    voices.length = 0;
    voices.push(...(window.speechSynthesis?.getVoices() ?? []));
    voicesLoaded = true;
  }
  const zh = voices.filter((v) => /zh|Chinese/i.test(v.lang));
  if (!zh.length) return null;
  const seed = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return zh[seed % zh.length];
}

export function say(p: Personality, text: string): void {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[（）()*]/g, '').slice(0, 220));
    const v = pickVoice(p);
    if (v) u.voice = v;
    u.lang = 'zh-CN';
    u.rate = p.voiceRate;
    u.pitch = p.voicePitch;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
