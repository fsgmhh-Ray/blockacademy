/**
 * 箱子（Chest）储物系统。
 *
 * 场景里每只箱子按「场景 id + 坐标」定位，内容物保存在玩家存档里，
 * 所以箱子被挖掉再放回来、或者跨场景来回跑，东西都还在。
 *
 * 箱子里的东西跟背包一样是 Slot（{ key, count }），UI 层直接复用背包的画格逻辑。
 */
import type { Slot } from '../craft/inventory';
import { item } from '../craft/items';

/** 一只箱子 9 格，和《我的世界》一致 */
export const CHEST_SLOTS = 9;

/** 存档格式：{ "<sceneId>:<x>,<y>,<z>": [[key,count] | null, ...9 格] } */
export type ChestMap = Record<string, ([string, number] | null)[]>;

export function chestKey(sceneId: string, x: number, y: number, z: number): string {
  return `${sceneId}:${x},${y},${z}`;
}

/**
 * 村庄木屋的入门补给。第一次打开箱子时自动放进去，
 * 让「进屋 → 找东西」这个动作真的有回报（也顺便当作教学引导）。
 */
export const STARTER_LOOT: string[][] = [
  ['bread', 'bread', 'apple'],
  ['plank', 'plank', 'torch', 'torch'],
  ['wool_white', 'wool_red', 'glass'],
  ['metal', 'stick', 'coal'],
  ['carrot', 'wheat', 'egg'],
];

/** 按坐标散列出一个稳定的下标，同一只箱子永远拿到同一份初始物品 */
function pickIndex(sceneId: string, x: number, y: number, z: number, mod: number): number {
  const h = Math.abs(sceneId.length * 7349 + x * 9127 + y * 3911 + z * 2477);
  return h % mod;
}

export class ChestStore {
  private data: ChestMap;

  constructor(raw?: string) {
    this.data = raw ? ChestStore.parse(raw) : {};
  }

  private static parse(raw: string): ChestMap {
    const out: ChestMap = {};
    try {
      const j = JSON.parse(raw) as ChestMap;
      for (const k of Object.keys(j)) {
        const arr = Array.isArray(j[k]) ? j[k] : [];
        out[k] = Array.from({ length: CHEST_SLOTS }, (_, i) => {
          const e = arr[i];
          if (!e || e.length !== 2) return null;
          const [key, count] = e as [string, number];
          if (typeof key !== 'string' || !key) return null;
          return [key, Math.max(1, Math.floor(Number(count) || 1))] as [string, number];
        });
      }
    } catch {
      /* 存档坏了就当全空箱 */
    }
    return out;
  }

  serialize(): string {
    return JSON.stringify(this.data);
  }

  /** 取箱内 9 格；不存在则按需生成初始物品并记住 */
  get(sceneId: string, x: number, y: number, z: number): (Slot | null)[] {
    const k = chestKey(sceneId, x, y, z);
    let arr = this.data[k];
    if (!arr) {
      arr = Array.from({ length: CHEST_SLOTS }, () => null);
      const loot = STARTER_LOOT[pickIndex(sceneId, x, y, z, STARTER_LOOT.length)];
      loot.forEach((key, i) => {
        if (i >= CHEST_SLOTS) return;
        arr[i] = [key, 1];
      });
      this.data[k] = arr;
    }
    return arr.map((e) => (e ? { key: e[0], count: e[1] } : null));
  }

  /** 写回（引用同一数组，直接改完调用即可） */
  set(sceneId: string, x: number, y: number, z: number, slots: (Slot | null)[]): void {
    this.data[chestKey(sceneId, x, y, z)] = slots.map((s) =>
      s && s.count > 0 && item(s.key) ? ([s.key, Math.floor(s.count)] as [string, number]) : null,
    );
  }

  /** 箱子被挖掉了：清掉它的存档，避免地图里到处是幽灵数据 */
  remove(sceneId: string, x: number, y: number, z: number): void {
    delete this.data[chestKey(sceneId, x, y, z)];
  }

  /** 该坐标是否已经开过（有存档记录） */
  has(sceneId: string, x: number, y: number, z: number): boolean {
    return !!this.data[chestKey(sceneId, x, y, z)];
  }
}