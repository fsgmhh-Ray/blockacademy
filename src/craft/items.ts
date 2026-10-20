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
  copper_ore: '🟠', limestone: '⬜', rust_block: '🟫', mirror: '🪞',
  lens: '🔍', concrete: '⬛', magnet: '🧲', gas: '🫧',
};

const BLOCK_CN: Record<string, string> = {
  grass: 'Grass', dirt: 'Dirt', stone: 'Stone', cobble: 'Cobblestone', stone_brick: 'Stone Bricks',
  sand: 'Sand', sandstone: 'Sandstone', water: 'Water', lava: 'Lava', wood: 'Wood Log',
  leaves: 'Leaves', plank: 'Planks', brick: 'Bricks', glass: 'Glass', snow: 'Snow',
  ice: 'Ice', gravel: 'Gravel', coal_ore: 'Coal Ore', iron_ore: 'Iron Ore', gold_ore: 'Gold Ore',
  crystal_ore: 'Crystal Ore', quartz: 'Quartz Block', wool_white: 'White Wool', wool_red: 'Red Wool',
  wool_blue: 'Blue Wool', wool_yellow: 'Yellow Wool', wool_purple: 'Purple Wool', wool_green: 'Green Wool',
  lamp: 'Knowledge Lamp', metal: 'Iron Block', obsidian: 'Obsidian', farmland: 'Farmland', wheat: 'Wheat',
  flower_red: 'Red Flower', flower_yellow: 'Yellow Flower', flower_blue: 'Blue Flower', flower_pink: 'Pink Flower',
  flower_white: 'White Flower', tall_grass: 'Tall Grass', hay: 'Hay Bale', crafting_table: 'Crafting Table',
  furnace: 'Furnace', torch: 'Torch', glowstone: 'Glowstone', bookshelf: 'Bookshelf', cactus: 'Cactus',
  mushroom: 'Mushroom', star: 'Star Block', cloud: 'Cloud', portal: 'Portal Stone', board: 'Knowledge Board',
  bedrock: 'Bedrock', carrot: 'Carrot',
  copper_ore: 'Copper Ore', limestone: 'Limestone', rust_block: 'Rusted Iron Block', mirror: 'Mirror',
  lens: 'Magnifying Lens', concrete: 'Concrete', magnet: 'Magnet', gas: 'Carbon Dioxide Bubble',
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
def({ key: 'stick', name: 'Stick', cn: 'Stick', icon: '🥢', kind: 'resource', desc: 'The handle for crafting every tool' });
def({ key: 'iron_ingot', name: 'Iron Ingot', cn: 'Iron Ingot', icon: '🔩', kind: 'resource', desc: 'Made by smelting iron ore' });
def({ key: 'gold_ingot', name: 'Gold Ingot', cn: 'Gold Ingot', icon: '🪙', kind: 'resource', desc: 'Made by smelting gold ore' });
def({ key: 'crystal_shard', name: 'Crystal Shard', cn: 'Crystal Shard', icon: '💎', kind: 'resource', desc: 'Made by smelting crystal ore' });
def({ key: 'coal', name: 'Coal', cn: 'Coal', icon: '⚫', kind: 'resource', desc: "Drops when you mine coal ore" });
def({ key: 'feather', name: 'Feather', cn: 'Feather', icon: '🪶', kind: 'resource', desc: 'A gift from chickens' });
def({ key: 'leather', name: 'Leather', cn: 'Leather', icon: '🧵', kind: 'resource', desc: 'A gift from cows' });
def({ key: 'egg', name: 'Egg', cn: 'Egg', icon: '🥚', kind: 'resource', desc: 'Laid by hens' });
def({ key: 'milk', name: 'Milk', cn: 'Milk', icon: '🥛', kind: 'resource', desc: 'Get it by milking a cow' });
def({ key: 'flour', name: 'Flour', cn: 'Flour', icon: '🌾', kind: 'resource', desc: 'Ground from wheat' });
def({ key: 'bean', name: 'Magic Bean', cn: 'Magic Bean', icon: '🫘', kind: 'food', heal: 1, desc: 'Eat it and... pop!' });

// ───────── 化学实验材料（真实反应原理，见合成表） ─────────
def({ key: 'salt', name: 'Salt', cn: 'Salt', icon: '🧂', kind: 'resource', desc: 'Salt from evaporated seawater — stir it in water and it vanishes (that’s dissolving)' });
def({ key: 'sugar', name: 'Sugar', cn: 'Sugar', icon: '🍬', kind: 'resource', desc: 'Sugar from sugarcane or beets. Heat it and it turns to caramel — a real chemical change' });
def({ key: 'baking_soda', name: 'Baking Soda', cn: 'Baking Soda', icon: '🧴', kind: 'resource', desc: 'Baking soda (sodium bicarbonate). Mix it with something acidic and it fizzes like crazy (acid + base!)' });
def({ key: 'vinegar', name: 'Vinegar', cn: 'Vinegar', icon: '🫗', kind: 'resource', desc: 'Vinegar — it’s an acid, and baking soda is its classic bubbly partner' });
def({ key: 'co2', name: 'Carbon Dioxide', cn: 'Carbon Dioxide', icon: '🫧', kind: 'resource', desc: 'A colorless gas, heavier than air. It can smother flames by keeping oxygen away' });
def({ key: 'saltwater', name: 'Salt Water', cn: 'Salt Water', icon: '🌊', kind: 'resource', desc: 'Salt dissolved in water. Leave it in the sun and the salt crystals come back' });
def({ key: 'sugar_water', name: 'Sugar Water', cn: 'Sugar Water', icon: '🥤', kind: 'food', heal: 2, desc: 'Sugar dissolved in water — take a sip, it’s sweet to the core' });
def({ key: 'rust', name: 'Rust', cn: 'Rust', icon: '🟤', kind: 'resource', desc: 'Iron + oxygen + water = slow rusting (a chemical change you can’t undo)' });
def({ key: 'quicklime', name: 'Quicklime', cn: 'Quicklime', icon: '⚪', kind: 'resource', desc: 'Made by roasting limestone (CaCO₃ → CaO + CO₂). Splash it with water and it gets hot!' });
def({ key: 'slaked_lime', name: 'Slaked Lime', cn: 'Slaked Lime', icon: '🥛', kind: 'resource', desc: 'Quicklime plus water makes heat and slaked lime (calcium hydroxide) — the stuff for whitewashing walls' });
def({ key: 'hydrogen', name: 'Hydrogen', cn: 'Hydrogen', icon: '🎈', kind: 'resource', desc: 'The lightest gas. Split water with a battery and it shows up at the negative end — and it goes "pop" near a flame' });
def({ key: 'oxygen', name: 'Oxygen', cn: 'Oxygen', icon: '🌬️', kind: 'resource', desc: 'Also from splitting water (at the positive end). It feeds fire — a glowing splint bursts back into flame' });
def({ key: 'copper_ingot', name: 'Copper Ingot', cn: 'Copper Ingot', icon: '🟠', kind: 'resource', desc: 'Made by smelting copper ore. It carries electricity almost as well as silver, so wires use it' });
def({ key: 'battery', name: 'Battery', cn: 'Battery', icon: '🔋', kind: 'resource', desc: 'Turns chemical energy into electricity — it’s what powers splitting water' });
def({ key: 'circuit', name: 'Circuit Board', cn: 'Circuit Board', icon: '🔌', kind: 'resource', desc: 'Copper tracks on an insulator. Electricity flows through the copper (conductor) but not the board (insulator)' });
def({ key: 'concrete_mix', name: 'Concrete Mix', cn: 'Concrete Mix', icon: '🪣', kind: 'resource', desc: 'Sand + quicklime + water: the real glue that holds buildings together' });

// ───────── 食物 ─────────
def({ key: 'bread', name: 'Bread', cn: 'Bread', icon: '🍞', kind: 'food', heal: 5, desc: 'A warm, tasty loaf of bread' });
def({ key: 'apple', name: 'Apple', cn: 'Apple', icon: '🍎', kind: 'food', heal: 4, desc: 'Picked fresh from a tree' });
def({ key: 'cake', name: 'Cake', cn: 'Cake', icon: '🍰', kind: 'food', heal: 8, desc: 'Happy birthday!' });

// 胡萝卜既是作物也是食物，直接啃一口也很脆
const carrotItem = BY_KEY.get('carrot');
if (carrotItem) {
  carrotItem.heal = 3;
  carrotItem.desc = 'A crunchy carrot — you can bite right into it';
}
const wheatItem = BY_KEY.get('wheat');
if (wheatItem) wheatItem.desc = 'Wheat — grind it into flour to bake bread';

// ───────── 化学 / 物理新方块的说明 ─────────
const BLOCK_DESC: Record<string, string> = {
  copper_ore: 'Copper ore — smelt it into copper ingots. Wires and circuit boards use it to carry electricity',
  limestone: 'Limestone is mostly calcium carbonate; heat it in a furnace to make quicklime',
  rust_block: 'Rusted iron — this is what iron turns into when it rusts. Put it next to an iron block and the rust slowly creeps across',
  mirror: 'A flat mirror. Light bounces off it: the angle it arrives equals the angle it leaves (angle in = angle out)',
  lens: 'A convex lens bends parallel sunlight to a single point — so hot it can start a fire',
  concrete: 'Concrete — once the mix hardens it’s stronger than stone. The king of modern building',
  magnet: 'A magnet. It grabs iron things, and its two ends (the N and S poles) are the strongest',
  gas: 'Carbon-dioxide bubbles. They’re heavier than air so they sink and sit on the ground, cutting off oxygen to put out fires',
};
for (const [k, d] of Object.entries(BLOCK_DESC)) {
  const it = BY_KEY.get(k);
  if (it) it.desc = d;
}

// ───────── 工具与武器（程序化生成 4 档 × 4 种） ─────────
const MATS = [
  { key: 'wood', mat: 'plank', name: 'Wooden', cn: 'Wooden', speed: 1.6, tier: 0 },
  { key: 'stone', mat: 'cobble', name: 'Stone', cn: 'Stone', speed: 2.4, tier: 1 },
  { key: 'iron', mat: 'iron_ingot', name: 'Iron', cn: 'Iron', speed: 3.6, tier: 2 },
  { key: 'crystal', mat: 'crystal_shard', name: 'Crystal', cn: 'Crystal', speed: 5.2, tier: 3 },
] as const;

export type MatKey = (typeof MATS)[number]['key'];

const TOOLS = [
  { t: 'pickaxe' as ToolType, en: 'Pickaxe', cn: 'Pickaxe', icon: '⛏️' },
  { t: 'axe' as ToolType, en: 'Axe', cn: 'Axe', icon: '🪓' },
  { t: 'shovel' as ToolType, en: 'Shovel', cn: 'Shovel', icon: '🥄' },
  { t: 'sword' as ToolType, en: 'Sword', cn: 'Sword', icon: '🗡️' },
  { t: 'hoe' as ToolType, en: 'Hoe', cn: 'Hoe', icon: '🧑‍🌾' },
];

export const TOOL_KEYS: string[] = [];
for (const m of MATS) {
  for (const t of TOOLS) {
    const key = `${m.key}_${t.t}`;
    def({
      key,
      name: `${m.name} ${t.en}`,
      cn: `${m.cn} ${t.cn}`,
      icon: t.icon,
      kind: t.t === 'sword' ? 'weapon' : 'tool',
      tool: t.t,
      tier: m.tier,
      stack: 1,
      desc: `${m.cn} ${t.cn} · Mining speed ×${m.speed}`,
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
