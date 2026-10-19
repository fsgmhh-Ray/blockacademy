/** 物品注册表：方块 + 工具武器 + 资源 + 食物。全部用字符串 key 索引 */
import { BLOCK_LIST } from '../core/blockRegistry';

export type ItemKind = 'block' | 'tool' | 'weapon' | 'resource' | 'food';
export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe';

export interface ItemDef {
  key: string;
  name: string;
  cn: string;
  kind: ItemKind;
  icon: string;
  /** 可放置的方块 id（只有 kind==='block' 才有） */
  block?: number;
  stack: number;
  tool?: ToolType;
  /** 工具等级：0 木 1 石 2 铁 3 水晶 */
  tier?: number;
  heal?: number;
  desc: string;
}

const ITEMS: ItemDef[] = [];
const BY_KEY = new Map<string, ItemDef>();

function def(cfg: Partial<ItemDef> & { key: string; name: string; cn: string; icon: string; kind: ItemKind }): ItemDef {
  const it: ItemDef = { stack: 64, desc: '', ...cfg } as ItemDef;
  ITEMS.push(it);
  BY_KEY.set(it.key, it);
  return it;
}

/** 方块的图标与中文名（没有列出的用英文名兜底） */
const BLOCK_ICON: Record<string, string> = {
  grass: '🟩', dirt: '🟫', stone: '⬜', cobble: '🪨', stone_brick: '🧱',
  sand: '🏖️', sandstone: '🟨', water: '💧', lava: '🌋', wood: '🪵',
  leaves: '🍃', plank: '📋', brick: '🟥', glass: '🪟', snow: '❄️',
  ice: '🧊', gravel: '⚪', coal_ore: '⚫', iron_ore: '🪙', gold_ore: '🟡',
  crystal_ore: '💜', quartz: '🤍', wool_white: '⬜', wool_red: '🟥', wool_blue: '🟦',
  wool_yellow: '🟨', wool_purple: '🟪', wool_green: '🟩', lamp: '💡', metal: '🔲',
  obsidian: '⬛', farmland: '🟤', wheat: '🌾', flower_red: '🌺', flower_yellow: '🌻',
  flower_blue: '🪻', flower_pink: '🌸', flower_white: '🌼', tall_grass: '🌿', hay: '🌾',
  crafting_table: '🪚', furnace: '🔥', torch: '🕯️', glowstone: '🔆', bookshelf: '📚',
  cactus: '🌵', mushroom: '🍄', star: '⭐', cloud: '☁️', portal: '🌀', board: '📋',
  bedrock: '🧱', carrot: '🥕',
};

const BLOCK_CN: Record<string, string> = {
  grass: '草方块', dirt: '泥土', stone: '石头', cobble: '圆石', stone_brick: '石砖',
  sand: '沙子', sandstone: '砂岩', water: '水', lava: '岩浆', wood: '木头',
  leaves: '树叶', plank: '木板', brick: '砖块', glass: '玻璃', snow: '雪',
  ice: '冰', gravel: '沙砾', coal_ore: '煤矿石', iron_ore: '铁矿石', gold_ore: '金矿石',
  crystal_ore: '水晶矿石', quartz: '石英块', wool_white: '白色羊毛', wool_red: '红色羊毛',
  wool_blue: '蓝色羊毛', wool_yellow: '黄色羊毛', wool_purple: '紫色羊毛', wool_green: '绿色羊毛',
  lamp: '知识灯', metal: '铁块', obsidian: '黑曜石', farmland: '耕地', wheat: '小麦',
  flower_red: '红花', flower_yellow: '黄花', flower_blue: '蓝花', flower_pink: '粉花',
  flower_white: '白花', tall_grass: '高草', hay: '干草块', crafting_table: '工作台',
  furnace: '熔炉', torch: '火把', glowstone: '萤石', bookshelf: '书架', cactus: '仙人掌',
  mushroom: '蘑菇', star: '星星块', cloud: '云', portal: '传送石', board: '知识板',
  bedrock: '基岩', carrot: '胡萝卜',
};

// ── 每个方块都自动成为一个可放置物品
for (const b of BLOCK_LIST) {
  if (b.key === 'air') continue;
  def({
    key: b.key,
    name: b.name,
    cn: BLOCK_CN[b.key] ?? b.name,
    icon: BLOCK_ICON[b.key] ?? '🧱',
    kind: 'block',
    block: b.id,
  });
}

