/** Knowledge type definitions + index helpers (four domains of elementary science) */

export type Domain = 'Physical Science' | 'Life Science' | 'Earth & Space' | 'Technology & Engineering';

export interface KnowledgeNode {
  id: string;
  domain: Domain;
  topic: string;
  keywords: string[];
  /** Core explanation: 2-3 sentences a primary pupil can understand */
  explain: string;
  /** An everyday example */
  example: string;
  /** A Socrates-style follow-up question to keep thinking going */
  ask: string;
  /** Common misconception to correct (optional) */
  myth?: string;
  /** Suitable grade 1-6 */
  grade: number;
  /** Linked 3D demo id (optional) */
  demo?: string;
}

export function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  // English: split into lowercased words. CJK: fall back to single chars + bigrams.
  const clean = s.toLowerCase();
  const words = clean.match(/[a-z0-9]+/g) ?? [];
  for (const w of words) {
    out.add(w);
    if (w.length > 4) {
      out.add(w.slice(0, 4)); // crude stem
      out.add(w.slice(0, 5));
    }
  }
  const cjk = clean.match(/[一-鿿]/g) ?? [];
  for (const ch of cjk) out.add(ch);
  for (let i = 0; i + 1 < cjk.length; i++) out.add(cjk[i] + cjk[i + 1]);
  return out;
}

/** Simple relevance scoring: keyword hits + token overlap */
export function scoreNode(node: KnowledgeNode, queryTokens: Set<string>): number {
  let score = 0;
  for (const k of node.keywords) {
    const kl = k.toLowerCase();
    if (queryTokens.has(kl)) score += 6;
    else if (kl.includes(' ')) {
      // multi-word keyword: partial credit for any contained word
      for (const w of kl.split(/\s+/)) if (queryTokens.has(w)) score += 2;
    } else {
      for (const t of tokenize(k)) if (queryTokens.has(t)) score += 1.2;
    }
  }
  const topicTokens = tokenize(node.topic);
  for (const t of topicTokens) if (queryTokens.has(t)) score += 2.5;
  for (const t of tokenize(node.explain)) if (queryTokens.has(t)) score += 0.12;
  return score;
}
