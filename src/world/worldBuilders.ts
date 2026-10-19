/** 地形与建筑生成工具：全部用 putFast 写入，最后统一 rebuildAll */
import type { World } from '../core/world';
import { blocks } from './blockIds';
import { ValueNoise2D, ValueNoise3D, mulberry32 } from '../core/noise';

export interface HeightOptions {
  /** 基础高度 */
  base?: number;
  /** 起伏幅度 */
  amp?: number;
  /** 采样缩放，越小越平缓 */
  scale?: number;
  seed?: number;
  octaves?: number;
  /** 额外的高度变换，例如做盆地/山脊 */
  shape?: (h: number, x: number, z: number, size: number) => number;
  terrace?: boolean;
}

export function heightField(size: number, opt: HeightOptions = {}): Float32Array {
  const n = new ValueNoise2D(opt.seed ?? 7);
  const field = new Float32Array(size * size);
  const scale = opt.scale ?? 0.035;
  const base = opt.base ?? 14;
  const amp = opt.amp ?? 6;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      let h = base + n.fbm(x * scale, z * scale, opt.octaves ?? 4) * amp;
      if (opt.shape) h = opt.shape(h, x, z, size);
      if (opt.terrace) h = Math.round(h / 3) * 3;
      field[z * size + x] = Math.max(1, Math.min(46, h));
    }
  }
  return field;
}

/** 边缘抬高山脉，形成天然边界 */
export function rimShape(h: number, x: number, z: number, size: number): number {
  const c = size / 2;
  const d = Math.max(Math.abs(x - c), Math.abs(z - c)) / c;
  if (d < 0.82) return h;
  const k = (d - 0.82) / 0.18;
  return h + Math.pow(k, 1.6) * 16;
}

export function paintTerrain(w: World, field: Float32Array, opt: { top?: number; sub?: number; deep?: number; water?: number } = {}): void {
  const top = opt.top ?? blocks.grass;
  const sub = opt.sub ?? blocks.dirt;
  const deep = opt.deep ?? blocks.stone;
  const waterLevel = opt.water ?? 0;
  for (let z = 0; z < w.sz; z++) {
    for (let x = 0; x < w.sx; x++) {
      const h = Math.floor(field[z * w.sx + x]);
      for (let y = 0; y <= h; y++) {
        let id = deep;
        if (y === h) id = top;
        else if (y > h - 3) id = sub;
        w.putFast(x, y, z, id);
      }
      if (waterLevel > 0 && h < waterLevel) {
        for (let y = h + 1; y <= waterLevel; y++) w.putFast(x, y, z, blocks.water);
      }
      w.putFast(x, 0, z, blocks.obsidian);
    }
  }
}

export function box(
  w: World,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  id: number,
  hollow = false,
): void {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        if (hollow && x > x0 && x < x1 && y > y0 && y < y1 && z > z0 && z < z1) continue;
        if (w.inBounds(x, y, z)) w.putFast(x, y, z, id);
      }
}

export function walls(
  w: World,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  id: number,
): void {
  box(w, x0, y0, z0, x1, y1, z1, id, true);
  // 补上底面与顶面
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) w.putFast(x, y0, z, id);
}

export function column(w: World, x: number, z: number, y0: number, y1: number, id: number): void {
  for (let y = y0; y <= y1; y++) w.putFast(x, y, z, id);
}

export function groundAt(w: World, x: number, z: number): number {
  for (let y = w.sy - 1; y >= 0; y--) if (w.get(x, y, z) !== 0) return y + 1;
  return 1;
}

export function tree(w: World, x: number, z: number, h = 5, leafId = blocks.leaves): void {
  const g = groundAt(w, x, z);
  for (let y = 0; y < h; y++) w.putFast(x, g + y, z, blocks.wood);
  const top = g + h;
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy <= -1 ? 2 : dy === 0 ? 1 : 0;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && Math.random() < 0.6) continue;
        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
        const px = x + dx;
        const pz = z + dz;
        const py = top + dy;
        if (w.inBounds(px, py, pz) && w.get(px, py, pz) === 0) w.putFast(px, py, pz, leafId);
      }
  }
}

