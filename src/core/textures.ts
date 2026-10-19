/**
 * 程序化贴图图集：不依赖任何外部图片资源，离线可玩。
 * atlas 为 8x8 网格，每格 16x16 像素 -> 128x128 纹理。
 */
import * as THREE from 'three';

export const TILE = 16;
export const GRID = 8;
const SIZE = TILE * GRID;

type Painter = (px: (x: number, y: number, rgb: number, a?: number) => void, rnd: () => number) => void;

const hex = (h: number) => [h & 255, (h >> 8) & 255, (h >> 16) & 255] as const;
const pack = (r: number, g: number, b: number) => (255 << 24) | (b << 16) | (g << 8) | r;

function shade(rgb: number, k: number): number {
  const r = Math.min(255, Math.max(0, (rgb & 255) * k)) | 0;
  const g = Math.min(255, Math.max(0, ((rgb >> 8) & 255) * k)) | 0;
  const b = Math.min(255, Math.max(0, ((rgb >> 16) & 255) * k)) | 0;
  return pack(r, g, b);
}

function base(color: number, spec = 0.12, rndSeed = 1): Painter {
  let seed = rndSeed;
  return (px, rnd) => {
    const c = hex(color);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const k = 1 - rnd() * spec;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        px(x, y, pack(Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)));
      }
    }
  };
}

function overlay(fn: (x: number, y: number, rnd: () => number) => number | null): Painter {
  return (px, rnd) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const c = fn(x, y, rnd);
        if (c !== null) px(x, y, c);
      }
    }
  };
}

const combine = (...ps: Painter[]): Painter => (px, rnd) => ps.forEach((p) => p(px, rnd));

function grid(pattern: (gx: number, gy: number) => number | null, cell = 8): Painter {
  return (px, rnd) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const c = pattern(Math.floor(x / cell), Math.floor(y / cell));
        if (c !== null) px(x, y, c);
      }
    }
  };
}

