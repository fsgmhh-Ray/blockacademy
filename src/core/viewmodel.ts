/**
 * 第一人称手持视图模型
 * 独立渲染一个叠加场景，所以手不会被地形裁剪。
 * 默认只显示右手；左手只有在拿了东西（副手）时才出现，才能挥动。
 */
import * as THREE from 'three';
import { buildAtlas, tileUV } from './textures';
import { blockDef } from './blockRegistry';
import { item, type ItemDef } from '../craft/items';

const SKIN = 0xf2c39a;

function miniBlock(id: number, size: number): THREE.Mesh {
  const d = blockDef(id);
  const tiles = typeof d.tiles === 'string' ? { top: d.tiles, side: d.tiles, bottom: d.tiles } : d.tiles;
  const geo = new THREE.BoxGeometry(size, size, size);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const set = (face: number, key: string) => {
    const [u0, v0, u1, v1] = tileUV(key);
    const i = face * 4;
    uv.setXY(i + 0, u0, v1);
    uv.setXY(i + 1, u1, v1);
    uv.setXY(i + 2, u0, v0);
    uv.setXY(i + 3, u1, v0);
  };
  set(0, tiles.side);
  set(1, tiles.side);
  set(2, tiles.top);
  set(3, tiles.bottom);
  set(4, tiles.side);
  set(5, tiles.side);
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: buildAtlas() }));
  return m;
}

const TOOL_COLOR: Record<number, number> = { 0: 0xa97c4a, 1: 0x8a8a8a, 2: 0xd8dde5, 3: 0xa97ce8 };

function miniTool(it: ItemDef, scale: number): THREE.Group {
  const g = new THREE.Group();
  const c = TOOL_COLOR[it.tier ?? 0] ?? 0xa97c4a;
  const hm = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const hm2 = new THREE.MeshLambertMaterial({ color: c });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), hm);
  handle.position.y = -0.1;
  g.add(handle);

  if (it.tool === 'pickaxe') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.07), hm2);
    head.position.y = 0.09;
    head.rotation.z = 0.12;
    g.add(head);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.06), hm2);
      tip.position.set(s * 0.14, 0.05, 0);
      tip.rotation.z = s * 0.5;
      g.add(tip);
    }
  } else if (it.tool === 'axe') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.17, 0.06), hm2);
    head.position.set(0.05, 0.1, 0);
    head.rotation.z = 0.3;
    g.add(head);
  } else if (it.tool === 'shovel') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.05), hm2);
    head.position.y = -0.24;
    g.add(head);
  } else if (it.tool === 'sword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.03), hm2);
    blade.position.y = 0.1;
    g.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), new THREE.MeshLambertMaterial({ color: 0xb08d57 }));
    guard.position.y = -0.06;
    g.add(guard);
  } else if (it.tool === 'hoe') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), hm2);
    head.position.set(0.06, 0.09, 0);
    g.add(head);
  }
  g.scale.setScalar(scale);
  return g;
}

function miniItem(it: ItemDef, scale: number): THREE.Group {
  const g = new THREE.Group();
  if (it.block !== undefined) {
    const b = miniBlock(it.block, 0.3);
    b.position.y = 0.05;
    g.add(b);
  } else if (it.tool) {
    g.add(miniTool(it, scale * 1.15));
  } else if (it.kind === 'food') {
    const c = it.key === 'bread' ? 0xc78b3f : it.key === 'apple' ? 0xd94a4a : it.key === 'cake' ? 0xf2d3e0 : 0xe88c3a;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshLambertMaterial({ color: c }));
    m.scale.set(1, 0.85, 1);
    g.add(m);
  } else {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.05, 0.22),
      new THREE.MeshLambertMaterial({ color: it.key === 'stick' ? 0xa97c4a : 0xbbbbbb }),
    );
    g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}