// ───────── 资源 ─────────
def({ key: 'stick', name: 'Stick', cn: '木棍', icon: '🥢', kind: 'resource', desc: '合成一切工具的手柄' });
def({ key: 'iron_ingot', name: 'Iron Ingot', cn: '铁锭', icon: '🔩', kind: 'resource', desc: '熔炼铁矿石得到' });
def({ key: 'gold_ingot', name: 'Gold Ingot', cn: '金锭', icon: '🪙', kind: 'resource', desc: '熔炼金矿石得到' });
def({ key: 'crystal_shard', name: 'Crystal Shard', cn: '水晶碎片', icon: '💎', kind: 'resource', desc: '熔炼水晶矿石得到' });
def({ key: 'coal', name: 'Coal', cn: '煤', icon: '⚫', kind: 'resource', desc: '挖煤矿掉落' });
def({ key: 'feather', name: 'Feather', cn: '羽毛', icon: '🪶', kind: 'resource', desc: '鸡给的礼物' });
def({ key: 'leather', name: 'Leather', cn: '皮革', icon: '🧵', kind: 'resource', desc: '牛给的礼物' });
def({ key: 'egg', name: 'Egg', cn: '鸡蛋', icon: '🥚', kind: 'resource', desc: '母鸡下的蛋' });
def({ key: 'milk', name: 'Milk', cn: '牛奶', icon: '🥛', kind: 'resource', desc: '挤牛奶得到' });
def({ key: 'flour', name: 'Flour', cn: '面粉', icon: '🌾', kind: 'resource', desc: '小麦磨的面粉' });
def({ key: 'bean', name: 'Magic Bean', cn: '魔法豆', icon: '🫘', kind: 'food', heal: 1, desc: '吃了会……噗！' });

// ───────── 食物 ─────────
def({ key: 'bread', name: 'Bread', cn: '面包', icon: '🍞', kind: 'food', heal: 5, desc: '香喷喷的面包' });
def({ key: 'apple', name: 'Apple', cn: '苹果', icon: '🍎', kind: 'food', heal: 4, desc: '从树上摘的' });
def({ key: 'cake', name: 'Cake', cn: '蛋糕', icon: '🍰', kind: 'food', heal: 8, desc: '生日快乐！' });

// 胡萝卜既是作物也是食物，直接啃一口也很脆
const carrotItem = BY_KEY.get('carrot');
if (carrotItem) {
  carrotItem.heal = 3;
  carrotItem.desc = '脆生生的胡萝卜，可以直接啃';
}
const wheatItem = BY_KEY.get('wheat');
if (wheatItem) wheatItem.desc = '小麦，磨成面粉就能烤面包';

// ───────── 工具与武器（程序化生成 4 档 × 4 种） ─────────
const MATS = [
  { key: 'wood', mat: 'plank', name: 'Wooden', cn: '木', speed: 1.6, tier: 0 },
  { key: 'stone', mat: 'cobble', name: 'Stone', cn: '石', speed: 2.4, tier: 1 },
  { key: 'iron', mat: 'iron_ingot', name: 'Iron', cn: '铁', speed: 3.6, tier: 2 },
  { key: 'crystal', mat: 'crystal_shard', name: 'Crystal', cn: '水晶', speed: 5.2, tier: 3 },
] as const;

export type MatKey = (typeof MATS)[number]['key'];

const TOOLS = [
  { t: 'pickaxe' as ToolType, en: 'Pickaxe', cn: '镐', icon: '⛏️' },
  { t: 'axe' as ToolType, en: 'Axe', cn: '斧', icon: '🪓' },
  { t: 'shovel' as ToolType, en: 'Shovel', cn: '铲', icon: '🥄' },
  { t: 'sword' as ToolType, en: 'Sword', cn: '剑', icon: '🗡️' },
  { t: 'hoe' as ToolType, en: 'Hoe', cn: '锄', icon: '🧑‍🌾' },
];

export const TOOL_KEYS: string[] = [];
for (const m of MATS) {
  for (const t of TOOLS) {
    const key = `${m.key}_${t.t}`;
    def({
      key,
      name: `${m.name} ${t.en}`,
      cn: `${m.cn}${t.cn}`,
      icon: t.icon,
      kind: t.t === 'sword' ? 'weapon' : 'tool',
      tool: t.t,
      tier: m.tier,
      stack: 1,
      desc: `${m.cn}${t.cn} · 挖掘速度 ×${m.speed}`,
    });
    TOOL_KEYS.push(key);
  }
}

// ───────── 查询 ─────────
export function item(key: string): ItemDef {
  return BY_KEY.get(key) ?? ITEMS[0];
}
export function hasItem(key: string): boolean {
  return BY_KEY.has(key);
}
export function allItems(): ItemDef[] {
  return ITEMS;
}
export function blockItems(): ItemDef[] {
  return ITEMS.filter((i) => i.kind === 'block' && i.block !== undefined);
}
export function keyOfBlock(id: number): string | null {
  for (const i of ITEMS) if (i.block === id) return i.key;
  return null;
}
export const MATS_LIST = MATS;

/** 敲碎一个方块会掉什么（默认掉它自己） */
export function breakDrop(id: number): string[] {
  const key = keyOfBlock(id);
  if (!key) return [];
  switch (key) {
    case 'stone':
      return ['cobble'];
    case 'grass':
    case 'farmland':
      return ['dirt'];
    case 'coal_ore':
      return ['coal'];
    case 'iron_ore':
    case 'gold_ore':
    case 'crystal_ore':
      return [key];
    case 'leaves':
      return Math.random() < 0.3 ? ['apple'] : [];
    case 'tall_grass':
      return Math.random() < 0.2 ? ['wheat'] : [];
    case 'flower_red':
    case 'flower_yellow':
    case 'flower_blue':
    case 'flower_pink':
    case 'flower_white':
      return [key];
    default:
      return [key];
  }
}
