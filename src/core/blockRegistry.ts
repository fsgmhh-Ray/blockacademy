/** Block registry and texture-atlas tile-slot conventions */

/** Tile references are string keys mapped to atlas slots */
export interface BlockTiles {
  top: string;
  side: string;
  bottom: string;
}

export interface BlockDef {
  id: number;
  key: string;
  name: string;
  tiles: BlockTiles | string;
  solid: boolean;
  /** Transparent but still rendered (glass, leaves, water) */
  transparent: boolean;
  liquid: boolean;
  light?: number;
  /** Used for the minimap and 3D demo particles */
  color: number;
}

const defs: BlockDef[] = [];
const byKey = new Map<string, BlockDef>();

function def(cfg: Partial<BlockDef> & { key: string; name: string }): BlockDef {
  const b: BlockDef = {
    id: 0,
    tiles: cfg.tiles ?? cfg.key,
    solid: cfg.solid ?? true,
    transparent: cfg.transparent ?? false,
    liquid: cfg.liquid ?? false,
    light: cfg.light,
    color: cfg.color ?? 0xffffff,
    key: cfg.key,
    name: cfg.name,
  };
  defs.push(b);
  b.id = defs.length - 1; // air occupies slot 0
  byKey.set(b.key, b);
  return b;
}

/** Slot 0 is always air */
defs.push({
  id: 0,
  key: 'air',
  name: 'Air',
  tiles: 'air',
  solid: false,
  transparent: true,
  liquid: false,
  color: 0x000000,
} as BlockDef);

export const Blocks = {
  grass: def({ key: 'grass', name: 'Grass', tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, color: 0x6aa84f }),
  dirt: def({ key: 'dirt', name: 'Dirt', tiles: 'dirt', color: 0x8b5a2b }),
  stone: def({ key: 'stone', name: 'Stone', tiles: 'stone', color: 0x8a8a8a }),
  cobble: def({ key: 'cobble', name: 'Cobblestone', tiles: 'cobble', color: 0x7e7e7e }),
  stoneBrick: def({ key: 'stone_brick', name: 'Stone Bricks', tiles: 'stone_brick', color: 0x6f6f6f }),
  sand: def({ key: 'sand', name: 'Sand', tiles: 'sand', color: 0xe0cf9a }),
  sandstone: def({ key: 'sandstone', name: 'Sandstone', tiles: 'sandstone', color: 0xd6c489 }),
  water: def({ key: 'water', name: 'Water', tiles: 'water', solid: false, transparent: true, liquid: true, color: 0x3a7bd5 }),
  lava: def({ key: 'lava', name: 'Lava', tiles: 'lava', solid: false, transparent: true, liquid: true, light: 0.6, color: 0xff6a1a }),
  wood: def({ key: 'wood', name: 'Wood Log', tiles: { top: 'wood_top', side: 'wood_side', bottom: 'wood_top' }, color: 0x9a6b3f }),
  leaves: def({ key: 'leaves', name: 'Leaves', tiles: 'leaves', transparent: true, color: 0x4f9d3a }),
  plank: def({ key: 'plank', name: 'Planks', tiles: 'plank', color: 0xc09a63 }),
  brick: def({ key: 'brick', name: 'Bricks', tiles: 'brick', color: 0x9d4b3c }),
  glass: def({ key: 'glass', name: 'Glass', tiles: 'glass', transparent: true, color: 0xbfefff }),
  snow: def({ key: 'snow', name: 'Snow', tiles: { top: 'snow', side: 'snow_side', bottom: 'dirt' }, color: 0xf2f7fb }),
  ice: def({ key: 'ice', name: 'Ice', tiles: 'ice', transparent: true, color: 0x9fdcf5 }),
  gravel: def({ key: 'gravel', name: 'Gravel', tiles: 'gravel', color: 0x8d8d8d }),
  coalOre: def({ key: 'coal_ore', name: 'Coal Ore', tiles: 'coal_ore', color: 0x4a4a4a }),
  ironOre: def({ key: 'iron_ore', name: 'Iron Ore', tiles: 'iron_ore', color: 0xa89880 }),
  goldOre: def({ key: 'gold_ore', name: 'Gold Ore', tiles: 'gold_ore', color: 0xd8b84a }),
  crystalOre: def({ key: 'crystal_ore', name: 'Crystal Ore', tiles: 'crystal_ore', light: 0.35, color: 0xa97ce8 }),
  quartz: def({ key: 'quartz', name: 'Quartz Block', tiles: 'quartz', color: 0xf2f0ea }),
  woolWhite: def({ key: 'wool_white', name: 'White Wool', tiles: 'wool_white', color: 0xf5f5f5 }),
  woolRed: def({ key: 'wool_red', name: 'Red Wool', tiles: 'wool_red', color: 0xc94a4a }),
  woolBlue: def({ key: 'wool_blue', name: 'Blue Wool', tiles: 'wool_blue', color: 0x4a72c9 }),
  woolYellow: def({ key: 'wool_yellow', name: 'Yellow Wool', tiles: 'wool_yellow', color: 0xd9c44a }),
  woolPurple: def({ key: 'wool_purple', name: 'Purple Wool', tiles: 'wool_purple', color: 0x8a5fd0 }),
  woolGreen: def({ key: 'wool_green', name: 'Green Wool', tiles: 'wool_green', color: 0x54a34a }),
  lamp: def({ key: 'lamp', name: 'Knowledge Lamp', tiles: 'lamp', light: 1, color: 0xffe08a }),
  metal: def({ key: 'metal', name: 'Iron Block', tiles: 'metal', color: 0xb8bcc4 }),
  obsidian: def({ key: 'obsidian', name: 'Obsidian', tiles: 'obsidian', color: 0x1f1b2e }),
  farmland: def({ key: 'farmland', name: 'Farmland', tiles: { top: 'farmland', side: 'dirt', bottom: 'dirt' }, color: 0x6b4a2f }),
  wheat: def({ key: 'wheat', name: 'Wheat', tiles: 'wheat', solid: false, transparent: true, color: 0xdcc96b }),
  flowerRed: def({ key: 'flower_red', name: 'Red Flower', tiles: 'flower_red', solid: false, transparent: true, color: 0xd9536a }),
  flowerYellow: def({ key: 'flower_yellow', name: 'Yellow Flower', tiles: 'flower_yellow', solid: false, transparent: true, color: 0xe9c94a }),
  cactus: def({ key: 'cactus', name: 'Cactus', tiles: 'cactus', color: 0x3f8f4f }),
  mushroom: def({ key: 'mushroom', name: 'Mushroom', tiles: 'mushroom', solid: false, transparent: true, color: 0xc06a6a }),
  star: def({ key: 'star', name: 'Star Block', tiles: 'star', light: 0.7, color: 0xfdf6c9 }),
  cloud: def({ key: 'cloud', name: 'Cloud', tiles: 'cloud', color: 0xffffff }),
  portal: def({ key: 'portal', name: 'Portal Stone', tiles: 'portal', light: 0.6, color: 0x7ce8ff }),
  board: def({ key: 'board', name: 'Knowledge Board', tiles: 'board', color: 0x3f2f22 }),
};

export const BLOCK_LIST = defs;
export function blockDef(id: number): BlockDef {
  return defs[id] ?? defs[0];
}
export function blockId(key: string): number {
  return byKey.get(key)?.id ?? 0;
}
export function isSolid(id: number): boolean {
  return defs[id]?.solid ?? false;
}
export function isOpaque(id: number): boolean {
  const d = defs[id];
  return !!d && d.solid && !d.transparent;
}
