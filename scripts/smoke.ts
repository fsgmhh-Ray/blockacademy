/**
 * 离线冒烟测试：跑遍 6 个场景的地形生成，并检查 Chunk 网格数据是否自洽。
 * 用法：npm run smoke
 */
import { buildChunkMesh } from '../src/core/mesher';
import { readFileSync } from 'node:fs';
import { blockDef, BLOCK_LIST, isSolid, blockId as blockIdOf } from '../src/core/blockRegistry';
import { hasTile, GRID, ATLAS_TILES, TILE_KEYS, tileIdOf } from '../src/core/textures';
import { SCENES } from '../src/world/scenes';
import { Inventory } from '../src/craft/inventory';
import { allRecipes } from '../src/craft/crafting';
import { allItems, blockItems, hasItem } from '../src/craft/items';
import { ITEM_UNLOCKS } from '../src/edu/unlocks';
import { quizById } from '../src/edu/quizzes';
import { PASSES } from '../src/edu/shop';
import { questsOf } from '../src/edu/quests';

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

// 传送台可达性自检：从出生点做 BFS，确认每个传送台/演示台都走得近、踩得上。
// （历史上多次出现台子被架到树冠/屋顶/水面上，玩家在村里转到崩溃也出不去）
console.log('【传送台可达性】');
{
  let unreachable = 0;
  for (const scene of SCENES) {
    const w = new FakeWorld();
    scene.build(w);
    const solidAt = (x: number, y: number, z: number) => isSolid(w.get(x, y, z));
    const standable = (x: number, y: number, z: number) =>
      w.inBounds(x, y - 1, z) && !solidAt(x, y, z) && !solidAt(x, y + 1, z) && solidAt(x, y - 1, z);
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
    // 有顶场景（洞窟）必须用场景显式地面高度，不能用地表扫描（会扫到天花板）
    const start = {
      x: scene.spawn[0],
      z: scene.spawn[1],
      y: scene.groundY ?? w.groundY(scene.spawn[0], scene.spawn[1]),
    };
    const seen = new Set<string>([key(start.x, start.y, start.z)]);
    const queue = [start];
    let head = 0;
    while (head < queue.length) {
      const c = queue[head++];
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as [number, number][]) {
        const nx = c.x + dx;
        const nz = c.z + dz;
        for (let dy = -10; dy <= 1; dy++) {
          const ny = c.y + dy;
          if (ny < 2 || ny >= w.sy - 2) continue;
          if (standable(nx, ny, nz) && !seen.has(key(nx, ny, nz))) {
            seen.add(key(nx, ny, nz));
            queue.push({ x: nx, y: ny, z: nz });
          }
        }
      }
    }
    const bad: string[] = [];
    for (const p of scene.pads) {
      const padY = p.y ?? w.groundY(p.x, p.z);
      const ok = [...seen].some((k) => {
        const [x, y, z] = k.split(',').map(Number);
        return Math.abs(x - p.x) <= 2 && Math.abs(z - p.z) <= 2 && Math.abs(y - padY) < 3;
      });
      if (!ok) {
        bad.push(`(${p.x},${p.z}) ${p.label}`);
        unreachable++;
      }
    }
    check(
      bad.length === 0,
      bad.length ? `${scene.name}: ${bad.length} 个传送台走不到 → ${bad.join(' / ')}` : '',
    );
    console.log(`  ${scene.name}: ${scene.pads.length} 个传送台全部可达（可站立区域 ${seen.size} 格）`);
  }
  check(unreachable === 0, `共 ${unreachable} 个传送台不可达`);
}

// 房屋家具自检：每座 house() 都应该摆上箱子/书架/工作台/熔炉，且箱子不悬空
console.log('【房屋家具】');
{
  const chest = blockIdOf('chest');
  const bookshelf = blockIdOf('bookshelf');
  const table = blockIdOf('crafting_table');
  const furnace = blockIdOf('furnace');
  let noChest = 0;
  let floating = 0;
  let totalChest = 0;
  for (const scene of SCENES) {
    const w = new FakeWorld();
    scene.build(w);
    let chests = 0;
    let shelves = 0;
    let tables = 0;
    let furnaces = 0;
    for (let x = 0; x < w.sx; x++)
      for (let y = 1; y < w.sy; y++)
        for (let z = 0; z < w.sz; z++) {
          const id = w.get(x, y, z);
          if (id === chest) {
            chests++;
            if (!isSolid(w.get(x, y - 1, z))) floating++;
          } else if (id === bookshelf) shelves++;
          else if (id === table) tables++;
          else if (id === furnace) furnaces++;
        }
    totalChest += chests;
    // 没有箱子的场景允许（纯自然/地下/数学学院），但只要有房子就必须有箱子
    const hasHouse = shelves > 0 || tables > 0 || furnaces > 0;
    if (hasHouse && chests === 0) noChest++;
    console.log(
      `  ${scene.id.padEnd(11)} 箱=${String(chests).padStart(2)} 书架=${String(shelves).padStart(2)} 工作台=${String(tables).padStart(2)} 熔炉=${String(furnaces).padStart(2)}`,
    );
  }
  check(noChest === 0, `${noChest} 个场景有家具却没放箱子`);
  check(floating === 0, `${floating} 个箱子悬空`);
  check(totalChest >= 8, `全场只有 ${totalChest} 个箱子，至少应有 8 个（每座房子 1-3 个）`);
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

  // 答题解锁的物品必须真的存在，而且配套的题目也要存在
  for (const u of ITEM_UNLOCKS) {
    check(hasItem(u.item), `解锁表里的物品 ${u.item} 不存在`);
    check(!!quizById(u.quiz), `解锁表 ${u.item} 指向的题目 ${u.quiz} 不存在`);
  }
  // 商店通行证引用的题目也要存在
  for (const p of PASSES) {
    if (p.quiz) check(!!quizById(p.quiz), `通行证 ${p.id} 指向的题目 ${p.quiz} 不存在`);
  }
  console.log(`  答题解锁 ${ITEM_UNLOCKS.length} 项 / 通行证 ${PASSES.length} 种，引用全部有效\n`);
}

