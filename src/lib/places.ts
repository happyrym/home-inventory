import type { Place, PlaceKind, SeedNode } from './types';

export interface PlaceNode extends Place {
  children: PlaceNode[];
}

const KINDS: PlaceKind[] = ['room', 'furniture', 'section', 'container'];
const MAX_DEPTH = 32;

function byOrder(a: Place, b: Place): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'ko');
}

export function buildTree(places: Place[]): PlaceNode[] {
  const nodes = new Map<string, PlaceNode>(places.map((p) => [p.id, { ...p, children: [] }]));
  const roots: PlaceNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortDeep = (list: PlaceNode[]) => {
    list.sort(byOrder);
    list.forEach((n) => sortDeep(n.children));
  };
  sortDeep(roots);
  return roots;
}

export function makePathOf(places: Place[]): (placeId: string | null) => string {
  const byId = new Map(places.map((p) => [p.id, p]));
  return (placeId) => {
    const parts: string[] = [];
    let cur = placeId ? byId.get(placeId) : undefined;
    let depth = 0;
    while (cur && depth++ < MAX_DEPTH) {
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(' > ');
  };
}

export function isDescendant(places: Place[], ancestorId: string, placeId: string): boolean {
  const byId = new Map(places.map((p) => [p.id, p]));
  let cur = byId.get(placeId);
  let depth = 0;
  while (cur && cur.parentId && depth++ < MAX_DEPTH) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

export function canDeletePlace(placeId: string, places: Place[], items: { placeId: string | null }[]): boolean {
  return !places.some((p) => p.parentId === placeId) && !items.some((i) => i.placeId === placeId);
}

export function nextOrder(places: Place[], parentId: string | null): number {
  const siblings = places.filter((p) => p.parentId === parentId);
  return siblings.length ? Math.max(...siblings.map((p) => p.order)) + 1 : 0;
}

export function validateSeed(input: unknown, path = ''): SeedNode[] {
  if (!Array.isArray(input)) throw new Error(`${path || 'seed'} must be an array`);
  return input.map((raw, i) => {
    const at = `${path}[${i}]`;
    if (typeof raw !== 'object' || raw === null) throw new Error(`${at} must be an object`);
    const { name, kind, children } = raw as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) throw new Error(`${at}.name must be a non-empty string`);
    if (!KINDS.includes(kind as PlaceKind)) throw new Error(`${at}.kind must be one of ${KINDS.join('|')}`);
    const node: SeedNode = { name: name.trim(), kind: kind as PlaceKind };
    if (children !== undefined) node.children = validateSeed(children, `${at}.children`);
    return node;
  });
}

export function mergeSeed(existing: Place[], seed: SeedNode[], genId: () => string, now: number): Place[] {
  const all = [...existing];
  const created: Place[] = [];
  const walk = (nodes: SeedNode[], parentId: string | null) => {
    for (const node of nodes) {
      let place = all.find((p) => p.parentId === parentId && p.name === node.name);
      if (!place) {
        place = { id: genId(), name: node.name, parentId, kind: node.kind, order: nextOrder(all, parentId), updatedAt: now };
        all.push(place);
        created.push(place);
      }
      if (node.children) walk(node.children, place.id);
    }
  };
  walk(seed, null);
  return created;
}
