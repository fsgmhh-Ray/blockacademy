/** 体素 Chunk 网格生成：面剔除 + 环境光遮蔽 + 简易天空/方块光照烘焙 */
import * as THREE from 'three';
import { blockDef, blockId as idOf, isOpaque } from './blockRegistry';
import { tileUV } from './textures';

export interface NeighborAccess {
  get(x: number, y: number, z: number): number;
  ySize(): number;
}

const AO_LEVELS = [1.0, 0.78, 0.62, 0.5];

/** 面：四个角相对偏移（左下->右下->右上->左上），以及 AO 采样所需的切向量 */
interface FaceDef {
  n: [number, number, number];
  corners: [number, number, number][];
  /** AO 采样：side1, side2, corner（相对相邻方块坐标） */
  ao: [number, number, number][][];
  shade: number;
}

// 每个面的 AO 依赖相邻面上/左/斜角的方块。d = 法线方向
function makeFace(
  n: [number, number, number],
  corners: [number, number, number][],
  u: [number, number, number],
  v: [number, number, number],
  shade: number,
): FaceDef {
  const d = n;
  const ao = corners.map((c) => {
    // 该角相对体素中心的方向，决定是否落在 u/v 轴的正端
    const du = (c[0] - 0.5) * u[0] + (c[1] - 0.5) * u[1] + (c[2] - 0.5) * u[2];
    const dv = (c[0] - 0.5) * v[0] + (c[1] - 0.5) * v[1] + (c[2] - 0.5) * v[2];
    const offU = du > 0 ? 1 : -1;
    const offV = dv > 0 ? 1 : -1;
    return [
      [d[0] + u[0] * offU, d[1] + u[1] * offU, d[2] + u[2] * offU],
      [d[0] + v[0] * offV, d[1] + v[1] * offV, d[2] + v[2] * offV],
      [d[0] + u[0] * offU + v[0] * offV, d[1] + u[1] * offU + v[1] * offV, d[2] + u[2] * offU + v[2] * offV],
    ] as [number, number, number][];
  });
  return { n, corners, ao, shade };
}

const FACES: FaceDef[] = [
  makeFace(
    [1, 0, 0],
    [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    [0, 0, -1],
    [0, 1, 0],
    0.86,
  ),
  makeFace(
    [-1, 0, 0],
    [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [0, 0, 1],
    [0, 1, 0],
    0.86,
  ),
  makeFace(
    [0, 1, 0],
    [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    [1, 0, 0],
    [0, 0, -1],
    1.0,
  ),
  makeFace(
    [0, -1, 0],
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    [1, 0, 0],
    [0, 0, 1],
    0.55,
  ),
  makeFace(
    [0, 0, 1],
    [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    [1, 0, 0],
    [0, 1, 0],
    0.78,
  ),
  makeFace(
    [0, 0, -1],
    [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    [-1, 0, 0],
    [0, 1, 0],
    0.78,
  ),
];

const UVS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export interface ChunkMesh {
  opaque: THREE.BufferGeometry | null;
  alpha: THREE.BufferGeometry | null;
}

class Builder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  vcount = 0;

  quad(
    x: number,
    y: number,
    z: number,
    f: FaceDef,
    uvKey: string,
    light: number,
    aoLevels: number[],
  ) {
    const [u0, v0, u1, v1] = tileUV(uvKey);
    for (let i = 0; i < 4; i++) {
      const c = f.corners[i];
      this.pos.push(x + c[0], y + c[1], z + c[2]);
      this.nor.push(f.n[0], f.n[1], f.n[2]);
      const u = UVS[i][0] === 0 ? u0 : u1;
      const v = UVS[i][1] === 0 ? v0 : v1;
      this.uv.push(u, v);
      const k = Math.max(0.14, light * f.shade * aoLevels[i]);
      this.col.push(k, k, k);
    }
    const b = this.vcount;
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.vcount += 4;
  }

  geometry(): THREE.BufferGeometry | null {
    if (this.vcount === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** 每个 (x,y,z) 的 AO 等级查询 */
function aoAt(w: NeighborAccess, x: number, y: number, z: number, offs: [number, number, number][]): number {
  const s1 = isOpaque(w.get(x + offs[0][0], y + offs[0][1], z + offs[0][2])) ? 1 : 0;
  const s2 = isOpaque(w.get(x + offs[1][0], y + offs[1][1], z + offs[1][2])) ? 1 : 0;
  const cor = isOpaque(w.get(x + offs[2][0], y + offs[2][1], z + offs[2][2])) ? 1 : 0;
  const lvl = s1 && s2 ? 3 : s1 + s2 + cor;
  return AO_LEVELS[Math.min(3, lvl)];
}

export function buildChunkMesh(
  w: NeighborAccess,
  cx: number,
  cz: number,
  cs: number,
  lightAt: (x: number, y: number, z: number) => number,
): ChunkMesh {
  const solid = new Builder();
  const alpha = new Builder();
  const x0 = cx * cs;
  const z0 = cz * cs;

  for (let x = x0; x < x0 + cs; x++) {
    for (let z = z0; z < z0 + cs; z++) {
      for (let y = 0; y < w.ySize(); y++) {
        const id = w.get(x, y, z);
        if (id === 0) continue;
        const def = blockDef(id);
        const target = def.transparent ? alpha : solid;
        const tiles = typeof def.tiles === 'string' ? { top: def.tiles, side: def.tiles, bottom: def.tiles } : def.tiles;
        const selfLight = Math.max(lightAt(x, y, z), def.light ?? 0);

        for (let fi = 0; fi < FACES.length; fi++) {
          const f = FACES[fi];
          const nx = x + f.n[0];
          const ny = y + f.n[1];
          const nz = z + f.n[2];
          const nid = w.get(nx, ny, nz);
          if (nid === id) continue; // 同类方块之间不生成面
          const ndef = blockDef(nid);
          if (ndef.solid && !ndef.transparent) continue; // 被完全遮挡
          if (ndef.solid && id === idOf('water')) continue;

          const uvKey = fi === 2 ? tiles.top : fi === 3 ? tiles.bottom : tiles.side;
          const lv = f.n[1] === 1 ? Math.max(selfLight, lightAt(nx, ny, nz)) : Math.max(selfLight, lightAt(nx, ny, nz) * 0.92);
          target.quad(x, y, z, f, uvKey, def.light ? Math.max(lv, 0.85) : lv, [
            aoAt(w, x, y, z, f.ao[0]),
            aoAt(w, x, y, z, f.ao[1]),
            aoAt(w, x, y, z, f.ao[2]),
            aoAt(w, x, y, z, f.ao[3]),
          ]);
        }
      }
    }
  }

  return { opaque: solid.geometry(), alpha: alpha.geometry() };
}
