import { describe, expect, test } from 'vitest';
import { searchItems, RECENT_LIMIT } from '../../src/lib/search';
import type { Item } from '../../src/lib/types';

const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({
  id, name, aliases: [], placeId: null, qty: 1, note: '', updatedAt: 0, ...extra,
});
const paths: Record<string, string> = { p1: '거실 > TV장 > 왼쪽 서랍', p2: '안방 > 옷장' };
const pathOf = (id: string | null) => (id ? paths[id] ?? '' : '');

const items = [
  item('a', '충전기', { placeId: 'p1', updatedAt: 1 }),
  item('b', 'USB 케이블', { aliases: ['c타입 선'], placeId: 'p1', updatedAt: 2 }),
  item('c', '여권', { aliases: ['passport', '서류'], placeId: 'p2', updatedAt: 3 }),
  item('d', '충전 어댑터', { placeId: 'p2', updatedAt: 4 }),
];

describe('searchItems', () => {
  test('empty query returns most recent first, capped at RECENT_LIMIT', () => {
    const many = Array.from({ length: 30 }, (_, i) => item(`i${i}`, `물건${i}`, { updatedAt: i }));
    const hits = searchItems(many, pathOf, '');
    expect(hits).toHaveLength(RECENT_LIMIT);
    expect(hits[0].item.id).toBe('i29');
  });

  test('exact beats prefix; equal rank falls back to recency', () => {
    expect(searchItems(items, pathOf, '충전기').map((h) => h.item.id)).toEqual(['a']);
    expect(searchItems(items, pathOf, '충전').map((h) => h.item.id)).toEqual(['d', 'a']);
  });

  test('matches aliases', () => {
    expect(searchItems(items, pathOf, 'c타입').map((h) => h.item.id)).toEqual(['b']);
    expect(searchItems(items, pathOf, '서류').map((h) => h.item.id)).toEqual(['c']);
  });

  test('chosung query matches', () => {
    expect(searchItems(items, pathOf, 'ㅊㅈㄱ').map((h) => h.item.id)).toEqual(['a']);
  });

  test('path match ranks below name match and carries path', () => {
    const hits = searchItems(items, pathOf, '옷장');
    expect(hits.map((h) => h.item.id).sort()).toEqual(['c', 'd']);
    expect(hits[0].path).toBe('안방 > 옷장');
    const mixed = searchItems([...items, item('e', '옷장 열쇠', { updatedAt: 0 })], pathOf, '옷장');
    expect(mixed[0].item.id).toBe('e');
  });

  test('path search ignores the " > " separators', () => {
    expect(searchItems(items, pathOf, 'tv장 왼쪽').map((h) => h.item.id)).toEqual(['b', 'a']);
  });
  test('ignores whitespace and case', () => {
    expect(searchItems(items, pathOf, 'usb케이블').map((h) => h.item.id)).toEqual(['b']);
  });
});
