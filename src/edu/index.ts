/** 知识库统一索引与检索 */
import { PHYSICAL_LIFE } from './knowledgePhysical';
import { EARTH_TECH } from './knowledgeEarth';
import { MATH_NODES } from './knowledgeMath';
import { scoreNode, tokenize, type KnowledgeNode, type Domain } from './knowledgeTypes';
import { gradeAllowed } from './grades';

export const ALL_KNOWLEDGE: KnowledgeNode[] = [...PHYSICAL_LIFE, ...EARTH_TECH, ...MATH_NODES];
export const DOMAINS: Domain[] = ['Mathematics', 'Physical Science', 'Life Science', 'Earth & Space', 'Technology & Engineering'];

const byId = new Map(ALL_KNOWLEDGE.map((n) => [n.id, n]));

export function getNode(id: string): KnowledgeNode | undefined {
  return byId.get(id);
}

export function nodesOfDomain(d: Domain): KnowledgeNode[] {
  return ALL_KNOWLEDGE.filter((n) => n.domain === d);
}

/**
 * 按年级检索：只返回读得懂的卡片。
 * 高年级玩家仍能复习低年级内容（grade 是「最低要求」，不是「 exclusive」）。
 *
 * 兜底：知识库目前最低到 Grade 3，低年级玩家过滤后会一条都不剩。
 * 所以池子空的时候退回全库——宁可讲得难一点，也好过 NPC 一句话都说不出来。
 */
export function searchKnowledge(
  query: string,
  limit = 3,
  playerGrade?: number,
): { node: KnowledgeNode; score: number }[] {
  const tokens = tokenize(query);
  const filtered = playerGrade === undefined ? [] : ALL_KNOWLEDGE.filter((n) => gradeAllowed(n.grade, playerGrade));
  const pool = filtered.length ? filtered : ALL_KNOWLEDGE;
  const scored = pool.map((node) => ({ node, score: scoreNode(node, tokens) })).filter((s) => s.score > 0.6).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** 按 id 列表取知识点（可按年级过滤；空则退回全库） */
export function nodesByIds(ids: string[], playerGrade?: number): KnowledgeNode[] {
  const all = ids.map((i) => byId.get(i)).filter(Boolean) as KnowledgeNode[];
  if (playerGrade === undefined) return all;
  const ok = all.filter((n) => gradeAllowed(n.grade, playerGrade));
  return ok.length ? ok : all;
}

export type { KnowledgeNode, Domain };
export { tokenize };
