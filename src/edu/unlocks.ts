/**
 * Item unlocks for BlockAcademy.
 *
 * A few items stay locked until the player answers their quiz correctly. That
 * way the science behind each item gets learned before it gets used.
 */

export interface ItemUnlock {
  /** The item key in items.ts that is locked. */
  item: string;
  /** The quiz id in src/edu/quizzes.ts that unlocks it. */
  quiz: string;
  /** One short line explaining why the player is learning this. */
  reason: string;
}

export const ITEM_UNLOCKS: ItemUnlock[] = [
  {
    item: 'magnet',
    quiz: 'magnet',
    reason: 'Magnets pull on iron only, so you need to know which metals are magnetic before you build one.',
  },
  {
    item: 'lens',
    quiz: 'lens',
    reason: 'A lens bends light into one hot spot, and understanding that makes the lens way more useful.',
  },
  {
    item: 'mirror',
    quiz: 'mirror',
    reason: 'Mirrors work because light bounces off at the same angle it arrived, and that idea powers a lot of science.',
  },
  {
    item: 'circuit',
    quiz: 'circuit',
    reason: 'Electricity needs a closed loop, so learn that first and every circuit you build will make sense.',
  },
  {
    item: 'battery',
    quiz: 'battery',
    reason: 'A battery turns chemical energy into electricity, which is the trick behind splitting water later.',
  },
  {
    item: 'concrete',
    quiz: 'concrete',
    reason: 'Concrete hardens because of a chemical change, not because it dries, and that is why it is so strong.',
  },
  {
    item: 'co2',
    quiz: 'co2',
    reason: 'Carbon dioxide is the gas that fizzes up when an acid and a base meet, so learn what it is first.',
  },
  {
    item: 'hydrogen',
    quiz: 'hydrogen',
    reason: 'Hydrogen is what collects at the negative end when you split water with a battery.',
  },
  {
    item: 'toy_blaster',
    quiz: 'blaster',
    reason: 'The toy blaster is foam-only and only works on night Shadows — never on animals or people.',
  },
];

/** The unlock entry for an item, if it is locked. */
export function unlockFor(itemKey: string): ItemUnlock | undefined {
  return ITEM_UNLOCKS.find((u) => u.item === itemKey);
}

/** All item keys that are locked. */
export function lockedItems(): string[] {
  return ITEM_UNLOCKS.map((u) => u.item);
}