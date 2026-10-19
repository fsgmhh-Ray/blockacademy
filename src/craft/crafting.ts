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

// ───────── 工具武器（需要工作台） ─────────
for (const m of MATS_LIST) {
  const M = m.mat;
  shaped(`${m.key}_pickaxe`, 1, 'table', ['MMM', '.S.', '.S.'], { M, S: 'stick' });
  shaped(`${m.key}_axe`, 1, 'table', ['MM.', 'MS.', '.S.'], { M, S: 'stick' });
  shaped(`${m.key}_shovel`, 1, 'table', ['.M.', '.S.', '.S.'], { M, S: 'stick' });
  shaped(`${m.key}_sword`, 1, 'table', ['.M.', '.M.', '.S.'], { M, S: 'stick' });
  shaped(`${m.key}_hoe`, 1, 'table', ['MM.', '.S.', '.S.'], { M, S: 'stick' });
}

// ───────── 熔炉 ─────────
smelt('iron_ingot', 1, 'iron_ore');
smelt('gold_ingot', 1, 'gold_ore');
smelt('crystal_shard', 1, 'crystal_ore');
smelt('glass', 1, 'sand');
smelt('stone', 1, 'cobble');
smelt('bread', 1, 'wheat');
smelt('coal', 1, 'wood');
smelt('cake', 1, 'flour');

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
