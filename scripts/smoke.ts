/**
 * 离线冒烟测试：跑遍 6 个场景的地形生成，并检查 Chunk 网格数据是否自洽。
 * 用法：npm run smoke
 */
import { buildChunkMesh } from '../src/core/mesher';
import { blockDef } from '../src/core/blockRegistry';
import { SCENES } from '../src/world/scenes';

class FakeWorld {
  data: Uint8Array;
  constructor(public sx = 128, public sy = 48, public sz = 128) {
    this.data = new Uint8Array(sx * sy * sz);
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
  putFast(x: number, y: number, z: number, id: number): void {
    if (this.inBounds(x, y, z)) this.data[this.idx(x, y, z)] = id;
  }
  groundY(x: number, z: number): number {
    for (let y = this.sy - 1; y >= 0; y--) if (this.get(x, y, z) !== 0) return y + 1;
    return 1;
  }
}

let failed = 0;
const check = (cond: boolean, msg: string): void => {
  if (!cond) {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
};

console.log('方块学院 · 离线冒烟测试\n');

for (const scene of SCENES) {
  const t0 = Date.now();
  const w = new FakeWorld();
  scene.build(w);
  const ms = Date.now() - t0;

  let solid = 0;
  let air = 0;
  let maxY = 0;
  const used = new Set<number>();
  for (let i = 0; i < w.data.length; i++) {
    const id = w.data[i];
    if (id === 0) air++;
    else {
      solid++;
      used.add(id);
    }
  }
  for (let y = w.sy - 1; y >= 0; y--) {
    out: for (let x = 0; x < w.sx; x++)
      for (let z = 0; z < w.sz; z++)
        if (w.get(x, y, z) !== 0) {
          maxY = y;
          break out;
        }
    if (maxY) break;
  }

  // 出生点必须站得住
  const [sx, sz] = scene.spawn;
  const spawnGround = scene.groundY ?? w.groundY(sx, sz);
  const spawnHeadClear = w.get(sx, spawnGround + 1, sz) === 0 && w.get(sx, spawnGround, sz) === 0;

  console.log(`【${scene.name}】 ${scene.id}`);
  console.log(
    `  生成耗时 ${ms}ms | 实心方块 ${solid} | 空格占比 ${((air / w.data.length) * 100).toFixed(1)}% | 最高 y=${maxY} | 用到 ${used.size} 种方块`,
  );
  check(solid > 20000, `${scene.name}: 实心方块过少(${solid})，地形可能没生成`);
  check(solid < 780000, `${scene.name}: 实心方块过多(${solid})，几乎全是石头`);
  check(spawnHeadClear, `${scene.name}: 出生点 (${sx},${sz}) 上方被堵住（y=${spawnGround}）`);
  check(spawnGround > 1 && spawnGround < w.sy - 8, `${scene.name}: 出生点高度离谱 y=${spawnGround}`);
  check(maxY > 4, `${scene.name}: 地形高度异常 maxY=${maxY}`);

  // NPC 落点检查
  for (const n of scene.npcs) {
    const gy = n.y ?? w.groundY(n.x, n.z);
    const headClear = w.get(n.x, gy + 1, n.z) === 0;
    check(gy > 1 && gy < w.sy - 3, `${scene.name}: NPC ${n.p} 落点高度异常 y=${gy}`);
    check(headClear, `${scene.name}: NPC ${n.p} 头部位置被方块占住`);
  }

  // 演示台/传送座必须能站上去（不会被埋进方块里）
  for (const pad of scene.pads) {
    const gy = pad.y ?? w.groundY(pad.x, pad.z);
    check(gy > 1 && gy < w.sy - 8, `${scene.name}: 演示台 ${pad.label} 落点异常 y=${gy}`);
  }

  // 网格生成数据自洽性（取地图中心的一个 chunk）
  const cx = 4;
  const cz = 4;
  const built = buildChunkMesh(w, cx, cz, 16, () => 0.8);
  const geo = built.opaque;
  check(!!geo, `${scene.name}: 未能生成实体网格`);
  if (geo) {
    const pos = geo.getAttribute('position').array as Float32Array;
    const uv = geo.getAttribute('uv').array as Float32Array;
    const col = geo.getAttribute('color').array as Float32Array;
    const idx = geo.getIndex()!.array as Uint32Array | Uint16Array;
    const verts = pos.length / 3;
    const tris = idx.length / 3;
    check(verts % 4 === 0, `${scene.name}: 顶点数 ${verts} 不是 4 的倍数`);
    check(idx.length % 6 === 0, `${scene.name}: 索引数异常`);
    check(tris === verts / 2, `${scene.name}: 三角形数(${tris})与顶点数(${verts})不匹配`);
    let maxIdx = 0;
    for (let i = 0; i < idx.length; i++) maxIdx = Math.max(maxIdx, idx[i]);
    check(maxIdx < verts, `${scene.name}: 索引越界 ${maxIdx} >= ${verts}`);
    let badUV = 0;
    for (let i = 0; i < uv.length; i++) if (uv[i] < -0.001 || uv[i] > 1.001) badUV++;
    check(badUV === 0, `${scene.name}: 有 ${badUV} 个 UV 超出 [0,1]`);
    let badCol = 0;
    for (let i = 0; i < col.length; i++) if (col[i] < 0 || col[i] > 1.001) badCol++;
    check(badCol === 0, `${scene.name}: 有 ${badCol} 个顶点色越界`);
    let oob = 0;
    for (let i = 0; i < pos.length; i++) {
      const v = pos[i];
      if (v < -0.01 || v > 200) oob++;
    }
    check(oob === 0, `${scene.name}: 有 ${oob} 个坐标分量越界`);
    console.log(`  网格采样(chunk ${cx},${cz}): ${verts} 顶点 / ${tris} 三角形 / 索引上限 ${maxIdx}`);
  }
  console.log('');
}

// 方块表自检
console.log('【方块表】');
const ids = new Map<number, string>();
for (let i = 0; i <= 41; i++) {
  const d = blockDef(i);
  check(!!d, `id=${i} 没有对应的方块定义`);
  if (d) check(d.id === i, `id 错位：期望 ${i}，实际 ${d.id}（${d.key}）`);
  if (ids.has(i)) check(false, `id=${i} 重复`);
  ids.set(i, d?.key ?? '?');
}
check(blockDef(0).key === 'air', '0 号必须是空气');
console.log(`  已注册 ${ids.size} 种方块，id = 0..41 全部对齐\n`);

if (failed === 0) {
  console.log('✅ 全部检查通过');
} else {
  console.log(`❌ 共 ${failed} 项检查未通过`);
  process.exitCode = 1;
}
