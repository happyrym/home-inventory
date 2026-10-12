import type { AllowedNetwork, Household, Item, Place, PlaceKind } from './types';

const KINDS: PlaceKind[] = ['room', 'furniture', 'section', 'container'];
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// Firestore 문서는 규칙이 스키마를 검사하지 않으므로(콘솔·구버전 클라이언트가 어떤 형태든 쓸 수 있다)
// 읽는 쪽에서 필드를 보정한다. 문서 하나가 깨졌다고 검색·트리 렌더 전체가 throw하지 않게 하기 위함.
export function normalizeItem(id: string, d: Record<string, unknown>): Item {
  return {
    id,
    name: str(d.name),
    aliases: Array.isArray(d.aliases) ? d.aliases.filter((a): a is string => typeof a === 'string') : [],
    placeId: typeof d.placeId === 'string' ? d.placeId : null,
    qty: Math.max(0, Math.floor(num(d.qty, 1))),
    note: str(d.note),
    updatedAt: num(d.updatedAt, 0),
  };
}

export function normalizePlace(id: string, d: Record<string, unknown>): Place {
  return {
    id,
    name: str(d.name),
    parentId: typeof d.parentId === 'string' ? d.parentId : null,
    kind: KINDS.includes(d.kind as PlaceKind) ? (d.kind as PlaceKind) : 'room',
    order: num(d.order, 0),
    updatedAt: num(d.updatedAt, 0),
  };
}

export function normalizeNetworks(list: unknown): AllowedNetwork[] {
  if (!Array.isArray(list)) return [];
  return list.filter((n): n is AllowedNetwork =>
    !!n && typeof n === 'object'
    && typeof (n as AllowedNetwork).addr === 'string'
    && ((n as AllowedNetwork).kind === 'v4' || (n as AllowedNetwork).kind === 'v6-64'));
}

export function normalizeHousehold(d: Record<string, unknown>): Household {
  return { name: str(d.name), allowedNetworks: normalizeNetworks(d.allowedNetworks), createdAt: num(d.createdAt, 0) };
}
