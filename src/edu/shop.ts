/** Coin shop for BlockAcademy: coins come from tasks, and passes are the things you buy. */

export interface Pass {
  id: string;        // stable id
  name: string;      // e.g. "Flight Pass"
  icon: string;      // emoji
  cost: number;      // coins
  desc: string;      // one friendly sentence
  /** What the pass unlocks in the game. */
  effect: 'fly' | 'speed' | 'night_vision' | 'creative' | 'shield' | 'treasure' | 'lucky';
  /** The quiz id (from src/edu/quizzes.ts) a player must pass first, or '' if none. */
  quiz: string;
}

/** Coins you earn for finishing one small task. */
export const COINS_PER_TASK = 5;
/** Coins you earn for finishing a whole lesson. */
export const COINS_PER_LESSON = 10;

export const PASSES: Pass[] = [
  {
    id: 'pass_lucky',
    name: 'Lucky Clover Pass',
    icon: '🍀',
    cost: 20,
    desc: 'You find one extra bonus block every so often.',
    effect: 'lucky',
    quiz: '',
  },
  {
    id: 'pass_speed',
    name: 'Speed Pass',
    icon: '👟',
    cost: 25,
    desc: 'Your boots let you run a bit faster than everyone else.',
    effect: 'speed',
    quiz: '',
  },
  {
    id: 'pass_night',
    name: 'Night Vision Pass',
    icon: '🌙',
    cost: 30,
    desc: 'You can see clearly even when it is dark outside.',
    effect: 'night_vision',
    quiz: '',
  },
  {
    id: 'pass_shield',
    name: 'Bubble Shield Pass',
    icon: '🛡️',
    cost: 35,
    desc: 'A soft bubble shield keeps you safe from bumps.',
    effect: 'shield',
    quiz: '',
  },
  {
    id: 'pass_fly',
    name: 'Flight Pass',
    icon: '🪶',
    cost: 40,
    desc: 'You can lift off the ground and fly over the whole world.',
    effect: 'fly',
    quiz: 'fly_pass',
  },
  {
    id: 'pass_treasure',
    name: 'Treasure Pass',
    icon: '💎',
    cost: 50,
    desc: 'Gem stones appear in new places so you can go treasure hunting.',
    effect: 'treasure',
    quiz: '',
  },
  {
    id: 'pass_creative',
    name: 'Creative Pass',
    icon: '🎨',
    cost: 60,
    desc: 'You get new colours and building parts to build exactly what you imagine.',
    effect: 'creative',
    quiz: 'circuit',
  },
];

/** Find one pass by its id. */
export function passById(id: string): Pass | undefined {
  return PASSES.find((p) => p.id === id);
}

/** Find every pass that unlocks the same thing. */
export function passesForEffect(e: Pass['effect']): Pass[] {
  return PASSES.filter((p) => p.effect === e);
}
