/**
 * Recipe book panel for BlockAcademy.
 *
 * Everything here is built from the real recipe table in ./crafting so the book
 * can never drift away from what the game actually lets you craft. The player
 * picks an item and the book either says "you can make it" or tells them
 * exactly which blocks to go and mine.
 */
import { allRecipes, type Recipe } from './crafting';
import { hasItem, item } from './items';
import { BLOCK_LIST } from '../core/blockRegistry';

export interface BookEntry {
  /** The item key produced by this recipe. */
  out: string;
  /** Display name of the result. */
  name: string;
  /** Emoji for the result. */
  icon: string;
  /** How many of the result one craft gives. */
  count: number;
  /** Human text of the recipe, e.g. "4 x Planks" or "2 x Stick + 3 x Planks". */
  formula: string;
  /** What the player still needs, with friendly wording. */
  need: { item: string; name: string; have: number; want: number; mine: string }[];
  /** Station needed, e.g. "Crafting Table", "Furnace", or "Anywhere". */
  station: string;
  /** 1-3 sentence kid-friendly explanation of the real-world idea behind it. */
  why: string;
}

// ───────── tiny lookups (nothing is registered or mutated at import time) ─────────

/** Display name of a block, straight from the block registry. */
function blockName(key: string): string | null {
  for (const b of BLOCK_LIST) if (b.key === key) return b.name;
  return null;
}

/** Display name of any item, using the item table. */
function itemName(key: string): string {
  return hasItem(key) ? item(key).name : key;
}

/** Emoji of any item, falling back to a plain block so the UI never shows a hole. */
function itemIcon(key: string): string {
  if (hasItem(key)) return item(key).icon;
  return blockName(key) ? '🧱' : '❔';
}

// ───────── wording tables ─────────

const STATION_LABEL: Record<string, string> = {
  inventory: 'Anywhere',
  table: 'Crafting Table',
  furnace: 'Furnace',
};

/** Short friendly note about what to go and mine for each item. */
const MINE: Record<string, string> = {
  wood: 'Punch a tree trunk (Wood Log) to get logs, then craft planks from them.',
  plank: 'Punch a tree trunk (Wood Log) to get logs, then craft planks from them.',
  stick: 'Punch a tree trunk (Wood Log), craft planks, then make sticks from planks.',
  crafting_table: 'Punch a tree trunk (Wood Log) and craft 4 planks into a Crafting Table.',
  board: 'A Knowledge Board is crafted from planks, so start by punching a tree trunk (Wood Log).',
  torch: 'Mine Coal Ore for coal and punch a tree for sticks, then mix them in your grid.',
  coal: 'Mine Coal Ore in the hills and caves. Smelting a Wood Log in a furnace also gives coal.',
  wheat: 'Break Tall Grass in a field and you sometimes find Wheat. Chopping grass is the best way.',
  flour: 'Find Wheat in tall grass, then grind 1 wheat into flour.',
  hay: 'Hay comes from Wheat. Craft 9 wheat into one Hay Bale at a Crafting Table.',
  bookshelf: 'A Bookshelf needs Planks and Knowledge Boards, and both start with a Wood Log.',
  cobble: 'Mine Stone blocks with a pickaxe. Each one drops Cobblestone.',
  stone: 'Mine Stone blocks with a pickaxe. Each drops Cobblestone, and smelt that into Stone.',
  furnace: 'A Furnace is built from 8 Cobblestone, so mine some Stone first.',
  glass: 'Dig up Sand near water or in a desert, then smelt it in a Furnace.',
  sand: 'Dig up Sand blocks near water or in a desert. A shovel digs sand fastest.',
  iron_ingot: 'Mine Iron Ore in the caves, then smelt it in a Furnace.',
  iron_ore: 'Dig deep underground and look for Iron Ore. It is common in caves.',
  gold_ingot: 'Mine Gold Ore deep underground, then smelt it in a Furnace.',
  gold_ore: 'Dig deep underground and look for Gold Ore. It is rarer than iron.',
  crystal_shard: 'Mine Crystal Ore in the caves, then smelt it in a Furnace.',
  crystal_ore: 'Look for glowing purple Crystal Ore while you are mining underground.',
  copper_ingot: 'Mine Copper Ore underground, then smelt it in a Furnace.',
  copper_ore: 'Look for Copper Ore while you are digging underground, then smelt it into ingots.',
  metal: 'Iron Ingots are made from Iron Ore. Craft a full 3x3 square of them into one Iron Block.',
  limestone: 'Mine Limestone blocks. They are pale and easy to spot in caves and mountains.',
  quicklime: 'Mine Limestone, then roast it hot in a Furnace to make quicklime.',
  salt: 'Mix Salt with Water to make Salt Water, then boil the water away in a Furnace. The white crystals left are Salt.',
  saltwater: 'Mix Salt with Water in your grid to make Salt Water.',
  water: 'Look for a Water pool, a river or the sea. Dig down and you will hit water underground too.',
  sugar: 'Sugar comes from sugarcane and sugar beets in a farm field.',
  sugar_water: 'Mix Sugar with Water in your grid and watch the sugar dissolve.',
  baking_soda: 'Baking soda is a white powder. Look in the supplies box in the lab corner.',
  vinegar: 'Vinegar is a sour-smelling liquid. Look for the bottle on the lab shelf.',
  milk: 'Milk comes from cows. Find a cow on the farm and milk it.',
  egg: 'Eggs come from hens. Find a hen near the farm and collect its eggs.',
  glowstone: 'Glowstone is made from 4 Crystal Shards. Smelt Crystal Ore to get them.',
  quartz: 'Quartz is crafted from 4 Crystal Shards at a Crafting Table.',
  bread: 'Bread is baked from flour. Craft 3 Flour, or smelt wheat in a Furnace.',
  cake: 'A Cake needs 3 Milk, 2 Wheat and 1 Egg at the Crafting Table.',
  mirror: 'Make Glass from sand, then craft a Mirror from glass and metal.',
  lens: 'Make Glass from sand, then shape a Magnifying Lens in the Crafting Table.',
  magnet: 'Smelt Iron Ore into ingots, then mix three ingots with a Crystal Shard.',
  battery: 'A Battery is made from an Iron Block, a Crystal Shard and coal.',
  circuit: 'Smelt Copper Ore into copper ingots, then lay them around a piece of Glass.',
  co2: 'Mix Baking Soda and Vinegar at the Crafting Table. The bubbles they make are carbon dioxide gas.',
  oxygen: 'Split Water with a Battery. Put the battery under the water to collect the oxygen.',
  hydrogen: 'Split Water with a Battery. Put the battery on top of the water to collect the hydrogen.',
  rust: 'Rust needs iron plus water plus oxygen. Craft it at the table and watch it grow slowly.',
  concrete_mix: 'Mix Sand, Quicklime and Water at the Crafting Table to get Concrete Mix.',
  concrete: 'Mix Sand, Quicklime and Water into Concrete Mix, then turn the mix into solid Concrete.',
  slaked_lime: 'Splash Quicklime with Water and it turns into slaked lime.',
};

