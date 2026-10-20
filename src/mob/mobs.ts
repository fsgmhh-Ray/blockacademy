/**
 * 生物系统：牛 / 猪 / 羊 / 鸡 / 狗 / 猫 / 史莱姆 / 暗影怪
 * 模型全部用盒子拼装（体素风格），AI 为「闲逛 + 逃跑 + 追击」，不需要外部资源。
 */
import * as THREE from 'three';
import type { World } from '../core/world';
import { sfx, type SoundName } from '../core/sfx';
import { blocks } from '../world/blockIds';

export type MobKind = 'cow' | 'pig' | 'sheep' | 'chicken' | 'dog' | 'cat' | 'slime' | 'shadow';

export interface MobDef {
  kind: MobKind;
  name: string;
  cn: string;
  icon: string;
  sound: SoundName;
  hostile: boolean;
  speed: number;
  hp: number;
  /** 空手互动时能收到的产物 */
  gift: string | null;
  /** 喜欢吃的（喂够 3 次成为宠物） */
  tameFood: string | null;
  scale: number;
}

const D = (
  kind: MobKind,
  name: string,
  cn: string,
  icon: string,
  sound: SoundName,
  hostile: boolean,
  speed: number,
  hp: number,
  gift: string | null,
  tameFood: string | null,
  scale: number,
): MobDef => ({ kind, name, cn, icon, sound, hostile, speed, hp, gift, tameFood, scale });

export const MOB_DEFS: Record<MobKind, MobDef> = {
  cow: D('cow', 'Cow', 'Cow', '🐄', 'moo', false, 0.9, 10, 'milk', 'wheat', 1),
  pig: D('pig', 'Pig', 'Pig', '🐖', 'oink', false, 1.0, 10, 'leather', 'carrot', 0.85),
  sheep: D('sheep', 'Sheep', 'Sheep', '🐑', 'baa', false, 0.85, 8, 'wool_white', 'wheat', 0.92),
  chicken: D('chicken', 'Chicken', 'Chicken', '🐔', 'cluck', false, 1.15, 4, 'egg', 'wheat', 0.6),
  dog: D('dog', 'Dog', 'Dog', '🐕', 'woof', false, 2.0, 8, null, 'bread', 0.8),
  cat: D('cat', 'Cat', 'Cat', '🐈', 'meow', false, 1.8, 8, null, 'bread', 0.66),
  slime: D('slime', 'Slime', 'Slime', '🟢', 'pop', false, 1.3, 4, null, null, 0.9),
  shadow: D('shadow', 'Shadow', 'Shadow', '👻', 'hurt', true, 1.5, 6, null, null, 1),
};

function mat(color: number, opacity = 1): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
}
function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}
/** 在髋关节处建一个可旋转的枢轴，腿的网格向下偏移 */
function legPivot(m: THREE.Material, w: number, h: number, x: number, y: number, z: number): THREE.Object3D {
  const p = new THREE.Object3D();
  p.position.set(x, y, z);
  const l = box(w, h, w, m, 0, -h / 2, 0);
  p.add(l);
  return p;
}

interface Model {
  group: THREE.Group;
  legs: THREE.Object3D[];
  head: THREE.Object3D | null;
}

