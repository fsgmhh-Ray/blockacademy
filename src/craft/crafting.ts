/** 合成系统：随身 2×2、工作台 3×3、熔炉烧炼 */
import { MATS_LIST } from './items';

export type Station = 'inventory' | 'table' | 'furnace';

export interface Recipe {
  out: string;
  count: number;
  station: Station;
  /** 3 行以内的形状，'.' 表示空格 */
  shape?: string[];
  key?: Record<string, string>;
  /** 无序配方 */
  shapeless?: string[];
  /** 熔炉：单个输入 */
  input?: string;
}

const RECIPES: Recipe[] = [];

function shaped(out: string, count: number, station: Station, shape: string[], key: Record<string, string>): void {
  RECIPES.push({ out, count, station, shape, key });
}
function shapeless(out: string, count: number, station: Station, items: string[]): void {
  RECIPES.push({ out, count, station, shapeless: items });
}
function smelt(out: string, count: number, input: string): void {
  RECIPES.push({ out, count, station: 'furnace', input });
}

// ───────── 基础材料 ─────────
shapeless('plank', 4, 'inventory', ['wood']);
shapeless('stick', 4, 'inventory', ['plank', 'plank']);
shaped('crafting_table', 1, 'inventory', ['PP', 'PP'], { P: 'plank' });
// 有了工作台之后，在 3×3 里同样能再做一台（和《我的世界》一致）
shaped('crafting_table', 1, 'table', ['PP', 'PP'], { P: 'plank' });
shapeless('torch', 4, 'inventory', ['coal', 'stick']);
shapeless('flour', 2, 'inventory', ['wheat']);
shaped('glowstone', 1, 'inventory', ['CC', 'CC'], { C: 'crystal_shard' });
shaped('quartz', 1, 'inventory', ['CC', 'CC'], { C: 'crystal_shard' });
shaped('hay', 1, 'table', ['WWW', 'WWW', 'WWW'], { W: 'wheat' });
shaped('bookshelf', 1, 'table', ['PPP', 'BBB', 'PPP'], { P: 'plank', B: 'board' });
shaped('furnace', 1, 'table', ['CCC', 'C.C', 'CCC'], { C: 'cobble' });
shaped('bread', 1, 'table', ['FFF'], { F: 'flour' });
shapeless('cake', 1, 'table', ['milk', 'milk', 'milk', 'wheat', 'wheat', 'egg']);
shaped('metal', 1, 'table', ['III', 'III', 'III'], { I: 'iron_ingot' });
shapeless('iron_ingot', 9, 'table', ['metal']);

// ───────── 化学实验台（工作台 = 实验台）：真实反应原理 ─────────
// 溶解：盐/糖放进水里，颗粒变小均匀散开——物理变化，还能变回来
shapeless('saltwater', 1, 'inventory', ['salt', 'water']);
shapeless('sugar_water', 1, 'inventory', ['sugar', 'water']);
// 酸碱中和：小苏打（碳酸氢钠）+ 醋（醋酸）→ 大量二氧化碳气泡
shapeless('co2', 2, 'table', ['baking_soda', 'vinegar']);
// 氧化生锈：铁 + 水 + 氧气，缓慢的化学变化（回不去）
shapeless('rust', 1, 'table', ['iron_ingot', 'water', 'oxygen']);
// 石灰的家族：石灰石高温煅烧 → 生石灰（熔炉）；生石灰遇水放热 → 熟石灰
shapeless('slaked_lime', 1, 'table', ['quicklime', 'water']);
// 水泥砂浆：沙子 + 生石灰 + 水——真正的建筑胶凝材料
shapeless('concrete_mix', 1, 'table', ['sand', 'quicklime', 'water']);
// 砂浆固化变硬：胶凝材料把沙粒粘成整体（硬化是化学变化）
shapeless('concrete', 4, 'table', ['concrete_mix']);
// 电池：把化学能变成电能（金属外壳 + 水晶能量芯 + 煤电极）
shapeless('battery', 1, 'table', ['metal', 'crystal_shard', 'coal']);
// 电解水：电池在上"负极朝下"→ 氢气翻倍（体积 2:1）；电池在下"正极朝上"→ 氧气一份
shaped('hydrogen', 2, 'table', ['B', 'W', 'W'], { B: 'battery', W: 'water' });
shaped('oxygen', 1, 'table', ['W', 'W', 'B'], { B: 'battery', W: 'water' });
// 爆鸣气实验：2 份氢气 + 1 份氧气，点燃（煤）→ 重新变成水，一声"爆"
shapeless('water', 1, 'table', ['hydrogen', 'hydrogen', 'oxygen', 'coal']);

// ───────── 物理器件 ─────────
// 平面镜：玻璃 + 银白色金属（镀银）——光的镜面反射
shaped('mirror', 2, 'table', ['GGG', 'MMM'], { G: 'glass', M: 'metal' });
// 凸透镜：中间厚边缘薄的玻璃——把平行的阳光聚到焦点
shaped('lens', 2, 'table', ['GGG', 'G.G', 'GGG'], { G: 'glass' });
// 磁铁：铁磁体 + 水晶充磁——能吸住铁制物品
shapeless('magnet', 1, 'table', ['iron_ingot', 'iron_ingot', 'iron_ingot', 'crystal_shard']);
// 电路板：铜箔走线（铜是优良导体）+ 玻璃纤板（绝缘体）
shaped('circuit', 1, 'table', ['CCC', 'CGC', 'CCC'], { C: 'copper_ingot', G: 'glass' });

