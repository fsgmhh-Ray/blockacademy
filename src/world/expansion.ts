/**
 * 世界扩张（World Expansion）
 *
 * 规则：每完成一个任务 / 一节课，世界就长大一点。
 * 每次扩张会在当前场景的空地上搭出一个小东西（花坛、路灯、长椅、喷泉……），
 * 让玩家看得见「学习让世界变大」。
 */
import type { World } from '../core/world';
import { blocks } from './blockIds';

export interface Expansion {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** 在 (x, z) 附近、地面高度 y 上搭出这个扩张 */
  build: (w: World, x: number, z: number, y: number) => void;
}

/** 把一段范围内的地面找平并铺上指定方块 */
function pad(w: World, cx: number, cz: number, r: number, y: number, id: number): void {
  for (let dx = -r; dx <= r; dx++)
    for (let dz = -r; dz <= r; dz++) {
      if (Math.hypot(dx, dz) > r) continue;
      w.set(cx + dx, y, cz + dz, id);
    }
}

export const EXPANSIONS: Expansion[] = [
  {
    id: 'flowerbed',
    name: 'A flower bed',
    desc: 'A neat patch of flowers grew where you were standing.',
    icon: '🌷',
    build: (w, x, z, y) => {
      pad(w, x, z, 2, y, blocks.farmland);
      w.set(x - 1, y + 1, z - 1, blocks.flowerRed);
      w.set(x + 1, y + 1, z - 1, blocks.flowerBlue);
      w.set(x - 1, y + 1, z + 1, blocks.flowerYellow);
      w.set(x + 1, y + 1, z + 1, blocks.flowerPink);
      w.set(x, y + 1, z, blocks.tallGrass);
    },
  },
  {
    id: 'lamppost',
    name: 'A lamp post',
    desc: 'A lamp post appeared so the path is easier to see at night.',
    icon: '💡',
    build: (w, x, z, y) => {
      w.set(x, y + 1, z, blocks.metal);
      w.set(x, y + 2, z, blocks.metal);
      w.set(x, y + 3, z, blocks.lamp);
    },
  },
  {
    id: 'bench',
    name: 'A bench',
    desc: 'Somebody left a bench — time to sit down and think.',
    icon: '🪑',
    build: (w, x, z, y) => {
      w.set(x - 1, y + 1, z, blocks.plank);
      w.set(x, y + 1, z, blocks.plank);
      w.set(x + 1, y + 1, z, blocks.plank);
      w.set(x - 1, y + 2, z, blocks.bookshelf);
      w.set(x + 1, y + 2, z, blocks.bookshelf);
    },
  },
  {
    id: 'fountain',
    name: 'A little fountain',
    desc: 'A fountain started bubbling — water finds its own way down.',
    icon: '⛲',
    build: (w, x, z, y) => {
      pad(w, x, z, 2, y, blocks.stoneBrick);
      w.set(x, y, z, blocks.water);
      w.set(x, y + 1, z, blocks.glass);
    },
  },
  {
    id: 'sapling',
    name: 'A young tree',
    desc: 'A tree sapling grew into a little tree. Good things take time.',
    icon: '🌳',
    build: (w, x, z, y) => {
      w.set(x, y + 1, z, blocks.wood);
      w.set(x, y + 2, z, blocks.wood);
      w.set(x, y + 3, z, blocks.leaves);
      w.set(x - 1, y + 3, z, blocks.leaves);
      w.set(x + 1, y + 3, z, blocks.leaves);
      w.set(x, y + 4, z, blocks.leaves);
    },
  },
  {
    id: 'bookshelf',
    name: 'A reading nook',
    desc: 'A bookshelf appeared full of things somebody learned.',
    icon: '📚',
    build: (w, x, z, y) => {
      w.set(x, y + 1, z, blocks.bookshelf);
      w.set(x, y + 2, z, blocks.bookshelf);
      w.set(x + 1, y + 1, z, blocks.craftingTable);
      w.set(x - 1, y + 1, z, blocks.torch);
    },
  },
  {
    id: 'campfire',
    name: 'A campfire',
    desc: 'A safe campfire glows. Nice work deserves a rest.',
    icon: '🔥',
    build: (w, x, z, y) => {
      w.set(x, y, z, blocks.gravel);
      w.set(x, y + 1, z, blocks.torch);
      w.set(x + 1, y, z, blocks.wood);
      w.set(x - 1, y, z, blocks.wood);
    },
  },
  {
    id: 'garden',
    name: 'A vegetable patch',
    desc: 'Carrots are growing in a tidy patch. Ask an adult before you pick one.',
    icon: '🥕',
    build: (w, x, z, y) => {
      pad(w, x, z, 2, y, blocks.farmland);
      w.set(x - 1, y + 1, z, blocks.carrot);
      w.set(x, y + 1, z, blocks.wheat);
      w.set(x + 1, y + 1, z, blocks.carrot);
    },
  },
  {
    id: 'sundial',
    name: 'A sundial',
    desc: 'A stone sundial appeared. The sun keeps time for you.',
    icon: '🕐',
    build: (w, x, z, y) => {
      w.set(x, y, z, blocks.stoneBrick);
      w.set(x, y + 1, z, blocks.quartz);
      w.set(x, y + 2, z, blocks.glowstone);
    },
  },
  {
    id: 'pond',
    name: 'A duck pond',
    desc: 'A little pond appeared, and the water is already cloudy with life.',
    icon: '🦆',
    build: (w, x, z, y) => {
      pad(w, x, z, 3, y, blocks.sand);
      w.set(x, y, z, blocks.water);
      w.set(x + 1, y, z, blocks.water);
      w.set(x - 1, y, z, blocks.water);
      w.set(x, y, z + 1, blocks.water);
      w.set(x, y, z - 1, blocks.water);
    },
  },
  {
    id: 'labtable',
    name: 'An experiment table',
    desc: 'A lab bench appeared. Time to mix something and see what happens.',
    icon: '🧪',
    build: (w, x, z, y) => {
      w.set(x, y + 1, z, blocks.craftingTable);
      w.set(x + 1, y + 1, z, blocks.furnace);
      w.set(x - 1, y + 1, z, blocks.glass);
    },
  },
  {
    id: 'beehive',
    name: 'A beehive',
    desc: 'Bees arrived — they pollinate the flowers and make honey.',
    icon: '🐝',
    build: (w, x, z, y) => {
      w.set(x, y + 1, z, blocks.hay);
      w.set(x, y + 2, z, blocks.hay);
      w.set(x, y + 3, z, blocks.hay);
    },
  },
];

