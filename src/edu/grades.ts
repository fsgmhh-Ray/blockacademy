/**
 * Grade bands for BlockAcademy.
 * The game follows UK/US elementary school grades (Year 1-6 / Grade 1-6).
 * Every quest and knowledge card can carry a `grade` number so that
 * younger players only see the content that fits their level.
 */

/** A school grade band. */
export interface GradeBand {
  grade: number;        // 1..6
  label: string;        // e.g. "Grade 4"
  ageRange: string;     // e.g. "Ages 9-10"
  blurb: string;        // one short sentence on what this level focuses on
  topics: string[];     // short topic tags, e.g. ["Fractions", "Area", "Magnets"]
}

export const GRADE_BANDS: GradeBand[] = [
  {
    grade: 1,
    label: 'Grade 1',
    ageRange: 'Ages 6-7',
    blurb: 'In Grade 1 we count, sort and name shapes while meeting plants and magnets for the very first time.',
    topics: ['Counting to 20', 'Shapes', 'Plants', 'Magnets'],
  },
  {
    grade: 2,
    label: 'Grade 2',
    ageRange: 'Ages 7-8',
    blurb: 'In Grade 2 we count bigger numbers, spot patterns in shapes and try out materials like plants and magnets.',
    topics: ['Counting to 100', '2D Shapes', 'Plant Life', 'Magnets', 'Materials'],
  },
  {
    grade: 3,
    label: 'Grade 3',
    ageRange: 'Ages 8-9',
    blurb: 'In Grade 3 multiplication tables and easy fractions arrive, and science covers energy, matter and simple circuits.',
    topics: ['Multiplication', 'Fractions Basics', 'Energy', 'States of Matter', 'Simple Circuits'],
  },
  {
    grade: 4,
    label: 'Grade 4',
    ageRange: 'Ages 9-10',
    blurb: 'In Grade 4 we grow confident with bigger numbers, and we explore forces, energy and simple electric circuits.',
    topics: ['Multiplication', 'Division', 'Fractions', 'Forces and Motion', 'Simple Circuits'],
  },
  {
    grade: 5,
    label: 'Grade 5',
    ageRange: 'Ages 10-11',
    blurb: 'In Grade 5 we meet equivalent fractions, angles and decimals, and we watch chemical reactions up close.',
    topics: ['Equivalent Fractions', 'Angles', 'Decimals', 'Chemical Reactions', 'Volume'],
  },
  {
    grade: 6,
    label: 'Grade 6',
    ageRange: 'Ages 11-12',
    blurb: 'In Grade 6 we master ratios and decimals while studying electricity, forces and where energy comes from.',
    topics: ['Ratios', 'Decimals', 'Equivalent Fractions', 'Forces and Energy', 'Electricity'],
  },
];

/** Default grade for a new player. */
export const DEFAULT_GRADE = 4;

const MIN_GRADE = 1;
const MAX_GRADE = 6;

/** Clamp any number to a valid grade 1..6. */
export function clampGrade(g: number): number {
  if (!Number.isFinite(g)) return DEFAULT_GRADE;
  const rounded = Math.round(g);
  if (rounded < MIN_GRADE) return MIN_GRADE;
  if (rounded > MAX_GRADE) return MAX_GRADE;
  return rounded;
}

/** Look up a band (falls back to the closest band). */
export function gradeBand(g: number): GradeBand {
  const clamped = clampGrade(g);
  for (const band of GRADE_BANDS) {
    if (band.grade === clamped) return band;
  }
  return GRADE_BANDS[0];
}

/** Human label like "Grade 4" for a grade number. */
export function gradeLabel(g: number): string {
  return gradeBand(g).label;
}

/**
 * Is a quest/knowledge entry appropriate for this grade?
 * Entries WITHOUT a grade requirement are always allowed (they are "everyone" content).
 * An entry with `grade: 4` is allowed for grade 4 and above.
 */
export function gradeAllowed(requiredGrade: number | undefined, playerGrade: number): boolean {
  if (requiredGrade === undefined) return true;
  if (!Number.isFinite(requiredGrade)) return true;
  return clampGrade(playerGrade) >= clampGrade(requiredGrade);
}

/**
 * Filter a list of items that have an optional `grade` field.
 * Generic over T so it works for Quest and KnowledgeEntry alike.
 */
export function filterByGrade<T extends { grade?: number }>(items: T[], playerGrade: number): T[] {
  return items.filter((item) => gradeAllowed(item.grade, playerGrade));
}
