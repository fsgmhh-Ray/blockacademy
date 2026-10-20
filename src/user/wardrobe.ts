/**
 * Wardrobe for BlockAcademy.
 *
 * The wardrobe holds every look a player can pick for their blocky avatar.
 * An outfit is plain data (only strings), so it can be saved straight into
 * the player's saved state in localStorage and sent over the network.
 *
 * Colour slots store a hex colour. Hair, hat and cape slots store one emoji
 * (or an empty string when the player does not want that item).
 */
export interface Outfit {
  skin: string;    // hex colour, e.g. "#f2c39a"
  shirt: string;   // hex colour
  pants: string;   // hex colour
  shoes: string;   // hex colour
  hat: string;     // emoji or '' (no hat)
  hair: string;    // emoji or '' 
  cape: string;    // emoji or '' 
}

/** Every choice the player can make, grouped for a wardrobe UI. */
export interface WardrobeOption {
  id: string;        // stable id, e.g. "shirt_red", "hat_cap"
  slot: 'skin' | 'shirt' | 'pants' | 'shoes' | 'hat' | 'hair' | 'cape';
  label: string;     // e.g. "Red shirt"
  swatch: string;    // hex colour to paint in the UI (for emoji slots use a neutral grey '#3a4a63')
  value: string;     // the value stored in the Outfit for this slot (hex colour or emoji)
}

/** The colour used for emoji buttons in the wardrobe UI. */
const EMOJI_SWATCH = '#3a4a63';

/** A colour the player can wear. */
const skinOptions: WardrobeOption[] = [
  { id: 'skin_lightest', slot: 'skin', label: 'Very light skin', swatch: '#f9ded0', value: '#f9ded0' },
  { id: 'skin_light', slot: 'skin', label: 'Light skin', swatch: '#f6cdb0', value: '#f6cdb0' },
  { id: 'skin_peach', slot: 'skin', label: 'Peach skin', swatch: '#f2c39a', value: '#f2c39a' },
  { id: 'skin_tan', slot: 'skin', label: 'Tan skin', swatch: '#e0a97f', value: '#e0a97f' },
  { id: 'skin_honey', slot: 'skin', label: 'Honey skin', swatch: '#cf9568', value: '#cf9568' },
  { id: 'skin_brown', slot: 'skin', label: 'Brown skin', swatch: '#b87a4d', value: '#b87a4d' },
  { id: 'skin_deep', slot: 'skin', label: 'Deep brown skin', swatch: '#9c5f38', value: '#9c5f38' },
  { id: 'skin_dark', slot: 'skin', label: 'Dark skin', swatch: '#7d4527', value: '#7d4527' },
];

const shirtOptions: WardrobeOption[] = [
  { id: 'shirt_red', slot: 'shirt', label: 'Red shirt', swatch: '#e2504f', value: '#e2504f' },
  { id: 'shirt_orange', slot: 'shirt', label: 'Orange shirt', swatch: '#ef8a3c', value: '#ef8a3c' },
  { id: 'shirt_yellow', slot: 'shirt', label: 'Yellow shirt', swatch: '#f5c93f', value: '#f5c93f' },
  { id: 'shirt_green', slot: 'shirt', label: 'Green shirt', swatch: '#58c266', value: '#58c266' },
  { id: 'shirt_teal', slot: 'shirt', label: 'Teal shirt', swatch: '#5ad1c9', value: '#5ad1c9' },
  { id: 'shirt_blue', slot: 'shirt', label: 'Blue shirt', swatch: '#4a8ce8', value: '#4a8ce8' },
  { id: 'shirt_purple', slot: 'shirt', label: 'Purple shirt', swatch: '#9161d6', value: '#9161d6' },
  { id: 'shirt_pink', slot: 'shirt', label: 'Pink shirt', swatch: '#ef82b5', value: '#ef82b5' },
  { id: 'shirt_white', slot: 'shirt', label: 'White shirt', swatch: '#f0f4fa', value: '#f0f4fa' },
  { id: 'shirt_dark', slot: 'shirt', label: 'Dark shirt', swatch: '#36435a', value: '#36435a' },
];