/** Kid-friendly explanation of the real idea behind each recipe result. */
const WHY: Record<string, string> = {
  plank: 'Wood comes from a tree that grew long ago. Cutting it into flat planks makes it easy to build with.',
  stick: 'Sticks are the handles of almost every tool. A good handle lets the tool do more work for you.',
  crafting_table: 'A crafting table gives you a bigger 3 by 3 grid, so you can build bigger things. It is your workshop.',
  torch: 'A torch is light you can carry. Charcoal and wood burn slowly, which is why torches last a long time.',
  flour: 'Flour is wheat ground into a fine powder. Removing the tough parts of the grain makes it soft and easy to bake with.',
  glowstone: 'Some crystals keep glowing after the light is gone. People use them to light up caves without burning anything.',
  quartz: 'Quartz is one of the most common minerals in the earth. People use it for glass and for keeping accurate clocks.',
  hay: 'Hay is dried grass packed tight. It is light, it stays good for a long time, and farm animals love it.',
  bookshelf: 'Books are knowledge you can keep. A bookshelf is just a tidy home for all your stories.',
  furnace: 'A furnace is a hot oven. Heat changes materials in ways your hands never could.',
  bread: 'Baking uses heat to make flour rise into soft, tasty bread. Good food gives you energy to keep exploring.',
  cake: 'A cake is flour, eggs, milk and sugar baked together. It is a celebration food, so save one for a party.',
  metal: 'Packing iron ingots into a block makes a strong, heavy building material that lasts a long time.',
  iron_ingot: 'Smelting is heating ore until the metal comes out. That is how people have made iron tools for thousands of years.',
  gold_ingot: 'Gold is special because it never rusts. That is why it has been valued for so many thousands of years.',
  crystal_shard: 'Crystals grow slowly inside rock. Their neat, repeating shapes are why they catch light so well.',
  coal: 'Coal is old plant material that the earth squeezed and heated for millions of years. It stores a lot of energy.',
  saltwater: 'When you stir salt into water it does not vanish, it just spreads out into tiny invisible pieces. That is dissolving.',
  sugar_water: 'Sugar dissolves in water into tiny invisible pieces too, so the sugar is still there, just too small to see.',
  co2: 'Mixing an acid and a base is called a neutralisation. It throws off carbon dioxide gas, and that gas is the fizz you see.',
  rust: 'Iron plus oxygen plus water makes rust. It is a chemical change, so unlike dissolving you cannot mix it back the other way.',
  quicklime: 'Heating limestone breaks it apart for good. Quicklime is the leftover part, and it is dangerous until you add water.',
  slaked_lime: 'Quicklime plus water releases a big burst of heat. Builders use slaked lime to make whitewash and mortar.',
  concrete_mix: 'Sand, quicklime and water together make mortar, the real glue that holds buildings together.',
  concrete: 'A chemical change glues the sand and gravel into one super-strong solid. That is why so many buildings are made of concrete.',
  battery: 'Inside a battery, chemicals react and push tiny electrons along. That moving charge is electricity.',
  hydrogen: 'A battery can split water apart with electricity. Hydrogen collects at the negative end, and it is the lightest gas there is.',
  oxygen: 'Splitting water with electricity makes oxygen too. Oxygen is what lets a flame keep burning.',
  water: 'Two hydrogen atoms and one oxygen atom make a water molecule. Mixing them back together makes a tiny pop.',
  mirror: 'Light bounces off a shiny surface. On a flat mirror the angle going in equals the angle coming out.',
  lens: 'A lens that is fat in the middle bends parallel light into one bright point. That point gets hot enough to start a fire.',
  magnet: 'A magnet pulls on iron because iron atoms line up inside it. The two ends, called poles, pull the hardest.',
  circuit: 'Electricity needs a complete loop to travel around. Copper carries the current and the glass board keeps it from leaking out.',
  copper_ingot: 'Copper carries electricity almost as well as silver, so wires and circuit boards are made from it.',
  milk: 'Milk is food for young animals. It has water, fat and protein all mixed together in one drink.',
  egg: 'An egg holds everything a new life needs to start growing. It is a really well-packed lunch box.',
  salt: 'Boiling the water out of seawater leaves the salt behind. That is how people have made salt for thousands of years.',
  sugar: 'Sugar comes from sugarcane and sugar beets. Heat it and it turns into caramel, which is a real chemical change.',
  baking_soda: 'Baking soda is a mild base. Bases are the opposite of acids, and they love to react together.',
  vinegar: 'Vinegar is an acid made by tiny living things. Acids and bases fizz when they meet.',
  board: 'A knowledge board is where you write down what you have learned so you never forget it.',
};