// ───────── 工具武器（需要工作台） ─────────
for (const m of MATS_LIST) {
  const M = m.mat;
  shaped(`${m.key}_pickaxe`, 1, 'table', ['MMM', '.S.', '.S.'], { M, S: 'stick' });
  shaped(`${m.key}_axe`, 1, 'table', ['MM.', 'MS.', '.S.'], { M, S: 'stick' });
  shaped(`${m.key}_shovel`, 1, 'table', ['.M.', '.S.', '.S.'], { M, S: 'stick' });
  shaped(`${m.key}_sword`, 1, 'table', ['.M.', '.M.', '.S.'], { M, S: 'stick' });
  shaped(`${m.key}_hoe`, 1, 'table', ['MM.', '.S.', '.S.'], { M, S: 'stick' });
}

// ───────── 熔炉（冶炼 = 高温下的物理/化学变化） ─────────
smelt('iron_ingot', 1, 'iron_ore');
smelt('gold_ingot', 1, 'gold_ore');
smelt('crystal_shard', 1, 'crystal_ore');
smelt('glass', 1, 'sand');
smelt('stone', 1, 'cobble');
smelt('bread', 1, 'wheat');
smelt('coal', 1, 'wood');
smelt('cake', 1, 'flour');
smelt('copper_ingot', 1, 'copper_ore'); // 矿石→金属：物理分离
smelt('salt', 1, 'saltwater'); // 蒸发结晶：水走了，盐留下来（物理变化）
smelt('quicklime', 1, 'limestone'); // 碳酸钙高温分解：CaCO₃ → CaO + CO₂（化学变化）

// ───────── 匹配 ─────────
function rows(cells: string[], w: number, h: number): string[][] {
  const out: string[][] = [];
  for (let y = 0; y < h; y++) out.push(cells.slice(y * w, y * w + w));
  return out;
}

/** 裁掉四周的空行空列，这样配方可以放在网格任意位置（和《我的世界》一样） */
function trim(r: string[][]): string[][] {
  let g = r.filter((row) => row.some((c) => c !== ''));
  if (!g.length) return [];
  const w = Math.max(...g.map((x) => x.length));
  const keep: number[] = [];
  for (let x = 0; x < w; x++) if (g.some((row) => (row[x] ?? '') !== '')) keep.push(x);
  g = g.map((row) => keep.map((x) => row[x] ?? ''));
  return g;
}

export interface CraftResult {
  out: string;
  count: number;
  /** 消耗掉的格子内容（key 列表） */
  consume: string[];
}

export function findRecipe(grid: string[], size: 2 | 3, station: Station): CraftResult | null {
  if (station === 'furnace') return null;
  const present = grid.filter((c) => c !== '');
  if (!present.length) return null;

  // 形状配方（'.' 在配方里表示空格，裁剪前先归一化成空字符串）
  for (const r of RECIPES) {
    if (r.station !== station || !r.shape) continue;
    const pat = trim(r.shape.map((s) => s.split('').map((c) => (c === '.' ? '' : c))));
    const got = trim(rows(grid, size, size));
    if (pat.length !== got.length) continue;
    if (pat.length && pat[0].length !== got[0].length) continue;
    let ok = true;
    for (let y = 0; y < pat.length && ok; y++) {
      for (let x = 0; x < pat[y].length && ok; x++) {
        const want = pat[y][x] === '' ? '' : (r.key?.[pat[y][x]] ?? '');
        if (want !== got[y][x]) ok = false;
      }
    }
    if (ok) return { out: r.out, count: r.count, consume: [...present] };
  }

  // 无序配方
  for (const r of RECIPES) {
    if (r.station !== station || !r.shapeless) continue;
    if (r.shapeless.length !== present.length) continue;
    const a = [...present].sort();
    const b = [...r.shapeless].sort();
    if (a.every((v, i) => v === b[i])) return { out: r.out, count: r.count, consume: [...present] };
  }
  return null;
}

export function furnaceRecipe(input: string): CraftResult | null {
  for (const r of RECIPES) {
    if (r.station === 'furnace' && r.input === input) return { out: r.out, count: r.count, consume: [input] };
  }
  return null;
}

export function allRecipes(): Recipe[] {
  return RECIPES;
}

/** 供 UI 展示的合成书：按产出分组 */
export function recipeBook(station: Station): { out: string; count: number; need: string[] }[] {
  const out: { out: string; count: number; need: string[] }[] = [];
  for (const r of RECIPES) {
    if (r.station !== station) continue;
    const need: string[] = [];
    if (r.shapeless) need.push(...r.shapeless);
    else if (r.shape && r.key) {
      for (const row of r.shape)
        for (const ch of row) if (ch !== '.' && r.key[ch]) need.push(r.key[ch]);
    } else if (r.input) need.push(r.input);
    out.push({ out: r.out, count: r.count, need });
  }
  return out;
}