const pantsOptions: WardrobeOption[] = [
  { id: 'pants_navy', slot: 'pants', label: 'Navy pants', swatch: '#3c4a63', value: '#3c4a63' },
  { id: 'pants_blue', slot: 'pants', label: 'Blue pants', swatch: '#4a6fa5', value: '#4a6fa5' },
  { id: 'pants_denim', slot: 'pants', label: 'Denim pants', swatch: '#7d9ac4', value: '#7d9ac4' },
  { id: 'pants_brown', slot: 'pants', label: 'Brown pants', swatch: '#8a5a3b', value: '#8a5a3b' },
  { id: 'pants_khaki', slot: 'pants', label: 'Khaki pants', swatch: '#c3a869', value: '#c3a869' },
  { id: 'pants_grey', slot: 'pants', label: 'Grey pants', swatch: '#808b99', value: '#808b99' },
  { id: 'pants_green', slot: 'pants', label: 'Green pants', swatch: '#3f7a55', value: '#3f7a55' },
  { id: 'pants_purple', slot: 'pants', label: 'Purple pants', swatch: '#6b4f8a', value: '#6b4f8a' },
  { id: 'pants_red', slot: 'pants', label: 'Red pants', swatch: '#b8493f', value: '#b8493f' },
  { id: 'pants_black', slot: 'pants', label: 'Black pants', swatch: '#2f3542', value: '#2f3542' },
];

const shoesOptions: WardrobeOption[] = [
  { id: 'shoes_black', slot: 'shoes', label: 'Black shoes', swatch: '#2b3038', value: '#2b3038' },
  { id: 'shoes_brown', slot: 'shoes', label: 'Brown shoes', swatch: '#7a4a2b', value: '#7a4a2b' },
  { id: 'shoes_white', slot: 'shoes', label: 'White shoes', swatch: '#f2f5fa', value: '#f2f5fa' },
  { id: 'shoes_red', slot: 'shoes', label: 'Red shoes', swatch: '#d94a45', value: '#d94a45' },
  { id: 'shoes_blue', slot: 'shoes', label: 'Blue shoes', swatch: '#2f6fd0', value: '#2f6fd0' },
  { id: 'shoes_green', slot: 'shoes', label: 'Green shoes', swatch: '#3f9a5c', value: '#3f9a5c' },
  { id: 'shoes_yellow', slot: 'shoes', label: 'Yellow shoes', swatch: '#f0c33c', value: '#f0c33c' },
  { id: 'shoes_orange', slot: 'shoes', label: 'Orange shoes', swatch: '#ef8130', value: '#ef8130' },
  { id: 'shoes_pink', slot: 'shoes', label: 'Pink shoes', swatch: '#ef8fb4', value: '#ef8fb4' },
  { id: 'shoes_grey', slot: 'shoes', label: 'Grey shoes', swatch: '#8a929c', value: '#8a929c' },
];

const hatOptions: WardrobeOption[] = [
  { id: 'hat_none', slot: 'hat', label: 'No hat', swatch: EMOJI_SWATCH, value: '' },
  { id: 'hat_top', slot: 'hat', label: 'Top hat', swatch: EMOJI_SWATCH, value: '🎩' },
  { id: 'hat_cap', slot: 'hat', label: 'Cap', swatch: EMOJI_SWATCH, value: '🧢' },
  { id: 'hat_hard', slot: 'hat', label: 'Hard hat', swatch: EMOJI_SWATCH, value: '⛑️' },
  { id: 'hat_crown', slot: 'hat', label: 'Crown', swatch: EMOJI_SWATCH, value: '👑' },
  { id: 'hat_sun', slot: 'hat', label: 'Sun hat', swatch: EMOJI_SWATCH, value: '👒' },
  { id: 'hat_school', slot: 'hat', label: 'School cap', swatch: EMOJI_SWATCH, value: '🎓' },
  { id: 'hat_shades', slot: 'hat', label: 'Cool shades', swatch: EMOJI_SWATCH, value: '🕶️' },
  { id: 'hat_bow', slot: 'hat', label: 'Big bow', swatch: EMOJI_SWATCH, value: '🎀' },
  { id: 'hat_bear', slot: 'hat', label: 'Bear hood', swatch: EMOJI_SWATCH, value: '🐻' },
  { id: 'hat_lion', slot: 'hat', label: 'Lion hood', swatch: EMOJI_SWATCH, value: '🦁' },
];

