import { describe, expect, test } from 'vitest';
import { normalizeHousehold, normalizeItem, normalizeNetworks, normalizePlace } from '../../src/lib/normalize';

describe('normalize', () => {
  test('item fills missing/invalid fields instead of throwing', () => {
    expect(normalizeItem('a', {})).toEqual({ id: 'a', name: '', aliases: [], placeId: null, qty: 1, note: '', updatedAt: 0 });
    expect(normalizeItem('a', { name: 3, aliases: ['x', 2, null], placeId: 7, qty: -2.5, note: null, updatedAt: '9' }))
      .toEqual({ id: 'a', name: '', aliases: ['x'], placeId: null, qty: 0, note: '', updatedAt: 0 });
  });
  test('place falls back kind/order', () => {
    expect(normalizePlace('p', { name: '거실', kind: 'house', order: 'x', parentId: null })).toEqual({ id: 'p', name: '거실', parentId: null, kind: 'room', order: 0, updatedAt: 0 });
  });
  test('networks drops malformed entries', () => {
    expect(normalizeNetworks([null, { addr: 1 }, { addr: '1.1.1.1', kind: 'v4', label: 'a', addedAt: 1 }, { addr: 'x', kind: 'v9' }, 'str'])).toEqual([{ addr: '1.1.1.1', kind: 'v4', label: 'a', addedAt: 1 }]);
    expect(normalizeNetworks(undefined)).toEqual([]);
  });
  test('household', () => {
    expect(normalizeHousehold({ name: '집' })).toEqual({ name: '집', allowedNetworks: [], createdAt: 0 });
  });
});