const TILES: Record<string, Painter> = {
  air: () => {},

  grass_top: combine(
    base(0x5f9e3f, 0.18),
    overlay((x, y, rnd) => (rnd() < 0.25 ? (rnd() < 0.5 ? pack(0x74, 0xc9, 0x53) : pack(0x4d, 0x86, 0x32)) : null)),
  ),
  grass_side: combine(
    base(0x8b5a2b, 0.16),
    overlay((x, y, rnd) => {
      if (y < 4 + Math.floor(rnd() * 3)) return y < 3 ? pack(0x66, 0xb2, 0x45) : pack(0x5f, 0x9e, 0x3f);
      if (rnd() < 0.08) return pack(0x6f, 0x46, 0x22);
      return null;
    }),
  ),
  dirt: combine(
    base(0x8b5a2b, 0.16),
    overlay((_x, _y, rnd) => (rnd() < 0.12 ? pack(0x74, 0x48, 0x24) : null)),
  ),
  sand: combine(
    base(0xe3d3a0, 0.1),
    overlay((_x, _y, rnd) => (rnd() < 0.15 ? pack(0xd2, 0xbf, 0x86) : null)),
  ),
  sandstone: combine(
    base(0xd9c88f, 0.08),
    overlay((x, y) => (y % 8 === 7 ? pack(0xc2, 0xb0, 0x79) : null)),
  ),
  stone: combine(
    base(0x8b8b8b, 0.14),
    overlay((_x, _y, rnd) => (rnd() < 0.1 ? pack(0x76, 0x76, 0x76) : null)),
  ),
  cobble: combine(
    base(0x7a7a7a, 0.2),
    overlay((x, y, rnd) => {
      const cx = (x % 7) + 1;
      const cy = (y % 7) + 1;
      if (cx === 1 || cy === 1) return pack(0x5c, 0x5c, 0x5c);
      return rnd() < 0.12 ? pack(0x8f, 0x8f, 0x8f) : null;
    }),
  ),
  stone_brick: combine(
    base(0x717171, 0.1),
    overlay((x, y, rnd) => {
      const row = Math.floor(y / 4);
      const off = row % 2 === 0 ? 0 : 4;
      if (y % 4 === 3) return pack(0x50, 0x50, 0x50);
      if ((x + off) % 8 === 0) return pack(0x50, 0x50, 0x50);
      return rnd() < 0.08 ? pack(0x80, 0x80, 0x80) : null;
    }),
  ),
  wood_top: combine(
    base(0xa9743f, 0.1),
    overlay((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (Math.floor(d) % 2 === 0 && d < 8) return pack(0x8a, 0x5c, 0x31);
      return null;
    }),
  ),
  wood_side: combine(
    base(0x9a6b3f, 0.1),
    overlay((x, y, rnd) => {
      if (x % 4 === 0) return pack(0x7d, 0x53, 0x2e);
      if (rnd() < 0.06) return pack(0x8b, 0x5f, 0x36);
      return null;
    }),
  ),
  plank: combine(
    base(0xc09a63, 0.1),
    overlay((x, y, rnd) => {
      if (y % 5 === 4) return pack(0x9c, 0x78, 0x45);
      if (rnd() < 0.07) return pack(0xb0, 0x8b, 0x56);
      return null;
    }),
  ),
  leaves: combine(
    base(0x4f9d3a, 0.22),
    overlay((x, y, rnd) => {
      const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
      if (edge && rnd() < 0.6) return null;
      if (rnd() < 0.28) return rnd() < 0.5 ? pack(0x3f, 0x84, 0x2e) : pack(0x68, 0xbb, 0x4d);
      return null;
    }),
  ),
  brick: combine(
    base(0xa04e3e, 0.08),
    overlay((x, y) => {
      const row = Math.floor(y / 4);
      const off = row % 2 === 0 ? 0 : 4;
      if (y % 4 === 3) return pack(0xc8, 0xb8, 0xa8);
      if ((x + off) % 8 === 7) return pack(0xc8, 0xb8, 0xa8);
      return null;
    }),
  ),
  glass: combine(
    overlay((x, y) => {
      if (x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1) return pack(0xd8, 0xf2, 0xff);
      if ((x + y) % 9 === 0) return pack(0xcc, 0xec, 0xff);
      return null;
    }),
    base(0xbfefff, 0.05),
  ),
  water: combine(
    overlay(() => pack(0x35, 0x74, 0xc8)),
    overlay((x, y, rnd) => {
      if (rnd() < 0.12) return pack(0x59, 0x9a, 0xe8);
      return null;
    }),
  ),
  lava: combine(
    base(0xd64a12, 0.15),
    overlay((_x, _y, rnd) => (rnd() < 0.18 ? pack(0xff, 0x9c, 0x2e) : null)),
  ),
  snow: combine(
    base(0xf5f9fc, 0.05),
    overlay((_x, _y, rnd) => (rnd() < 0.08 ? pack(0xe2, 0xeb, 0xf5) : null)),
  ),
  snow_side: combine(
    base(0x8b5a2b, 0.12),
    overlay((x, y, rnd) => {
      if (y < 4 + Math.floor(rnd() * 2)) return pack(0xf5, 0xf9, 0xfc);
      return rnd() < 0.08 ? pack(0x74, 0x48, 0x24) : null;
    }),
  ),
  ice: combine(overlay(() => pack(0x9f, 0xdc, 0xf5)), overlay((_x, _y, rnd) => (rnd() < 0.2 ? pack(0xc9, 0xf0, 0xff) : null))),
  gravel: combine(
    base(0x8d8d8d, 0.25),
    overlay((x, y, rnd) => {
      const cx = (x * 7) % 5;
      const cy = (y * 5) % 6;
      if (cx === 0 || cy === 0) return pack(0x6c, 0x6c, 0x6c);
      return rnd() < 0.15 ? pack(0xa5, 0xa5, 0xa5) : null;
    }),
  ),
  coal_ore: combine(base(0x8b8b8b, 0.14), overlay((x, y, rnd) => (rnd() < 0.07 && Math.hypot(x - 6, y - 9) < 5 ? pack(0x24, 0x24, 0x24) : null))),
  iron_ore: combine(base(0x8b8b8b, 0.14), overlay((x, y, rnd) => (rnd() < 0.08 && Math.hypot(x - 10, y - 5) < 4 ? pack(0xd9, 0xa9, 0x8a) : null))),
  gold_ore: combine(base(0x8b8b8b, 0.14), overlay((x, y, rnd) => (rnd() < 0.08 && Math.hypot(x - 4, y - 6) < 4 ? pack(0xf2, 0xcf, 0x5c) : null))),
  crystal_ore: combine(
    base(0x4a3a63, 0.18),
    overlay((x, y, rnd) => (rnd() < 0.12 && Math.hypot(x - 8, y - 8) < 6 ? pack(0xc9, 0x9c, 0xff) : null)),
  ),
  quartz: combine(base(0xf2f0ea, 0.06), overlay((x, y, rnd) => (rnd() < 0.1 ? pack(0xdc, 0xd9, 0xcf) : null))),
  wool_white: combine(base(0xf5f5f5, 0.08), overlay((_x, _y, rnd) => (rnd() < 0.1 ? pack(0xe4, 0xe4, 0xe4) : null))),
  wool_red: combine(base(0xc94a4a, 0.1), overlay((_x, _y, rnd) => (rnd() < 0.1 ? pack(0xb2, 0x3a, 0x3a) : null))),
  wool_blue: combine(base(0x4a72c9, 0.1), overlay((_x, _y, rnd) => (rnd() < 0.1 ? pack(0x3a, 0x5e, 0xb0) : null))),
  wool_yellow: combine(base(0xd9c44a, 0.1), overlay((_x, _y, rnd) => (rnd() < 0.1 ? pack(0xc2, 0xae, 0x3a) : null))),
  wool_purple: combine(base(0x8a5fd0, 0.1), overlay((_x, _y, rnd) => (rnd() < 0.1 ? pack(0x76, 0x4c, 0xb8) : null))),
  wool_green: combine(base(0x54a34a, 0.1), overlay((_x, _y, rnd) => (rnd() < 0.1 ? pack(0x44, 0x8c, 0x3a) : null))),
  lamp: combine(
    base(0xffe08a, 0.06),
    grid((gx, gy) => ((gx + gy) % 2 === 0 ? pack(0xff, 0xf0, 0xb8) : null), 4),
    overlay((x, y) => (x % 8 === 0 || y % 8 === 0 ? pack(0xd8, 0xa0, 0x3a) : null)),
  ),
  metal: combine(
    base(0xb8bcc4, 0.1),
    overlay((x, y, rnd) => {
      if (x === 0 || y === 0) return pack(0x8f, 0x94, 0x9c);
      if (rnd() < 0.1) return pack(0xd2, 0xd6, 0xdd);
      return null;
    }),
  ),
  obsidian: combine(base(0x1f1b2e, 0.16), overlay((_x, _y, rnd) => (rnd() < 0.1 ? pack(0x3a, 0x2f, 0x56) : null))),
  farmland: combine(
    base(0x6b4a2f, 0.14),
    overlay((x, y, rnd) => {
      if (y % 4 === 0) return pack(0x53, 0x39, 0x24);
      return rnd() < 0.08 ? pack(0x7b, 0x57, 0x38) : null;
    }),
  ),
  wheat: combine(
    base(0x7fb04a, 0.05),
    overlay((x, y) => (x % 4 < 2 ? pack(0xdc, 0xc9, 0x6b) : null)),
  ),
  flower_red: combine(
    base(0x5f9e3f, 0.05),
    overlay((x, y) => (Math.hypot(x - 8, y - 6) < 3 ? pack(0xd9, 0x53, 0x6a) : null)),
  ),
  flower_yellow: combine(
    base(0x5f9e3f, 0.05),
    overlay((x, y) => (Math.hypot(x - 8, y - 6) < 3 ? pack(0xe9, 0xc9, 0x4a) : null)),
  ),
  cactus: combine(
    base(0x3f8f4f, 0.1),
    overlay((x, y) => {
      if (x === 0 || x === TILE - 1 || y === 0 || y === TILE - 1) return pack(0x2f, 0x72, 0x3e);
      if ((x + y) % 7 === 0) return pack(0xd8, 0xe8, 0xc8);
      return null;
    }),
  ),
  mushroom: combine(base(0x5f9e3f, 0.05), overlay((x, y) => (Math.hypot(x - 8, y - 9) < 4 ? pack(0xc0, 0x6a, 0x6a) : null))),
  star: combine(
    base(0x1b1b3a, 0.05),
    overlay((x, y, rnd) => {
      if (rnd() < 0.06) return pack(0xfd, 0xf6, 0xc9);
      if (rnd() < 0.02) return pack(0xff, 0xff, 0xff);
      return null;
    }),
  ),
  cloud: combine(base(0xffffff, 0.04), overlay((_x, _y, rnd) => (rnd() < 0.06 ? pack(0xe8, 0xf2, 0xff) : null))),
  portal: combine(
    base(0x2a1f4a, 0.1),
    overlay((x, y, rnd) => {
      const d = Math.hypot(x - 8, y - 8);
      if (Math.abs(d - 5) < 1.2) return pack(0x7c, 0xe8, 0xff);
      if (rnd() < 0.05) return pack(0x9c, 0x8c, 0xff);
      return null;
    }),
  ),
  board: combine(
    base(0x6b4a2f, 0.1),
    overlay((x, y) => {
      if (x < 2 || y < 2 || x > 13 || y > 13) return pack(0x8b, 0x5f, 0x36);
      return pack(0x33, 0x2a, 0x22);
    }),
  ),
};