// 年级过滤自检：低年级玩家不能被过滤到「一个任务都没有」
console.log('【年级过滤】');
{
  let empty = 0;
  const rows: string[] = [];
  for (let g = 1; g <= 6; g++) {
    const counts = SCENES.map((s) => questsOf(s.id, g).length);
    const total = counts.reduce((a, b) => a + b, 0);
    rows.push(`  Grade ${g}: 共 ${total} 个任务（${SCENES.map((s, i) => (counts[i] ? s.id : '')).filter(Boolean).join(' ') || '无'}）`);
    if (total === 0) empty++;
  }
  rows.forEach((r) => console.log(r));
  check(empty === 0, `${empty} 个年级被年级过滤清空了全部任务`);
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
// 图集槽位必须连续、不越界：背包/手持图标靠「槽位 % 网格宽度」取贴图，
// 一旦槽位算错（历史上出现过 UI 里写死网格宽度 8、而图集已是 12 的 bug），
// 手持方块和背包图标就会对不上。
{
  const seen = new Set<number>();
  for (const k of TILE_KEYS) {
    const id = tileIdOf(k);
    check(id >= 0 && id < GRID * GRID, `贴图 ${k} 的槽位 ${id} 越界（图集只有 ${GRID}×${GRID}=${GRID * GRID} 格）`);
    check(!seen.has(id), `贴图 ${k} 的槽位 ${id} 与别的贴图重复`);
    seen.add(id);
  }
  check(seen.size === ATLAS_TILES, `贴图槽位不连续：${seen.size} != ${ATLAS_TILES}`);
}
console.log(`  贴图槽位 ${ATLAS_TILES} / ${GRID * GRID} 已使用，槽位连续无冲突\n`);

// UI 模板自检：漏注册一个 overlay，anyOverlayOpen() 每帧就会对 undefined
// 调 classList —— 整个游戏在标题页直接崩，且 typecheck / build 都发现不了。
// （2026-10 真的发生过：6 个新面板全在 ALL_OVERLAYS 里但没进 q()。）
console.log('【UI 模板】');
{
  const src = readFileSync('src/ui/ui.ts', 'utf8');
  const tpl = src.slice(src.indexOf('const TEMPLATE ='));
  const tplIds = new Set<string>();
  for (const m of tpl.matchAll(/\bid="([^"]+)"/g)) tplIds.add(m[1]);

  const registered = new Set<string>();
  for (const m of src.matchAll(/\n\s*q\('([^']+)'\)/g)) registered.add(m[1]);
  const fe = src.match(/'dialog-avatar'[\s\S]*?'pm-parent'\]\.forEach/);
  if (fe) for (const m of fe[0].matchAll(/'([^']+)'/g)) registered.add(m[1]);

  // ALL_OVERLAYS 的每一项都应该由那个 for 循环自动注册
  check(
    /for \(const which of ALL_OVERLAYS\) q\(`overlay-\$\{which\}`\)/.test(src),
    'ALL_OVERLAYS 没有自动注册进 el——新增面板必须走 for (const which of ALL_OVERLAYS) q(...)',
  );

  const missing = [...registered].filter((id) => !tplIds.has(id));
  check(missing.length === 0, `${missing.length} 个注册的元素在 TEMPLATE 里不存在：${missing.slice(0, 6).map((i) => '#' + i).join(' ')}`);

  const ob = src.match(/export const ALL_OVERLAYS: Overlay\[\] = \[([\s\S]*?)\];/);
  const overlays = ob ? [...ob[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : [];
  const noDom = overlays.filter((o) => !tplIds.has(`overlay-${o}`));
  check(noDom.length === 0, `ALL_OVERLAYS 里这些项没有对应 DOM：${noDom.map((o) => '#overlay-' + o).join(' ')}`);

  const tplOv = [...tplIds].filter((id) => id.startsWith('overlay-')).map((id) => id.slice(8));
  const notListed = tplOv.filter((o) => !overlays.includes(o));
  check(notListed.length === 0, `模板里的 overlay 没进 ALL_OVERLAYS（关不掉也检测不到）：${notListed.map((o) => '#overlay-' + o).join(' ')}`);

  console.log(`  注册 ${registered.size} 个 id 全部存在；${overlays.length} 个 overlay 双向对齐\n`);
}

if (failed === 0) {
  console.log('✅ 全部检查通过');
} else {
  console.log(`❌ 共 ${failed} 项检查未通过`);
  process.exitCode = 1;
}
