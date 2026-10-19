/**
 * 离线冒烟测试：跑遍 6 个场景的地形生成，并检查 Chunk 网格数据是否自洽。
 * 用法：npm run smoke
 */
import { buildChunkMesh } from '../src/core/mesher';
import { blockDef, BLOCK_LIST } from '../src/core/blockRegistry';
import { hasTile, GRID, ATLAS_TILES } from '../src/core/textures';
import { SCENES } from '../src/world/scenes';
import { Inventory } from '../src/craft/inventory';
import { allRecipes } from '../src/craft/crafting';
import { allItems, blockItems } from '../src/craft/items';

const RECIPE_COUNT = allRecipes().length;
const ITEM_COUNT = allItems().length;

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

// 合成与背包自检
console.log('【合成】');
{
  const inv = new Inventory();
  check(inv.slots.every((s) => s === null), '新背包必须是空的');

  const put = (i: Inventory, cells: Record<number, string>) => {
    i.craft = Array.from({ length: 9 }, () => null);
    for (const [k, v] of Object.entries(cells)) i.craft[Number(k)] = { key: v, count: 1 };
  };
  const result = (i: Inventory) => i.craftResult;

  inv.tab = 'bag';
  put(inv, { 0: 'wood' });
  check(result(inv)?.key === 'plank' && result(inv)?.count === 4, '1 木头 → 4 木板');
  put(inv, { 0: 'plank', 1: 'plank' });
  check(result(inv)?.key === 'stick' && result(inv)?.count === 4, '2 木板 → 4 木棍');
  put(inv, { 0: 'plank', 1: 'plank', 3: 'plank', 4: 'plank' });
  check(result(inv)?.key === 'crafting_table', '4 木板 → 工作台');

  inv.tab = 'craft';
  // 形状配方平移到右下角也必须识别（防止裁剪逻辑又把 . 当成内容）
  put(inv, { 4: 'plank', 5: 'plank', 7: 'plank', 8: 'plank' });
  check(result(inv)?.key === 'crafting_table', '形状配方平移后仍可识别');
  put(inv, { 0: 'plank', 1: 'plank', 2: 'plank', 4: 'stick', 7: 'stick' });
  check(result(inv)?.key === 'wood_pickaxe', '木镐配方');
  put(inv, { 1: 'crystal_shard', 4: 'crystal_shard', 7: 'stick' });
  check(result(inv)?.key === 'crystal_sword', '水晶剑配方（窄形状）');
  put(inv, { 0: 'cobble', 1: 'cobble', 2: 'cobble', 3: 'cobble', 5: 'cobble', 6: 'cobble', 7: 'cobble', 8: 'cobble' });
  check(result(inv)?.key === 'furnace', '8 圆石 → 熔炉');

  // 3×3 专属配方不能在 2×2 里合成
  inv.tab = 'bag';
  put(inv, { 0: 'plank', 1: 'plank', 4: 'stick', 3: 'stick' });
  check(result(inv)?.key !== 'wood_pickaxe', '工作台配方在 2×2 里不生效');

  inv.tab = 'furnace';
  inv.furnaceIn = { key: 'iron_ore', count: 1 };
  check(result(inv)?.key === 'iron_ingot', '熔炉：铁矿石 → 铁锭');
  inv.furnaceIn = { key: 'sand', count: 1 };
  check(result(inv)?.key === 'glass', '熔炉：沙子 → 玻璃');

  const inv2 = new Inventory();
  inv2.add('cobble', 200);
  check(inv2.countOf('cobble') === 200, '大量物品可堆进多格');
  check(inv2.remove('cobble', 150) && inv2.countOf('cobble') === 50, '背包扣除正确');
  check(!inv2.remove('cobble', 9999), '数量不足时扣除失败');

  const inv3 = new Inventory();
  inv3.add('wood_pickaxe', 1);
  inv3.add('bread', 5);
  inv3.offhand = { key: 'torch', count: 3 };
  const inv4 = new Inventory();
  inv4.load(inv3.serialize());
  check(inv4.countOf('wood_pickaxe') === 1 && inv4.countOf('bread') === 5, '存档往返：物品保留');
  check(!!inv4.offhand && inv4.offhand.key === 'torch', '存档往返：副手槽保留');
  console.log(`  配方 ${RECIPE_COUNT} 条 / 物品 ${ITEM_COUNT} 种\n`);
}

// 方块表自检
console.log('【方块表】');
const total = BLOCK_LIST.length;
const ids = new Map<number, string>();
for (let i = 0; i < total; i++) {
  const d = blockDef(i);
  check(!!d, `id=${i} 没有对应的方块定义`);
  if (d) check(d.id === i, `id 错位：期望 ${i}，实际 ${d.id}（${d.key}）`);
  if (ids.has(i)) check(false, `id=${i} 重复`);
  ids.set(i, d?.key ?? '?');
}
check(blockDef(0).key === 'air', '0 号必须是空气');
// 每种方块引用的贴图槽位必须真实存在，否则会渲染成空气
for (const b of BLOCK_LIST) {
  const keys = typeof b.tiles === 'string' ? [b.tiles] : [b.tiles.top, b.tiles.side, b.tiles.bottom];
  for (const k of keys) {
    check(hasTile(k), `方块 ${b.key} 引用了不存在的贴图 ${k}`);
  }
}
console.log(`  已注册 ${ids.size} 种方块，id = 0..${total - 1} 全部对齐`);
console.log(`  贴图槽位 ${ATLAS_TILES} / ${GRID * GRID} 已使用\n`);

if (failed === 0) {
  console.log('✅ 全部检查通过');
} else {
  console.log(`❌ 共 ${failed} 项检查未通过`);
  process.exitCode = 1;
}