function buildModel(kind: MobKind): Model {
  const g = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  let head: THREE.Object3D | null = null;

  const add4 = (m: THREE.Material, w: number, h: number, y: number, dx: number, dz: number) => {
    for (const [x, z] of [
      [-dx, dz],
      [dx, dz],
      [-dx, -dz],
      [dx, -dz],
    ] as [number, number][]) {
      const p = legPivot(m, w, h, x, y, z);
      legs.push(p);
      g.add(p);
    }
  };

  switch (kind) {
    case 'cow':
    case 'pig':
    case 'sheep': {
      const isCow = kind === 'cow';
      const isPig = kind === 'pig';
      const body = isCow ? 0xf3f1ea : isPig ? 0xf2a7b6 : 0xf6f4ee;
      const skin = isCow ? 0x33291f : isPig ? 0xe08b9e : 0x3b3b3b;
      const bm = mat(body);
      g.add(box(0.95, 0.72, 1.35, bm, 0, 0.95, 0));
      if (isCow) {
        g.add(box(0.36, 0.3, 0.4, mat(0x3a3128), 0.28, 1.05, 0.3));
        g.add(box(0.3, 0.26, 0.3, mat(0x3a3128), -0.3, 0.85, -0.4));
      }
      if (isPig) {
        g.add(box(0.5, 0.42, 0.5, mat(0xf6bcc8), 0, 1.18, 0.92));
        g.add(box(0.28, 0.2, 0.16, mat(0xd9788f), 0, 1.12, 1.2));
        g.add(box(0.12, 0.16, 0.1, mat(0xd9788f), -0.2, 1.36, 0.9));
        g.add(box(0.12, 0.16, 0.1, mat(0xd9788f), 0.2, 1.36, 0.9));
      } else {
        g.add(box(0.52, 0.5, 0.5, mat(isCow ? 0xf3f1ea : 0xe8e4d8), 0, 1.22, 0.92));
        g.add(box(0.34, 0.24, 0.18, mat(skin), 0, 1.12, 1.2));
        g.add(box(0.12, 0.18, 0.1, mat(isCow ? 0xe6e0d0 : 0x33302c), -0.24, 1.44, 0.94));
        g.add(box(0.12, 0.18, 0.1, mat(isCow ? 0xe6e0d0 : 0x33302c), 0.24, 1.44, 0.94));
      }
      // 眼睛
      g.add(box(0.09, 0.09, 0.06, mat(0x201a14), -0.14, 1.3, 1.17));
      g.add(box(0.09, 0.09, 0.06, mat(0x201a14), 0.14, 1.3, 1.17));
      // 尾巴
      g.add(box(0.1, 0.4, 0.1, mat(skin), 0, 1.1, -0.72));
      add4(mat(isCow ? 0xe8e4d8 : 0xdca8b4), 0.22, 0.58, 0.58, 0.32, 0.46);
      break;
    }
    case 'chicken': {
      const w = mat(0xfaf6ec);
      g.add(box(0.46, 0.42, 0.58, w, 0, 0.62, 0));
      g.add(box(0.3, 0.3, 0.28, w, 0, 0.94, 0.34));
      g.add(box(0.1, 0.1, 0.16, mat(0xf0a02a), 0, 0.9, 0.52));
      g.add(box(0.08, 0.12, 0.24, mat(0xd6403a), 0, 1.14, 0.32));
      g.add(box(0.07, 0.07, 0.04, mat(0x201a14), -0.09, 0.98, 0.48));
      g.add(box(0.07, 0.07, 0.04, mat(0x201a14), 0.09, 0.98, 0.48));
      g.add(box(0.3, 0.24, 0.1, w, 0, 0.66, -0.36));
      add4(mat(0xf0a02a), 0.08, 0.4, 0.4, 0.13, 0.12);
      break;
    }
    case 'dog':
    case 'cat': {
      const isDog = kind === 'dog';
      const c = isDog ? 0xa8825a : 0xe0974a;
      const bm = mat(c);
      g.add(box(0.5, 0.46, 0.95, bm, 0, 0.68, 0));
      g.add(box(0.42, 0.4, 0.42, bm, 0, 0.92, 0.62));
      g.add(box(0.24, 0.2, 0.18, mat(isDog ? 0x4a3a2a : 0xf3d9c0), 0, 0.85, 0.86));
      g.add(box(0.07, 0.07, 0.04, mat(0x201a14), -0.11, 0.98, 0.84));
      g.add(box(0.07, 0.07, 0.04, mat(0x201a14), 0.11, 0.98, 0.84));
      // 耳朵
      g.add(box(0.1, 0.18, 0.06, mat(c), -0.16, 1.14, 0.6));
      g.add(box(0.1, 0.18, 0.06, mat(c), 0.16, 1.14, 0.6));
      // 尾巴
      const tail = box(0.09, 0.09, 0.36, mat(c), 0, 0.85, -0.6);
      tail.rotation.x = -0.7;
      g.add(tail);
      add4(mat(c), 0.12, 0.45, 0.45, 0.16, 0.34);
      break;
    }
    case 'slime': {
      const bm = mat(0x63c95a, 0.72);
      const body = box(0.9, 0.9, 0.9, bm, 0, 0.5, 0);
      body.name = 'body';
      g.add(body);
      g.add(box(0.12, 0.12, 0.05, mat(0x14301a), -0.2, 0.62, 0.46));
      g.add(box(0.12, 0.12, 0.05, mat(0x14301a), 0.2, 0.62, 0.46));
      break;
    }
    case 'shadow': {
      const bm = mat(0x2b2440);
      g.add(box(0.8, 0.9, 0.8, bm, 0, 0.75, 0));
      g.add(box(0.5, 0.42, 0.5, bm, 0, 1.3, 0.06));
      const eye = new THREE.MeshBasicMaterial({ color: 0xff5a6a });
      g.add(box(0.14, 0.14, 0.06, eye, -0.13, 1.34, 0.31));
      g.add(box(0.14, 0.14, 0.06, eye, 0.13, 1.34, 0.31));
      g.add(box(0.5, 0.12, 0.5, mat(0x1b1630), 0, 0.3, 0));
      break;
    }
  }
  return { group: g, legs, head };
}

