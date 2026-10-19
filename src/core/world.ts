/** 体素世界：数据存储、光照烘焙、Chunk 网格管理、射线拾取与碰撞查询 */
import * as THREE from 'three';
import { buildAtlas } from './textures';
import { buildChunkMesh, type ChunkMesh } from './mesher';
import { blockDef, isSolid } from './blockRegistry';

export const CHUNK = 16;

export interface VoxelHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  id: number;
  dist: number;
}

export class World {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly data: Uint8Array;
  readonly light: Float32Array;
  readonly columnTop: Int16Array;
  readonly group = new THREE.Group();

  private mat: THREE.MeshLambertMaterial;
  private matAlpha: THREE.MeshLambertMaterial;
  private chunks = new Map<string, { key: string; cx: number; cz: number; solid: THREE.Mesh | null; alpha: THREE.Mesh | null }>();
  private dirty = new Set<string>();
  private cxCount = 0;
  private czCount = 0;

  constructor(sx = 128, sy = 48, sz = 128) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
    this.data = new Uint8Array(sx * sy * sz);
    this.light = new Float32Array(sx * sy * sz);
    this.columnTop = new Int16Array(sx * sz).fill(-1);
    this.cxCount = Math.ceil(sx / CHUNK);
    this.czCount = Math.ceil(sz / CHUNK);

    const atlas = buildAtlas();
    this.mat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
    this.matAlpha = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  idx(x: number, y: number, z: number): number {
    return (y * this.sz + z) * this.sx + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.sx && y >= 0 && y < this.sy && z >= 0 && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.data[this.idx(x, y, z)];
  }

  ySize(): number {
    return this.sy;
  }