export function scatter(
  w: World,
  count: number,
  seed: number,
  fn: (x: number, z: number, i: number) => void,
): void {
  const rnd = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = 6 + Math.floor(rnd() * (w.sx - 12));
    const z = 6 + Math.floor(rnd() * (w.sz - 12));
    fn(x, z, i);
  }
}

/** 简易木/石房子：带门洞与窗户 */
export function house(
  w: World,
  ox: number,
  oz: number,
  wdt = 7,
  dep = 7,
  hgt = 4,
  matId = blocks.plank,
  roofId = blocks.brick,
): void {
  const g = groundAt(w, ox, oz);
  // 地基平整
  for (let x = ox - 1; x <= ox + wdt; x++)
    for (let z = oz - 1; z <= oz + dep; z++) {
      const gg = groundAt(w, x, z);
      for (let y = gg; y < g; y++) w.putFast(x, y, z, blocks.cobble);
      for (let y = g; y > gg; y--) w.putFast(x, y, z, 0);
    }
  box(w, ox, g, oz, ox + wdt, g + hgt, oz + dep, matId, true);
  box(w, ox, g, oz, ox + wdt, g, oz + dep, blocks.cobble);
  // 屋顶
  for (let y = 0; y <= 2; y++) {
    const inset = y;
    box(w, ox - inset, g + hgt + 1 + y, oz - inset, ox + wdt + inset, g + hgt + 1 + y, oz + dep + inset, roofId, true);
  }
  // 门
  const mx = ox + Math.floor(wdt / 2);
  for (let y = 1; y <= 2; y++) for (let dz = 0; dz < 2; dz++) w.putFast(mx + dz, g + y, oz, 0);
  // 窗（玻璃）
  for (let i = 1; i < hgt; i++) {
    w.putFast(ox, g + i, oz + 2, blocks.glass);
    w.putFast(ox + wdt, g + i, oz + 2, blocks.glass);
    w.putFast(ox + 2, g + i, oz + dep, blocks.glass);
  }
  // 室内灯
  w.putFast(ox + 1, g + hgt, oz + 1, blocks.lamp);
  w.putFast(ox + wdt - 1, g + hgt, oz + dep - 1, blocks.lamp);
}

/** 圆形/方形平台 */
export function platform(w: World, cx: number, cz: number, r: number, y: number, id: number): void {
  for (let x = -r; x <= r; x++)
    for (let z = -r; z <= r; z++) {
      if (Math.hypot(x, z) > r) continue;
      w.putFast(cx + x, y, cz + z, id);
    }
}

/** 3D 噪声洞穴：石体内挖空 */
export function carveCaves(w: World, seed = 11, threshold = 0.12, y0 = 3, y1 = 30): void {
  const n = new ValueNoise3D(seed);
  for (let x = 2; x < w.sx - 2; x++)
    for (let z = 2; z < w.sz - 2; z++)
      for (let y = y0; y < y1; y++) {
        const v = n.noise(x * 0.07, y * 0.09, z * 0.07);
        if (Math.abs(v) < threshold) w.putFast(x, y, z, 0);
      }
}

export function vein(w: World, cx: number, cy: number, cz: number, r: number, id: number, seed = 3): void {
  const rnd = mulberry32(seed);
  for (let i = 0; i < r * r * 8; i++) {
    const a = rnd() * Math.PI * 2;
    const b = rnd() * Math.PI;
    const rr = Math.pow(rnd(), 0.6) * r;
    const x = Math.round(cx + Math.cos(a) * Math.sin(b) * rr);
    const y = Math.round(cy + Math.cos(b) * rr);
    const z = Math.round(cz + Math.sin(a) * Math.sin(b) * rr);
    if (w.inBounds(x, y, z) && w.get(x, y, z) === blocks.stone) w.putFast(x, y, z, id);
  }
}

export function teleportPad(w: World, cx: number, cz: number, y: number, id = blocks.portal): void {
  platform(w, cx, cz, 2, y, id);
}