export class Mob {
  readonly def: MobDef;
  readonly group: THREE.Group;
  position = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private target = new THREE.Vector3();
  private timer = 0;
  private walk = 0;
  private parts: Model;
  hp: number;
  /** 好感度：喂到 3 变成宠物会跟着你 */
  friendship = 0;
  pet = false;
  /** 上次收产品的时间戳，防止一直刷 */
  lastGift = 0;
  private soundTimer = 3 + Math.random() * 8;
  private attackCd = 0;
  private dead = false;

  constructor(kind: MobKind, x: number, y: number, z: number) {
    this.def = MOB_DEFS[kind];
    this.hp = this.def.hp;
    this.parts = buildModel(kind);
    this.group = this.parts.group;
    this.group.scale.setScalar(this.def.scale);
    this.position.set(x, y, z);
    this.target.copy(this.position);
    this.timer = Math.random() * 2;
    this.group.position.copy(this.position);
  }

  get kind(): MobKind {
    return this.def.kind;
  }
  get isDead(): boolean {
    return this.dead;
  }

  hit(dmg: number): void {
    this.hp -= dmg;
    sfx.play(this.def.sound);
    if (this.hp <= 0) {
      this.dead = true;
      sfx.play('pop');
    } else {
      // 挨打就跑
      this.timer = 0;
      this.pickFlee();
    }
  }

  /** 被屁熏到：往反方向弹开 */
  scare(px: number, pz: number, force = 4): void {
    const dx = this.position.x - px;
    const dz = this.position.z - pz;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.x += (dx / d) * force;
    this.vel.z += (dz / d) * force;
    this.timer = 0.5;
  }

  private pickFlee(): void {
    const a = Math.random() * Math.PI * 2;
    this.target.set(this.position.x + Math.cos(a) * 7, 0, this.position.z + Math.sin(a) * 7);
  }

