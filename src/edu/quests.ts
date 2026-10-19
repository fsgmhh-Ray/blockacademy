import { getActiveState, saveActive } from '../user/profile';

/** 场景任务：以「主动探索」为目标，而不是线性脚本 */
export interface Quest {
  id: string;
  scene: string;
  icon: string;
  title: string;
  desc: string;
  kind: 'talk' | 'demo' | 'build' | 'explore';
  /** npc 性格 id / demo id */
  target?: string;
  need: number;
}

const talk = (scene: string, target: string, title: string, desc: string): Quest => ({
  id: `talk_${scene}_${target}`,
  scene,
  icon: '💬',
  kind: 'talk',
  target,
  title,
  desc,
  need: 1,
});

const demo = (scene: string, target: string, title: string, desc: string): Quest => ({
  id: `demo_${scene}_${target}`,
  scene,
  icon: '🎬',
  kind: 'demo',
  target,
  title,
  desc,
  need: 1,
});

export const QUESTS: Quest[] = [
  // Village
  talk('village', 'stone_pine', 'Ask Elder Pinewood', 'Chat with Elder Pinewood once — ask how plants grow.'),
  talk('village', 'ling', 'Hear Ling\'s discovery', 'Talk with Ling and see what she found in the grass this time.'),
  demo('village', 'photosynthesis', 'The leaf\'s little factory', 'Step on the pad and watch "The Leaf\'s Little Factory".'),
  {
    id: 'build_village',
    scene: 'village',
    icon: '🧱',
    kind: 'build',
    title: 'Build something yourself',
    desc: 'Place 10 blocks in the village',
    need: 10,
  },
  // Forest
  talk('forest', 'lu_ming', 'Report to the ranger', 'Find Luming and ask who eats whom in the forest.'),
  talk('forest', 'xiao_man', 'Borrow a seed book', 'Chat with Xiaoman about what seeds really need to sprout.'),
  {
    id: 'explore_forest',
    scene: 'forest',
    icon: '🌲',
    kind: 'explore',
    title: 'Into the deep woods',
    desc: 'Walk more than 30 blocks from the entrance and see what hides in the middle.',
    need: 30,
  },
  demo('forest', 'photosynthesis', 'Watch the factory again', 'Replay it at the forest pad, this time watch where the oxygen comes out.'),
  // River
  talk('river', 'lan_po', 'Listen to Granny Lan on water', 'Ask Granny Lan where the river water finally goes.'),
  talk('river', 'pao', 'Chat with the water sprite', 'Bubbles knows strange things about dissolving and floating.'),
  demo('river', 'water_cycle', 'Follow the water', 'Watch "Water\'s Journey" and remember evaporate → condense → precipitate.'),
  // Cave
  talk('cave', 'pick', 'Tell the rocks apart', 'Ask Old Pick how to judge a stone\'s age.'),
  talk('cave', 'vein', 'Number a crystal', 'Help Vein record a find in the caverns.'),
  demo('cave', 'strata', 'Read the layers', 'Watch "The Timetable in Stone" and learn which layer is older.'),
  // Observatory
  talk('observatory', 'star_see', 'Count the stars', 'Ask Starsee why the Moon looks different every day.'),
  talk('observatory', 'compass', 'Set the clock', 'Let Old Compass explain where day and night really come from.'),
  demo('observatory', 'earth_motion', 'Day, night & seasons', 'Watch "Day, Night & Seasons" and note the axis stays tilted.'),
  demo('observatory', 'moon_phase', 'How the Moon changes', 'Watch "Why the Moon Changes Face" again.'),
  // Lab
  talk('lab', 'quark', 'Close a circuit', 'Ask Dr. Quark why a bulb lights up.'),
  talk('lab', 'ember', 'Keep a fire', 'Hear Keeper Ember on the three things fire needs.'),
  talk('lab', 'archie', 'Pry a stone', 'Let Archie show how much a lever saves.'),
  demo('lab', 'circuit', 'Light a bulb', 'Watch "Lighting a Bulb" and tell open, closed, and short circuits apart.'),
  {
    id: 'build_lab',
    scene: 'lab',
    icon: '🔩',
    kind: 'build',
    title: 'Build your own device',
    desc: 'Place 12 blocks in the lab',
    need: 12,
  },
  demo('lab', 'chem_volcano', 'Volcano in a flask', 'Watch the baking-soda-and-vinegar volcano and name the gas that rushes out.'),
  // Math Academy (Grade 4+)
  talk('math', 'fiona', 'Slice with Fiona', 'Ask Fraction Fiona to cut you a slice — and ask what 2/4 really equals.'),
  talk('math', 'gideon', 'Patrol with Gideon', 'Chat with Geo Gideon and estimate an angle before he measures it.'),
  talk('math', 'sylvia', 'Count with Sylvia', 'Ask Stat Sylvia what "average" really means, and how she would graph your answers.'),
  demo('math', 'fraction_pizza', 'Cut the pizza yourself', 'Watch "The Pizza That Cuts Itself" and see why 1/2 = 2/4 = 4/8.'),
  demo('math', 'angle_spinner', 'Turn a ray', 'Watch "The Turning Ray" and match 30°, 60°, 90° and 180° to real turns.'),
  {
    id: 'explore_math',
    scene: 'math',
    icon: '🧭',
    kind: 'explore',
    title: 'Walk the whole academy',
    desc: 'Walk more than 30 blocks from the entrance and visit the Pizza Parlor, the Garden, the Bridge and the Stat Tower.',
    need: 30,
  },
  {
    id: 'build_math',
    scene: 'math',
    icon: '🧱',
    kind: 'build',
    title: 'Build something mathematical',
    desc: 'Place 12 blocks in the academy — try a symmetric shape or a bar graph of your own!',
    need: 12,
  },
];

export const REWARDS: Record<string, { icon: string; name: string }> = {
  village: { icon: '🌿', name: 'Life Starter Badge' },
  forest: { icon: '🍃', name: 'Eco Watcher Badge' },
  river: { icon: '💧', name: 'Water Cycle Badge' },
  cave: { icon: '🪨', name: 'Geo Time Badge' },
  observatory: { icon: '✨', name: 'Star Explorer Badge' },
  lab: { icon: '⚡', name: 'Lab Whiz Badge' },
  math: { icon: '🔢', name: 'Number Master Badge' },
};

export function questsOf(scene: string): Quest[] {
  return QUESTS.filter((q) => q.scene === scene);
}

/** 进度读写 —— 进度归属到当前玩家（见 src/user/profile.ts） */
export interface Progress {
  talk: Record<string, number>;
  demo: Record<string, number>;
  build: Record<string, number>;
  explore: Record<string, number>;
  chatTurns: number;
}

const empty = (): Progress => ({ talk: {}, demo: {}, build: {}, explore: {}, chatTurns: 0 });

export function loadProgress(): Progress {
  return getActiveState().state.progress;
}

export function saveProgress(p: Progress): void {
  saveActive({ progress: p });
}

export function questValue(p: Progress, q: Quest): number {
  return (p[q.kind][q.id] ?? 0) as number;
}

export function bump(p: Progress, q: Quest, amount = 1): void {
  p[q.kind][q.id] = Math.min(q.need, (p[q.kind][q.id] ?? 0) + amount);
}

export function isDone(q: Quest, p: Progress): boolean {
  return questValue(p, q) >= q.need;
}

export function sceneProgress(scene: string, p: Progress): { done: number; total: number } {
  const list = questsOf(scene);
  return { done: list.filter((q) => isDone(q, p)).length, total: list.length };
}