/** One friendly sentence about each kind of tool. */
const TOOL_WHY: Record<string, string> = {
  pickaxe: 'A pickaxe is built for hard rock like stone and ore. Its pointed head splits stone instead of just scratching it.',
  axe: 'An axe is shaped for wood. The wide blade bites into a tree trunk fast, so you get planks quicker.',
  shovel: 'A shovel is the tool for dirt, sand and snow. Its wide scoop moves soft ground much faster than a pickaxe.',
  sword: 'A sword is for staying safe and having fun in caves. It is not for hitting trees or digging holes.',
  hoe: 'A hoe makes neat rows in farmland. Real farmers plant in rows so every seed gets room to grow.',
};

/** Word the real science idea behind a result, with a cheerful fallback. */
function whyFor(out: string): string {
  const direct = WHY[out];
  if (direct) return direct;
  for (const [suffix, text] of Object.entries(TOOL_WHY)) {
    if (out.endsWith('_' + suffix)) return text;
  }
  return `You can build ${itemName(out)} yourself. Gather the materials, follow the shape, and give it a try!`;
}

/** Friendly hint naming the blocks to mine for one item. */
export function mineHint(itemKey: string): string {
  const hint = MINE[itemKey];
  if (hint) return hint;
  const block = blockName(itemKey);
  if (block) return `Look for ${block} blocks and mine them.`;
  return `Craft ${itemName(itemKey)} from other materials, or look for it in a chest.`;
}

// ───────── recipe reading ─────────

/** Every item key a recipe eats up, in grid order. Handles shaped, shapeless and smelt recipes. */
function recipeNeeds(r: Recipe): string[] {
  if (r.shapeless) return [...r.shapeless];
  if (r.shape && r.key) {
    const out: string[] = [];
    for (const row of r.shape) {
      for (const ch of row) {
        if (ch === '.' || ch === ' ') continue;
        const key = r.key[ch];
        if (key) out.push(key);
      }
    }
    return out;
  }
  if (r.input) return [r.input];
  return [];
}

/** Count up duplicates, e.g. two water becomes one line that says 2. */
function tally(keys: string[]): { item: string; name: string; want: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (!counts.has(key)) {
      counts.set(key, 0);
      order.push(key);
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return order.map((key) => ({ item: key, name: itemName(key), want: counts.get(key) ?? 0 }));
}

function part(text: string, count: number): string {
  return count > 1 ? `${count} × ${text}` : `1 × ${text}`;
}

/** Build the whole recipe book from the real recipe table. */
export function buildRecipeBook(): BookEntry[] {
  const book: BookEntry[] = [];
  for (const r of allRecipes()) {
    const need = tally(recipeNeeds(r));
    const ingredients = need.map((n) => part(n.name, n.want)).join(' + ');
    const result = part(itemName(r.out), r.count);
    book.push({
      out: r.out,
      name: itemName(r.out),
      icon: itemIcon(r.out),
      count: r.count,
      formula: ingredients ? `${ingredients} → ${result}` : result,
      need: need.map((n) => ({ item: n.item, name: n.name, have: 0, want: n.want, mine: mineHint(n.item) })),
      station: STATION_LABEL[r.station] ?? 'Anywhere',
      why: whyFor(r.out),
    });
  }
  return book;
}

/** Fill in have/want for each entry given the player's item counts. */
export function withHave(entries: BookEntry[], counts: Record<string, number>): BookEntry[] {
  return entries.map((e) => ({
    ...e,
    need: e.need.map((n) => ({ ...n, have: counts[n.item] ?? 0, want: n.want, mine: mineHint(n.item) })),
  }));
}