import { isChosungQuery, normalize, toChosung } from './hangul';
import type { Item } from './types';

export interface SearchHit {
  item: Item;
  path: string;
  score: number;
}

export const RECENT_LIMIT = 20;

const RANK = { exact: 4, prefix: 3, includes: 2, chosung: 1 } as const;
const FIELD_WEIGHT = 10;

function fieldScore(field: string, q: string, qIsChosung: boolean): number {
  const n = normalize(field);
  if (!n) return 0;
  if (n === q) return RANK.exact;
  if (n.startsWith(q)) return RANK.prefix;
  if (n.includes(q)) return RANK.includes;
  if (qIsChosung && toChosung(n).includes(q)) return RANK.chosung;
  return 0;
}

export function searchItems(
  items: Item[],
  pathOf: (placeId: string | null) => string,
  query: string,
  limit = 50,
): SearchHit[] {
  const q = normalize(query);
  if (!q) {
    return [...items]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, RECENT_LIMIT)
      .map((item) => ({ item, path: pathOf(item.placeId), score: 0 }));
  }
  const qIsChosung = isChosungQuery(q);
  const hits: SearchHit[] = [];
  for (const item of items) {
    const path = pathOf(item.placeId);
    const fields = [item.name, ...item.aliases];
    const fieldBest = Math.max(0, ...fields.map((f) => fieldScore(f, q, qIsChosung)));
    const score = Math.max(fieldBest * FIELD_WEIGHT, fieldScore(path, q, qIsChosung));
    if (score > 0) hits.push({ item, path, score });
  }
  return hits
    .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
    .slice(0, limit);
}
