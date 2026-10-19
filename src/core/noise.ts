/** 轻量确定性噪声：用于地形、贴图纹理与 NPC 行为抖动 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class ValueNoise2D {
  private perm: Uint8Array;
  constructor(seed = 1) {
    const rnd = mulberry32(seed);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = base[i];
      base[i] = base[j];
      base[j] = t;
    }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    this.perm = p;
  }

  noise(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const p = this.perm;
    const aa = p[p[xi] + yi] / 255;
    const ba = p[p[xi + 1] + yi] / 255;
    const ab = p[p[xi] + yi + 1] / 255;
    const bb = p[p[xi + 1] + yi + 1] / 255;
    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v) * 2 - 1;
  }

  /** 分形叠加，返回约 [-1,1] */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

export class ValueNoise3D {
  private n: ValueNoise2D;
  constructor(seed = 1) {
    this.n = new ValueNoise2D(seed);
  }
  noise(x: number, y: number, z: number): number {
    // 用两个 2D 采样做便宜的伪 3D
    const a = this.n.noise(x, z);
    const b = this.n.noise(x + 31.7, z + 11.3);
    const c = this.n.noise(x * 0.5 + y * 0.75, z * 0.5 - y * 0.35);
    return (a + b + c) / 3;
  }
}