const hairOptions: WardrobeOption[] = [
  { id: 'hair_none', slot: 'hair', label: 'No hair', swatch: EMOJI_SWATCH, value: '' },
  { id: 'hair_boy', slot: 'hair', label: 'Boy hair', swatch: EMOJI_SWATCH, value: '👦' },
  { id: 'hair_girl', slot: 'hair', label: 'Girl hair', swatch: EMOJI_SWATCH, value: '👧' },
  { id: 'hair_kid', slot: 'hair', label: 'Kid hair', swatch: EMOJI_SWATCH, value: '🧒' },
  { id: 'hair_wavy', slot: 'hair', label: 'Wavy hair', swatch: EMOJI_SWATCH, value: '👱' },
  { id: 'hair_cool', slot: 'hair', label: 'Cool hair', swatch: EMOJI_SWATCH, value: '💇' },
  { id: 'hair_red', slot: 'hair', label: 'Red hair', swatch: EMOJI_SWATCH, value: '🦰' },
  { id: 'hair_curly', slot: 'hair', label: 'Curly hair', swatch: EMOJI_SWATCH, value: '🦱' },
  { id: 'hair_short', slot: 'hair', label: 'Short hair', swatch: EMOJI_SWATCH, value: '👨' },
  { id: 'hair_long', slot: 'hair', label: 'Long hair', swatch: EMOJI_SWATCH, value: '👩' },
];

const capeOptions: WardrobeOption[] = [
  { id: 'cape_none', slot: 'cape', label: 'No cape', swatch: EMOJI_SWATCH, value: '' },
  { id: 'cape_hero', slot: 'cape', label: 'Hero cape', swatch: EMOJI_SWATCH, value: '🦸' },
  { id: 'cape_coat', slot: 'cape', label: 'Warm coat', swatch: EMOJI_SWATCH, value: '🧥' },
  { id: 'cape_vest', slot: 'cape', label: 'Safety vest', swatch: EMOJI_SWATCH, value: '🦺' },
  { id: 'cape_scarf', slot: 'cape', label: 'Cozy scarf', swatch: EMOJI_SWATCH, value: '🧣' },
  { id: 'cape_robe', slot: 'cape', label: 'Soft robe', swatch: EMOJI_SWATCH, value: '👘' },
  { id: 'cape_rainbow', slot: 'cape', label: 'Rainbow cape', swatch: EMOJI_SWATCH, value: '🌈' },
  { id: 'cape_zap', slot: 'cape', label: 'Zap cape', swatch: EMOJI_SWATCH, value: '⚡' },
  { id: 'cape_fire', slot: 'cape', label: 'Fire cape', swatch: EMOJI_SWATCH, value: '🔥' },
];

/** The look a player starts with. */
export const DEFAULT_OUTFIT: Outfit = {
  skin: '#f2c39a',
  shirt: '#5ad1c9',
  pants: '#3c4a63',
  shoes: '#2b3038',
  hat: '🧢',
  hair: '🧒',
  cape: '🦸',
};

/** All selectable options, grouped by slot (order matters for the UI). */
export const WARDROBE_OPTIONS: WardrobeOption[] = [
  ...skinOptions,
  ...shirtOptions,
  ...pantsOptions,
  ...shoesOptions,
  ...hatOptions,
  ...hairOptions,
  ...capeOptions,
];

/** Options for one slot. */
export function optionsFor(slot: WardrobeOption['slot']): WardrobeOption[] {
  return WARDROBE_OPTIONS.filter((o) => o.slot === slot);
}

/** True when a string is a plain six digit hex colour. */
function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Keep a saved colour when it still looks right, otherwise use the default. */
function safeHex(value: unknown, fallback: string): string {
  return isHex(value) ? value : fallback;
}

/** Keep a saved emoji when it is a real string, otherwise use the default. */
function safeEmoji(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/** Build a complete, valid outfit (fills any missing slot with a default). */
export function normalizeOutfit(o: Partial<Outfit> | null | undefined): Outfit {
  const src = o ?? {};
  return {
    skin: safeHex(src.skin, DEFAULT_OUTFIT.skin),
    shirt: safeHex(src.shirt, DEFAULT_OUTFIT.shirt),
    pants: safeHex(src.pants, DEFAULT_OUTFIT.pants),
    shoes: safeHex(src.shoes, DEFAULT_OUTFIT.shoes),
    hat: safeEmoji(src.hat, DEFAULT_OUTFIT.hat),
    hair: safeEmoji(src.hair, DEFAULT_OUTFIT.hair),
    cape: safeEmoji(src.cape, DEFAULT_OUTFIT.cape),
  };
}

/** Apply one option to an outfit, returning a NEW outfit. */
export function applyOption(o: Outfit, opt: WardrobeOption): Outfit {
  switch (opt.slot) {
    case 'skin':
      return { ...o, skin: opt.value };
    case 'shirt':
      return { ...o, shirt: opt.value };
    case 'pants':
      return { ...o, pants: opt.value };
    case 'shoes':
      return { ...o, shoes: opt.value };
    case 'hat':
      return { ...o, hat: opt.value };
    case 'hair':
      return { ...o, hair: opt.value };
    case 'cape':
      return { ...o, cape: opt.value };
    default:
      return { ...o };
  }
}
