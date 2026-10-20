/** Quiz bank for BlockAcademy: kid-friendly questions tied to items, recipes and demos. */

export interface Quiz {
  id: string;          // stable id, referenced by items/recipes
  topic: 'math' | 'science';
  grade: number;       // minimum school grade that fits this question (3-6)
  q: string;           // the question, short and clear
  choices: string[];   // exactly 4 answer options
  answer: number;      // index into choices of the correct one (0-3)
  explain: string;     // one or two sentences explaining why, encouraging tone
}

export const QUIZZES: Quiz[] = [
  {
    id: 'plank_split',
    topic: 'math',
    grade: 3,
    q: 'You have 8 planks in one stack and need 4 for a crafting table. What do you do?',
    choices: [
      'Split the stack into two piles of 4',
      'Throw all the planks away and chop more',
      'Put all 8 planks on the table',
      'Ask a friend to bring you 4 more planks',
    ],
    answer: 0,
    explain: 'Splitting the stack makes two equal piles of 4. Eight equals four plus four, so 4 planks are left.',
  },
  {
    id: 'crafting_table',
    topic: 'math',
    grade: 4,
    q: 'A crafting table recipe is a 2 by 2 square of planks. How many planks is that?',
    choices: ['2', '4', '6', '8'],
    answer: 1,
    explain: 'Two times two equals four, so you need exactly 4 planks to fill the square.',
  },
  {
    id: 'magnet',
    topic: 'science',
    grade: 4,
    q: 'Which of these metals can a magnet pick up?',
    choices: ['Copper', 'Aluminium', 'Iron', 'Glass'],
    answer: 2,
    explain: 'Magnets stick to iron and steel, but copper, aluminium, and glass are not magnetic.',
  },
  {
    id: 'circuit',
    topic: 'science',
    grade: 4,
    q: 'A bulb lights up only when the circuit is what?',
    choices: [
      'Open at one spot',
      'Broken in the middle',
      'Full of holes',
      'Closed, so electricity can flow around the whole loop',
    ],
    answer: 3,
    explain: 'Electricity needs a complete loop to flow. A closed circuit makes that loop, so the bulb lights up.',
  },
  {
    id: 'lens',
    topic: 'science',
    grade: 5,
    q: 'What does a convex lens do with parallel rays of sunlight?',
    choices: [
      'Spreads the rays into many colors',
      'Bounces the rays straight back',
      'Focuses the rays to one hot point',
      'Blocks the rays completely',
    ],
    answer: 2,
    explain: 'A convex lens bends the rays so they meet at one point called the focus. That point gets very hot.',
  },
  {
    id: 'mirror',
    topic: 'science',
    grade: 5,
    q: 'Light hits a flat mirror. The angle in equals what?',
    choices: [
      'Twice the angle out',
      'Half the angle out',
      'Ninety degrees exactly',
      'The same as the angle out',
    ],
    answer: 3,
    explain: 'A flat mirror reflects light evenly, so the angle coming in is the same size as the angle going out.',
  },
  {
    id: 'battery',
    topic: 'science',
    grade: 4,
    q: 'A battery changes chemical energy into what kind of energy?',
    choices: ['Sound energy', 'Electrical energy', 'Light energy', 'Magnetic energy'],
    answer: 1,
    explain: 'Inside a battery, chemicals react and push electrons along. That flow of electrons is electricity.',
  },
  {
    id: 'concrete',
    topic: 'science',
    grade: 5,
    q: 'Why does concrete get hard after you mix it with water?',
    choices: [
      'A chemical change glues the sand and gravel together',
      'The water just dries up like paint',
      'The sun melts the sand together',
      'The cement freezes like ice',
    ],
    answer: 0,
    explain: 'Cement reacts with water in a chemical change that forms strong bonds, gluing the sand and gravel into solid stone.',
  },
  {
    id: 'co2',
    topic: 'science',
    grade: 4,
    q: 'Mixing baking soda and vinegar makes which gas?',
    choices: ['Oxygen', 'Helium', 'Hydrogen', 'Carbon dioxide'],
    answer: 3,
    explain: 'The fizzy bubbles are carbon dioxide gas, the same gas you breathe out. It can blow up a balloon.',
  },
  {
    id: 'hydrogen',
    topic: 'science',
    grade: 6,
    q: 'Splitting water with a battery, which gas appears at the negative end and pops near a flame?',
    choices: ['Hydrogen', 'Oxygen', 'Nitrogen', 'Carbon dioxide'],
    answer: 0,
    explain: 'Water is made of hydrogen and oxygen. The hydrogen gathers at the negative end and gives a squeaky pop near a flame.',
  },
  {
    id: 'quicklime',
    topic: 'science',
    grade: 6,
    q: 'Heating limestone in a furnace makes quicklime and releases which gas?',
    choices: ['Oxygen', 'Steam', 'Carbon dioxide', 'Hydrogen'],
    answer: 2,
    explain: 'Limestone is calcium carbonate. Heat breaks it apart into quicklime and carbon dioxide gas, which floats away.',
  },
  {
    id: 'blaster',
    topic: 'science',
    grade: 4,
    q: 'The toy blaster should only ever be aimed at what?',
    choices: [
      'Animals playing outside',
      'Pretend night monsters in the game',
      'Your friend\'s face',
      'The kitchen window',
    ],
    answer: 1,
    explain: 'Toy blasters are for pretend targets like game monsters only. Never aim at people, animals, or anything that could break.',
  },
  {
    id: 'fly_pass',
    topic: 'science',
    grade: 3,
    q: 'When you stop flying, which force pulls you back down?',
    choices: ['Friction', 'Magnetism', 'Wind', 'Gravity'],
    answer: 3,
    explain: 'Gravity is the force that pulls everything toward the ground. That is why you come back down.',
  },
  {
    id: 'shop_coins',
    topic: 'math',
    grade: 3,
    q: 'You earn 5 coins per task and finish 4 tasks. How many coins do you get?',
    choices: ['20 coins', '9 coins', '25 coins', '15 coins'],
    answer: 0,
    explain: 'Count by fives: 5, 10, 15, 20. Four tasks of 5 coins each make 20 coins.',
  },
  {
    id: 'fraction_pizza',
    topic: 'math',
    grade: 4,
    q: 'You eat 2 of 4 equal pizza slices. Which fraction of the pizza is that?',
    choices: ['1/4', '1/2', '2/3', '3/4'],
    answer: 1,
    explain: 'Two slices out of four is the same as one out of two, so 2/4 simplifies to 1/2.',
  },
  {
    id: 'angle_right',
    topic: 'math',
    grade: 4,
    q: 'How many degrees does a right angle measure?',
    choices: ['45 degrees', '180 degrees', '90 degrees', '360 degrees'],
    answer: 2,
    explain: 'A right angle is a quarter turn, and a quarter of 360 degrees is 90 degrees.',
  },
];

export function quizById(id: string): Quiz | undefined { return QUIZZES.find((q) => q.id === id); }
