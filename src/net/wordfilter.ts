/**
 * Parent word filter for chat.
 *
 * Rule (from Grayson's dad): if a message contains a blocked word, the WHOLE
 * message is replaced with ### so nothing inappropriate is ever shown.
 * Client-side only — good enough for a family game, not a security boundary.
 */

/** lowercase blocked tokens (whole-word matching after normalization) */
const BLOCKED = [
  // profanity
  'fuck', 'fucking', 'fucker', 'shit', 'shitty', 'bitch', 'bastard', 'asshole',
  'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut', 'prick', 'wanker', 'bollocks',
  'damn', 'dammit', 'crap', 'piss',
  // slurs / hate
  'nigger', 'nigga', 'faggot', 'fag', 'dyke', 'tranny', 'retard', 'spastic',
  'kike', 'chink', 'gook', 'wetback', 'coon', 'paki', 'beaner', 'cracker',
  // sexual / adult
  'sex', 'sexy', 'nude', 'naked', 'porn', 'porno', 'penis', 'vagina', 'boob',
  'boobs', 'tits', 'horny', 'orgasm', 'masturbate', 'dildo', 'rape',
  // violence / self-harm
  'kill yourself', 'kys', 'suicide', 'murder', 'gun', 'guns', 'weapon', 'weapons',
  // drugs / other
  'drugs', 'cocaine', 'heroin', 'weed', 'alcohol', 'beer', 'drunk',
];

/** leet / symbol substitutions so "f0ne" style bypasses don't work */
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't',
  '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '+': 't', '|': 'i',
};

function normalize(raw: string): string {
  let s = raw.toLowerCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip diacritics
  s = s.replace(/[0-9@$!+|]/g, (c) => LEET[c] ?? c);
  s = s.replace(/[^a-z\s]/g, ' '); // keep letters + spaces only
  return s;
}

/** collapse 3+ repeated chars to 1: "stuupid" -> "stupid" */
function collapse(s: string): string {
  return s.replace(/(.)\1{2,}/g, '$1');
}

/** padded, collapsed, normalized text with single spaces */
function canonical(raw: string): string {
  return ` ${collapse(normalize(raw)).replace(/\s+/g, ' ').trim()} `;
}

/** Returns true if the text contains a blocked word. */
export function isClean(text: string): boolean {
  return !hasBlocked(text);
}

/** Internal: whole-token (or whole-phrase) match against the blocked list. */
function hasBlocked(raw: string): boolean {
  const s = canonical(raw);
  for (const bad of BLOCKED) {
    if (!bad.includes(' ')) {
      // token match: the padded string contains " bad "
      if (s.includes(` ${bad} `)) return true;
    } else if (s.includes(` ${bad} `)) {
      return true;
    }
  }
  // also catch a blocked token with letters glued on both sides, e.g. "xfuckx"
  const tokens = s.trim().split(' ');
  for (const t of tokens) {
    for (const bad of BLOCKED) {
      if (bad.includes(' ')) continue;
      if (t.length > bad.length + 2 && (t.startsWith(bad) || t.endsWith(bad))) return true;
    }
  }
  return false;
}

/**
 * Scrubs a chat message: the whole message becomes ### when it contains a
 * blocked word, otherwise the text is returned unchanged.
 */
export function scrub(text: string): string {
  return hasBlocked(text) ? '###' : text;
}

/** Short English reason for parents / the sender, or null when clean. */
export function blockedReason(text: string): string | null {
  return hasBlocked(text) ? 'message blocked by the parent word filter' : null;
}