  update(
    dt: number,
    world: World,
    playerPos: THREE.Vector3,
    opts: { night: boolean; onDamage: (n: number) => void },
  ): void {
    const d = this.def;
    this.timer -= dt;
    this.attackCd -= dt;
    this.soundTimer -= dt;

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
    toPlayer.y = 0;
    const distPlayer = toPlayer.length();

    let sp = 0;
    if (d.hostile) {
      if (distPlayer < 13) {
        this.target.copy(playerPos);
        if (distPlayer < 1.25 && this.attackCd <= 0) {
          this.attackCd = 1.6;
          opts.onDamage(8);
          sfx.play('hurt');
        }
      } else if (this.timer <= 0) {
        this.timer = 2 + Math.random() * 3;
        this.pickFlee();
      }
      sp = d.speed * (distPlayer < 13 ? 1.25 : 0.7);
    } else if (this.pet && distPlayer > 3.2) {
      // 宠物跟随
      this.target.copy(playerPos);
      sp = d.speed * 1.5;
    } else if (this.timer <= 0) {
      this.timer = 2.5 + Math.random() * 4;
      if (this.pet && distPlayer < 2.4) {
        // 跟着玩家时在附近溜达
        const a = Math.random() * Math.PI * 2;
        this.target.set(playerPos.x + Math.cos(a) * 2.2, 0, playerPos.z + Math.sin(a) * 2.2);
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 6;
        this.target.set(this.position.x + Math.cos(a) * r, 0, this.position.z + Math.sin(a) * r);
      }
      sp = d.speed * 0.55;
    } else {
      const flat = new THREE.Vector3().subVectors(this.target, this.position);
      flat.y = 0;
      sp = flat.length() > 0.6 ? (this.pet ? d.speed * 1.5 : d.speed * 0.55) : 0;
    }

    if (sp > 0) {
      const flat = new THREE.Vector3().subVectors(this.target, this.position);
      flat.y = 0;
      if (flat.length() > 0.4) {
        flat.normalize();
        this.vel.x += (flat.x * sp - this.vel.x) * Math.min(1, dt * 6);
        this.vel.z += (flat.z * sp - this.vel.z) * Math.min(1, dt * 6);
        // 朝向
        const yaw = Math.atan2(flat.x, flat.z);
        let diff = yaw - this.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.group.rotation.y += diff * Math.min(1, dt * 7);
      }
    } else {
      this.vel.x *= 0.85;
      this.vel.z *= 0.85;
    }

    const nx = this.position.x + this.vel.x * dt;
    const nz = this.position.z + this.vel.z * dt;
    const cur = world.groundY(Math.floor(this.position.x), Math.floor(this.position.z));
    const ng = world.groundY(Math.floor(nx), Math.floor(nz));
    // 只走平路：上坡最多 1 格，掉崖超过 2 格就转身
    if (ng - cur > 1 || cur - ng > 2 || ng <= 1) {
      this.vel.x *= -0.5;
      this.vel.z *= -0.5;
      this.timer = 0.2;
    } else {
      this.position.x = nx;
      this.position.z = nz;
    }
    // 贴合地面（史莱姆和暗影怪悬浮）
    const hover = d.kind === 'slime' ? 0.05 : d.kind === 'shadow' ? 0.35 : 0;
    this.position.y = world.groundY(Math.floor(this.position.x), Math.floor(this.position.z)) + hover;

    this.walk += dt * (Math.abs(this.vel.x) + Math.abs(this.vel.z)) * 7;
    const swing = Math.sin(this.walk) * 0.5;
    for (let i = 0; i < this.parts.legs.length; i++) {
      const s = i % 2 === 0 ? swing : -swing;
      this.parts.legs[i].rotation.x = s;
    }
    if (d.kind === 'slime') {
      const s = 1 + Math.sin(this.walk * 0.9) * 0.16;
      this.group.scale.set(d.scale * (2 - s), d.scale * s, d.scale * (2 - s));
    }
    if (d.kind === 'shadow') {
      this.group.position.y = this.position.y + Math.sin(performance.now() / 420) * 0.12;
    }

    this.group.position.set(this.position.x, this.position.y, this.position.z);

    // 偶尔叫一声
    if (this.soundTimer <= 0 && distPlayer < 26) {
      this.soundTimer = 8 + Math.random() * 16;
      sfx.play(d.sound);
    }
    // 白天把暗影怪烧掉
    if (d.hostile && !opts.night) this.hp -= dt * 3;
    if (this.hp <= 0) this.dead = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}

export interface MobUpdateOpts {
  night: boolean;
  onDamage: (n: number) => void;
}

export class MobManager {
  readonly group = new THREE.Group();
  mobs: Mob[] = [];
  private spawnTimer = 6;

