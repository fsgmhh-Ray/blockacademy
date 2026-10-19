/** 知识库统一索引与检索 */
import { PHYSICAL_LIFE } from './knowledgePhysical';
import { EARTH_TECH } from './knowledgeEarth';
import { scoreNode, tokenize, type KnowledgeNode, type Domain } from './knowledgeTypes';

export const ALL_KNOWLEDGE: KnowledgeNode[] = [...PHYSICAL_LIFE, ...EARTH_TECH];
export const DOMAINS: Domain[] = ['Physical Science', 'Life Science', 'Earth & Space', 'Technology & Engineering'];

const byId = new Map(ALL_KNOWLEDGE.map((n) => [n.id, n]));

export function getNode(id: string): KnowledgeNode | undefined {
  return byId.get(id);
}

export function nodesOfDomain(d: Domain): KnowledgeNode[] {
  return ALL_KNOWLEDGE.filter((n) => n.domain === d);
}

export function searchKnowledge(query: string, limit = 3): { node: KnowledgeNode; score: number }[] {
  const tokens = tokenize(query);
  const scored = ALL_KNOWLEDGE.map((node) => ({ node, score: scoreNode(node, tokens) }))
    .filter((s) => s.score > 0.6)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** 按 id 列表取知识点 */
export function nodesByIds(ids: string[]): KnowledgeNode[] {
  return ids.map((i) => byId.get(i)).filter(Boolean) as KnowledgeNode[];
}

export type { KnowledgeNode, Domain };
export { tokenize };