/** 每个场景的扩张落点（相对场景中心） */
const SPOTS: Record<string, { dx: number; dz: number }[]> = {
  village: [
    { dx: 8, dz: 4 },
    { dx: -6, dz: 8 },
    { dx: 12, dz: -4 },
    { dx: -10, dz: -6 },
  ],
  forest: [
    { dx: 6, dz: 6 },
    { dx: -8, dz: 4 },
    { dx: 10, dz: -6 },
  ],
  river: [
    { dx: 7, dz: 5 },
    { dx: -7, dz: 7 },
  ],
  cave: [
    { dx: 6, dz: 6 },
    { dx: -6, dz: -6 },
  ],
  observatory: [
    { dx: 8, dz: 2 },
    { dx: -8, dz: -2 },
  ],
  lab: [
    { dx: 7, dz: 5 },
    { dx: -7, dz: 5 },
  ],
  math: [
    { dx: 8, dz: 6 },
    { dx: -8, dz: 6 },
    { dx: 0, dz: 12 },
  ],
};

/**
 * 在场景里扩张一次。
 * level = 已经扩张过几次（0 表示第一次）。
 * 返回刚刚建好的东西，方便给玩家一个提示。
 */
export function expandWorld(w: World, level: number, sceneId: string, sceneCx: number, sceneCz: number): Expansion | null {
  if (level <= 0) return null;
  const list = SPOTS[sceneId] ?? SPOTS.village;
  const e = EXPANSIONS[(level - 1) % EXPANSIONS.length];
  // 找一个空地：落点要平整、周围不能已经有建筑
  for (let attempt = 0; attempt < list.length; attempt++) {
    const spot = list[(attempt + (level - 1)) % list.length];
    const x = Math.round(sceneCx + spot.dx);
    const z = Math.round(sceneCz + spot.dz);
    if (!clearSpot(w, x, z)) continue;
    // groundY = 地表顶面（可以直接放方块的高度）
    const y = w.groundY(x, z);
    e.build(w, x, z, y);
    w.flushDirty(4);
    return e;
  }
  return null;
}

/** 落点周围 3 格内要平、且不能悬空在已有建筑头上 */
function clearSpot(w: World, x: number, z: number): boolean {
  const base = w.groundY(x, z);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const g = w.groundY(x + dx, z + dz);
      if (Math.abs(g - base) > 1) return false; // 地形起伏太大
      // 头顶有方块 = 已经在建筑里了
      if (w.get(x + dx, g, z + dz) !== 0) return false;
      if (w.get(x + dx, g + 1, z + dz) !== 0) return false;
    }
  }
  return true;
}

/** 扩张横幅上要写的那句话 */
export const EXPANSION_BANNER = 'EACH TIME YOU COMPLETE A LESSON OR TASK - THE WORLD WILL EXPAND';
