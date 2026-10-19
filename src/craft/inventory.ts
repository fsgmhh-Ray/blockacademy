/** 背包：0-8 快捷栏，9-35 储物，外加副手槽与合成网格 */
import { item } from './items';
import { findRecipe, furnaceRecipe } from './crafting';

export interface Slot {
  key: string;
  count: number;
}

export type Tab = 'bag' | 'craft' | 'furnace';

const N = 36;
const HOT = 9;

export class Inventory {
  slots: (Slot | null)[] = Array.from({ length: N }, () => null);
  /** 3×3 合成网格；背包模式只用 0,1,3,4 */
  craft: (Slot | null)[] = Array.from({ length: 9 }, () => null);
  furnaceIn: Slot | null = null;
  offhand: Slot | null = null;
  cursor: Slot | null = null;
  tab: Tab = 'bag';

  /** 当前合成台能产出什么（输出格显示的内容） */
  get craftResult(): Slot | null {
    if (this.tab === 'furnace') {
      if (!this.furnaceIn) return null;
      const r = furnaceRecipe(this.furnaceIn.key);
      return r ? { key: r.out, count: r.count } : null;
    }
    const size: 2 | 3 = this.tab === 'craft' ? 3 : 2;
    const cells =
      size === 3
        ? this.craft.map((s) => (s ? s.key : ''))
        : [0, 1, 3, 4].map((i) => (this.craft[i] ? this.craft[i]!.key : ''));
    const r = findRecipe(cells, size, this.tab === 'craft' ? 'table' : 'inventory');
    return r ? { key: r.out, count: r.count } : null;
  }

  clone(): Inventory {
    const c = new Inventory();
    c.slots = this.slots.map((s) => (s ? { ...s } : null));
    c.craft = this.craft.map((s) => (s ? { ...s } : null));
    c.furnaceIn = this.furnaceIn ? { ...this.furnaceIn } : null;
    c.offhand = this.offhand ? { ...this.offhand } : null;
    return c;
  }

  get hotbar(): (Slot | null)[] {
    return this.slots.slice(0, HOT);
  }
  get storage(): (Slot | null)[] {
    return this.slots.slice(HOT);
  }

  countOf(key: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.key === key) n += s.count;
    if (this.offhand && this.offhand.key === key) n += this.offhand.count;
    if (this.cursor && this.cursor.key === key) n += this.cursor.count;
    return n;
  }

  /** 往背包加东西，返回没放下的数量 */
  add(key: string, n = 1): number {
    const max = item(key).stack;
    for (let i = 0; i < N && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.key === key && s.count < max) {
        const put = Math.min(max - s.count, n);
        s.count += put;
        n -= put;
      }
    }
    for (let i = 0; i < N && n > 0; i++) {
      if (!this.slots[i]) {
        const put = Math.min(max, n);
        this.slots[i] = { key, count: put };
        n -= put;
      }
    }
    return n;
  }

  /** 从背包（含快捷栏）扣除，成功返回 true */
  remove(key: string, n = 1): boolean {
    if (this.countOf(key) < n) return false;
    for (let i = 0; i < N && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.key === key) {
        const take = Math.min(s.count, n);
        s.count -= take;
        n -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return n === 0;
  }

  removeAt(index: number, n = 1): void {
    const s = this.slots[index];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[index] = null;
  }

  clearCraft(): void {
    // 退出合成界面时把网格里的东西还给背包
    for (const s of this.craft) if (s) this.add(s.key, s.count);
    this.craft = Array.from({ length: 9 }, () => null);
    if (this.furnaceIn) {
      this.add(this.furnaceIn.key, this.furnaceIn.count);
      this.furnaceIn = null;
    }
  }

  serialize(): string {
    return JSON.stringify({
      s: this.slots.map((x) => (x ? [x.key, x.count] : null)),
      o: this.offhand ? [this.offhand.key, this.offhand.count] : null,
      f: this.furnaceIn ? [this.furnaceIn.key, this.furnaceIn.count] : null,
    });
  }

  load(json: string): void {
    try {
      const d = JSON.parse(json) as {
        s?: ((string | number)[] | null)[] | null;
        o?: (string | number)[] | null;
        f?: (string | number)[] | null;
      };
      if (Array.isArray(d.s)) {
        for (let i = 0; i < N; i++) {
          const e = d.s[i];
          this.slots[i] = e && e.length === 2 ? { key: String(e[0]), count: Number(e[1]) } : null;
        }
      }
      if (d.o && d.o.length === 2) this.offhand = { key: String(d.o[0]), count: Number(d.o[1]) };
      if (d.f && d.f.length === 2) this.furnaceIn = { key: String(d.f[0]), count: Number(d.f[1]) };
    } catch {
      /* 存档坏了就当新背包 */
    }
  }
}