  set(x: number, y: number, z: number, id: number): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = id;
    this.refreshColumn(x, z);
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    this.markDirty(cx, cz);
    // 边界上的方块会影响邻 chunk 的面剔除
    if (x % CHUNK === 0) this.markDirty(cx - 1, cz);
    if (x % CHUNK === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (z % CHUNK === 0) this.markDirty(cx, cz - 1);
    if (z % CHUNK === CHUNK - 1) this.markDirty(cx, cz + 1);
    const def = blockDef(id);
    if (def.light || id === 0) this.lightDirty = true;
  }

  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: number): void {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.putFast(x, y, z, id);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.refreshColumn(x, z);
    this.markAllDirty();
  }

  /** 不更新光照/脏标记的批量写入 */
  putFast(x: number, y: number, z: number, id: number): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = id;
  }

  /** 找到指定 xz 上可站立的高度（地表最高方块的顶面） */
  groundY(x: number, z: number): number {
    const t = this.columnTop[z * this.sx + x];
    return t < 0 ? 1 : t + 1;
  }

  columnHeight(x: number, z: number): number {
    return this.columnTop[z * this.sx + x];
  }

  refreshColumn(x: number, z: number): void {
    let top = -1;
    for (let y = this.sy - 1; y >= 0; y--) {
      const id = this.data[this.idx(x, y, z)];
      if (id !== 0) {
        const def = blockDef(id);
        if (def.solid && !def.transparent) {
          top = y;
          break;
        }
        if (top < 0) top = y; // 透明/非实体方块也算“表面”，但不遮挡光
      }
    }
    // 需要的是“最高不透明方块”，重新精确扫描
    let opaqueTop = -1;
    for (let y = this.sy - 1; y >= 0; y--) {
      const d = blockDef(this.data[this.idx(x, y, z)]);
      if (d.solid && !d.transparent) {
        opaqueTop = y;
        break;
      }
    }
    this.columnTop[z * this.sx + x] = opaqueTop >= 0 ? opaqueTop : top;
  }

  refreshAllColumns(): void {
    for (let x = 0; x < this.sx; x++) for (let z = 0; z < this.sz; z++) this.refreshColumn(x, z);
  }

  private lightDirty = false;

  /** 从发光方块做一次 BFS 距离衰减 */
  rebuildLight(): void {
    this.light.fill(0);
    const queue: number[] = [];
    for (let i = 0; i < this.data.length; i++) {
      const d = blockDef(this.data[i]);
      if (d.light && d.light > 0) {
        this.light[i] = Math.min(1, d.light);
        queue.push(i);
      }
    }
    if (queue.length === 0) {
      this.lightDirty = false;
      return;
    }
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const lv = this.light[cur];
      if (lv <= 0.08) continue;
      const y = Math.floor(cur / (this.sx * this.sz));
      const rem = cur - y * this.sx * this.sz;
      const z = Math.floor(rem / this.sx);
      const x = rem - z * this.sx;
      const next = lv - 0.12;
      const push = (nx: number, ny: number, nz: number) => {
        if (!this.inBounds(nx, ny, nz)) return;
        const j = this.idx(nx, ny, nz);
        if (this.light[j] >= next) return;
        const b = blockDef(this.data[j]);
        if (b.solid && !b.transparent) {
          this.light[j] = Math.max(this.light[j], Math.max(0, lv - 0.5));
          return;
        }
        this.light[j] = next;
        queue.push(j);
      };
      push(x + 1, y, z);
      push(x - 1, y, z);
      push(x, y + 1, z);
      push(x, y - 1, z);
      push(x, y, z + 1);
      push(x, y, z - 1);
    }
    this.lightDirty = false;
  }

  /** 综合光照（天空 + 方块光），范围 0~1 */
  lightAt(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0.85;
    const top = this.columnTop[z * this.sx + x];
    let sky = 1;
    if (top >= 0 && y <= top) sky = Math.max(0.2, 1 - (top - y) * 0.08);
    const b = this.light[this.idx(x, y, z)];
    return Math.max(sky, b);
  }

  isSolidAt(x: number, y: number, z: number): boolean {
    if (y < 0) return true;
    if (!this.inBounds(x, y, z)) return false;
    return isSolid(this.data[this.idx(x, y, z)]);
  }

  /** AABB vs 体素：返回是否与任何实心方块相交 */
  boxIntersects(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    const x0 = Math.floor(minX);
    const x1 = Math.floor(maxX - 1e-6);
    const y0 = Math.floor(minY);
    const y1 = Math.floor(maxY - 1e-6);
    const z0 = Math.floor(minZ);
    const z1 = Math.floor(maxZ - 1e-6);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) if (this.isSolidAt(x, y, z)) return true;
    return false;
  }

  /** DDA 体素射线拾取 */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist = 6): VoxelHit | null {
    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);
    let tMaxX = dx === 0 ? Infinity : ((dx > 0 ? x + 1 - ox : ox - x) * tDeltaX);
    let tMaxY = dy === 0 ? Infinity : ((dy > 0 ? y + 1 - oy : oy - y) * tDeltaY);
    let tMaxZ = dz === 0 ? Infinity : ((dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ);
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let t = 0;

    // 起点就命中
    if (this.inBounds(x, y, z) && this.data[this.idx(x, y, z)] !== 0) {
      return { x, y, z, nx: 0, ny: 1, nz: 0, id: this.data[this.idx(x, y, z)], dist: 0 };
    }

    while (t < maxDist) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
      if (t > maxDist) break;
      if (!this.inBounds(x, y, z)) continue;
      const id = this.data[this.idx(x, y, z)];
      if (id !== 0 && isSolid(id)) return { x, y, z, nx, ny, nz, id, dist: t };
    }
    return null;
  }

  markDirty(cx: number, cz: number): void {
    if (cx < 0 || cz < 0 || cx >= this.cxCount || cz >= this.czCount) return;
    this.dirty.add(`${cx},${cz}`);
  }

  markAllDirty(): void {
    for (let cx = 0; cx < this.cxCount; cx++) for (let cz = 0; cz < this.czCount; cz++) this.dirty.add(`${cx},${cz}`);
  }

  clearMeshes(): void {
    for (const c of this.chunks.values()) {
      if (c.solid) {
        this.group.remove(c.solid);
        c.solid.geometry.dispose();
      }
      if (c.alpha) {
        this.group.remove(c.alpha);
        c.alpha.geometry.dispose();
      }
    }
    this.chunks.clear();
    this.dirty.clear();
  }

  /** 立即重建全部 chunk（切换场景时调用） */
  rebuildAll(): void {
    this.refreshAllColumns();
    this.rebuildLight();
    this.clearMeshes();
    for (let cx = 0; cx < this.cxCount; cx++) for (let cz = 0; cz < this.czCount; cz++) this.buildChunk(cx, cz);
    this.dirty.clear();
  }

  private buildChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const existing = this.chunks.get(key);
    if (existing) {
      if (existing.solid) {
        this.group.remove(existing.solid);
        existing.solid.geometry.dispose();
      }
      if (existing.alpha) {
        this.group.remove(existing.alpha);
        existing.alpha.geometry.dispose();
      }
      this.chunks.delete(key);
    }
    const built: ChunkMesh = buildChunkMesh(this, cx, cz, CHUNK, (x, y, z) => this.lightAt(x, y, z));
    const entry = { key, cx, cz, solid: null as THREE.Mesh | null, alpha: null as THREE.Mesh | null };
    if (built.opaque) {
      entry.solid = new THREE.Mesh(built.opaque, this.mat);
      entry.solid.frustumCulled = true;
      this.group.add(entry.solid);
    }
    if (built.alpha) {
      entry.alpha = new THREE.Mesh(built.alpha, this.matAlpha);
      entry.alpha.renderOrder = 2;
      this.group.add(entry.alpha);
    }
    this.chunks.set(key, entry);
  }

  /** 每帧限量消化脏 chunk，避免掉帧 */
  flushDirty(budget = 2): void {
    if (this.lightDirty) this.rebuildLight();
    let n = 0;
    for (const key of this.dirty) {
      const [cx, cz] = key.split(',').map(Number);
      this.buildChunk(cx, cz);
      this.dirty.delete(key);
      if (++n >= budget) break;
    }
  }

  get dirtyCount(): number {
    return this.dirty.size;
  }

  dispose(): void {
    this.clearMeshes();
    this.mat.dispose();
    this.matAlpha.dispose();
  }
}