/** tile key -> atlas 格位索引 */
const index = new Map<string, number>();
let builtTexture: THREE.Texture | null = null;
let builtCanvas: HTMLCanvasElement | null = null;

/** 取原始 canvas（UI 里画方块小图标用） */
export function atlasCanvas(): HTMLCanvasElement | null {
  buildAtlas();
  return builtCanvas;
}

/** 兼容遗留：按梦境愿景绘制的额外贴（不使用） */
export function buildAtlas(): THREE.Texture {
  if (builtTexture) return builtTexture;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  const buf = new Uint32Array(img.data.buffer);
  buf.fill(0);

  let slot = 0;
  for (const key of Object.keys(TILES)) {
    const col = slot % GRID;
    const row = Math.floor(slot / GRID);
    const rnd = (() => {
      let s = (slot * 2654435761 + 12345) >>> 0;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    })();
    const painter = TILES[key];
    painter(
      (x, y, rgb, a = 255) => {
        if (a === 0) return;
        const gx = col * TILE + x;
        const gy = row * TILE + y;
        buf[gy * SIZE + gx] = rgb | (a << 24);
      },
      rnd,
    );
    index.set(key, slot);
    slot++;
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  builtCanvas = canvas;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  builtTexture = tex;
  return tex;
}

/** 返回 tileKey 的四角 UV（左下顺时针） */
export function tileUV(key: string): [number, number, number, number] {
  const i = index.get(key) ?? 0;
  const col = i % GRID;
  const row = Math.floor(i / GRID);
  const u0 = col / GRID + 0.001;
  const u1 = (col + 1) / GRID - 0.001;
  const v1 = 1 - row / GRID - 0.001;
  const v0 = 1 - (row + 1) / GRID + 0.001;
  return [u0, v0, u1, v1];
}

export function tileIdOf(key: string): number {
  return index.get(key) ?? 0;
}

export { shade };