/** 一条手臂：上臂 + 袖子 + 手掌 */
function buildArm(sleeve: number, mirror: boolean): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: SKIN });
  const sl = new THREE.MeshLambertMaterial({ color: sleeve });
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.3), skin);
  upper.position.set(0, 0, 0.12);
  g.add(upper);
  const sleeveM = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.16), sl);
  sleeveM.position.set(0, 0, 0.24);
  g.add(sleeveM);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skin);
  hand.position.set(0, 0, 0.36);
  g.add(hand);
  if (mirror) g.scale.x = -1;
  return g;
}

export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.01, 12);

  private right = new THREE.Group();
  private left = new THREE.Group();
  private rightArm: THREE.Group;
  private leftArm: THREE.Group;
  private rightItem = new THREE.Group();
  private leftItem = new THREE.Group();

  private swingR = 0;
  private swingL = 0;
  private bob = 0;
  private rightKey: string | null = null;
  private leftKey: string | null = null;
  visible = true;

  constructor() {
    this.rightArm = buildArm(0x4a7fd4, false);
    this.leftArm = buildArm(0x4a7fd4, true);
    this.right.add(this.rightArm);
    this.left.add(this.leftArm);
    this.rightItem.position.set(0, 0.02, 0.36);
    this.leftItem.position.set(0, 0.02, 0.36);
    this.right.add(this.rightItem);
    this.left.add(this.leftItem);

    this.right.position.set(0.36, -0.34, -0.5);
    this.left.position.set(-0.36, -0.34, -0.5);
    this.right.rotation.set(-0.15, -0.22, 0.1);
    this.left.rotation.set(-0.15, 0.22, -0.1);

    this.scene.add(this.right, this.left);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x556077, 1.15);
    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(0.6, 1, 0.8);
    this.scene.add(hemi, dir);
    this.left.visible = false;
  }

  setSleeve(hex: string): void {
    const c = new THREE.Color(hex);
    for (const arm of [this.rightArm, this.leftArm]) {
      const m = arm.children[1] as THREE.Mesh;
      (m.material as THREE.MeshLambertMaterial).color.copy(c);
    }
  }

  /** 右手（主手）拿什么；null = 空手 */
  setRight(key: string | null): void {
    if (key === this.rightKey) return;
    this.rightKey = key;
    this.rightItem.clear();
    if (key) this.rightItem.add(miniItem(item(key), 1));
  }

  /** 左手（副手）：只有非 null 才显示左手 */
  setLeft(key: string | null): void {
    if (key === this.leftKey) return;
    this.leftKey = key;
    this.left.visible = !!key;
    this.leftItem.clear();
    if (key) this.leftItem.add(miniItem(item(key), 1));
  }

  get hasLeft(): boolean {
    return !!this.leftKey;
  }

  swingRight(): void {
    if (this.swingR <= 0) this.swingR = 1;
  }
  swingLeft(): void {
    if (this.hasLeft && this.swingL <= 0) this.swingL = 1;
  }

  setAspect(a: number): void {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, moving: boolean): void {
    this.bob += dt * (moving ? 7 : 1.6);
    const bx = Math.sin(this.bob) * (moving ? 0.016 : 0.005);
    const by = Math.abs(Math.cos(this.bob)) * (moving ? 0.014 : 0.004);

    if (this.swingR > 0) this.swingR = Math.max(0, this.swingR - dt * 4.2);
    if (this.swingL > 0) this.swingL = Math.max(0, this.swingL - dt * 4.2);
    // 0→1→0 的挥动曲线
    const sr = Math.sin(this.swingR * Math.PI);
    const sl = Math.sin(this.swingL * Math.PI);

    const R = this.right;
    R.rotation.set(-0.15 - sr * 1.15, -0.22 + sr * 0.15, 0.1 + sr * 0.2);
    R.position.set(0.36 + bx - sr * 0.1, -0.34 + by - sr * 0.14, -0.5 - sr * 0.22);

    const L = this.left;
    L.rotation.set(-0.15 - sl * 1.15, 0.22 - sl * 0.15, -0.1 - sl * 0.2);
    L.position.set(-0.36 + bx + sl * 0.1, -0.34 + by - sl * 0.14, -0.5 - sl * 0.22);
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (!this.visible) return;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
}