  attach(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  clear(): void {
    for (const m of this.mobs) m.dispose();
    this.mobs.length = 0;
  }

  spawn(kind: MobKind, x: number, y: number, z: number): Mob {
    const m = new Mob(kind, x, y, z);
    this.mobs.push(m);
    this.group.add(m.group);
    return m;
  }

  /** 在世界中找一块能站的地面随机放置 */
  spawnRandom(kind: MobKind, world: World, cx: number, cz: number, r = 24): Mob | null {
    for (let i = 0; i < 24; i++) {
      const x = Math.floor(cx + (Math.random() * 2 - 1) * r);
      const z = Math.floor(cz + (Math.random() * 2 - 1) * r);
      if (x < 2 || z < 2 || x >= world.sx - 2 || z >= world.sz - 2) continue;
      const gy = world.groundY(x, z);
      if (gy < 2 || gy > world.sy - 2) continue;
      const below = world.get(x, gy - 1, z);
      // 不在水里、不在岩浆里
      if (below === blocks.water || below === blocks.lava) continue;
      if (world.get(x, gy, z) !== 0) continue;
      return this.spawn(kind, x + 0.5, gy, z + 0.5);
    }
    return null;
  }

  populate(kinds: MobKind[], world: World, cx: number, cz: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      this.spawnRandom(k, world, cx, cz, 26);
    }
  }

  update(dt: number, world: World, playerPos: THREE.Vector3, opts: MobUpdateOpts): void {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      // 太远的生物休眠，省性能
      if (m.position.distanceTo(playerPos) > 60) continue;
      m.update(dt, world, playerPos, opts);
      if (m.isDead) {
        m.dispose();
        this.mobs.splice(i, 1);
      }
    }

    // 夜里在远处刷暗影怪，白天它们会自燃
    if (opts.night) {
      this.spawnTimer -= dt;
      const shadows = this.mobs.filter((m) => m.kind === 'shadow').length;
      if (this.spawnTimer <= 0 && shadows < 5) {
        this.spawnTimer = 9 + Math.random() * 12;
        const a = Math.random() * Math.PI * 2;
        const r = 18 + Math.random() * 14;
        const x = Math.floor(playerPos.x + Math.cos(a) * r);
        const z = Math.floor(playerPos.z + Math.sin(a) * r);
        if (x > 2 && z > 2 && x < world.sx - 2 && z < world.sz - 2) {
          this.spawn('shadow', x + 0.5, world.groundY(x, z) + 0.35, z + 0.5);
        }
      }
    }
  }

  /** 找到视线范围内最近的生物（用于交互） */
  nearest(pos: THREE.Vector3, dir: THREE.Vector3, maxDist = 3.4): Mob | null {
    let best: Mob | null = null;
    let bestD = maxDist;
    for (const m of this.mobs) {
      const d = m.position.distanceTo(pos);
      if (d > bestD) continue;
      const to = new THREE.Vector3().subVectors(m.position, pos).setY(0).normalize();
      const f = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      if (to.dot(f) < 0.1 && d > 1.4) continue;
      best = m;
      bestD = d;
    }
    return best;
  }

  /** 准星前方最近的敌对生物（用于挥剑） */
  nearestHostile(pos: THREE.Vector3, dir: THREE.Vector3, maxDist = 3.2): Mob | null {
    let best: Mob | null = null;
    let bestD = maxDist;
    for (const m of this.mobs) {
      if (!m.def.hostile) continue;
      const d = m.position.distanceTo(pos);
      if (d > bestD) continue;
      const to = new THREE.Vector3().subVectors(m.position, pos).setY(0).normalize();
      const f = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      if (to.dot(f) < 0.55) continue;
      best = m;
      bestD = d;
    }
    return best;
  }

  /** 剑挥出去：打中范围内所有敌对生物 */
  strike(pos: THREE.Vector3, dir: THREE.Vector3, damage: number, reach = 3.0): number {
    let hits = 0;
    for (const m of this.mobs) {
      const to = new THREE.Vector3().subVectors(m.position, pos).setY(0);
      const d = to.length();
      if (d > reach) continue;
      to.normalize();
      const f = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      if (to.dot(f) < 0.35) continue;
      m.hit(damage);
      hits++;
    }
    return hits;
  }
}
