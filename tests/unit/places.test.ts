import { describe, expect, test } from 'vitest';
import { buildTree, makePathOf, isDescendant, canDeletePlace, nextOrder, validateSeed, mergeSeed } from '../../src/lib/places';
import type { Place } from '../../src/lib/types';

const place = (id: string, name: string, parentId: string | null, order = 0): Place => ({
  id, name, parentId, kind: 'room', order, updatedAt: 0,
});
const places: Place[] = [
  place('living', '거실', null, 0),
  place('bed', '안방', null, 1),
  place('tv', 'TV장', 'living', 0),
  place('drawerL', '왼쪽 서랍', 'tv', 0),
  place('drawerR', '오른쪽 서랍', 'tv', 1),
];

describe('buildTree / makePathOf', () => {
  test('nests children sorted by order then name', () => {
    const tree = buildTree(places);
    expect(tree.map((n) => n.name)).toEqual(['거실', '안방']);
    expect(tree[0].children[0].children.map((n) => n.name)).toEqual(['왼쪽 서랍', '오른쪽 서랍']);
  });
  test('path joins ancestors; unknown or null yields empty', () => {
    const pathOf = makePathOf(places);
    expect(pathOf('drawerL')).toBe('거실 > TV장 > 왼쪽 서랍');
    expect(pathOf(null)).toBe('');
    expect(pathOf('nope')).toBe('');
  });
  test('path survives a parent cycle without hanging', () => {
    const cyclic = [place('a', 'A', 'b'), place('b', 'B', 'a')];
    expect(makePathOf(cyclic)('a').length).toBeGreaterThan(0);
  });
});

describe('isDescendant / canDeletePlace / nextOrder', () => {
  test('descendant detection', () => {
    expect(isDescendant(places, 'living', 'drawerL')).toBe(true);
    expect(isDescendant(places, 'bed', 'drawerL')).toBe(false);
    expect(isDescendant(places, 'tv', 'tv')).toBe(false);
  });
  test('cannot delete with children or items', () => {
    expect(canDeletePlace('tv', places, [])).toBe(false);
    expect(canDeletePlace('drawerR', places, [{ placeId: 'drawerR' }])).toBe(false);
    expect(canDeletePlace('drawerR', places, [{ placeId: 'drawerL' }])).toBe(true);
  });
  test('nextOrder is max sibling order + 1, or 0', () => {
    expect(nextOrder(places, 'tv')).toBe(2);
    expect(nextOrder(places, 'bed')).toBe(0);
  });
});

describe('validateSeed', () => {
  test('accepts nested nodes and rejects bad input with path in message', () => {
    expect(validateSeed([{ name: '거실', kind: 'room', children: [{ name: 'TV장', kind: 'furniture' }] }])).toHaveLength(1);
    expect(() => validateSeed([{ name: '거실', kind: 'house' }])).toThrow(/\[0\].kind/);
    expect(() => validateSeed({})).toThrow(/array/);
    expect(() => validateSeed([{ name: '', kind: 'room' }])).toThrow(/\[0\].name/);
  });
});

describe('mergeSeed', () => {
  test('creates only missing nodes and links parents to existing ids', () => {
    let n = 0;
    const genId = () => `new${++n}`;
    const seed = validateSeed([
      { name: '거실', kind: 'room', children: [
        { name: 'TV장', kind: 'furniture', children: [{ name: '가운데 서랍', kind: 'section' }] },
        { name: '소파', kind: 'furniture' },
      ] },
      { name: '주방', kind: 'room' },
    ]);
    const created = mergeSeed(places, seed, genId, 123);
    expect(created.map((p) => [p.name, p.parentId])).toEqual([
      ['가운데 서랍', 'tv'], ['소파', 'living'], ['주방', null],
    ]);
    expect(created.find((p) => p.name === '가운데 서랍')!.order).toBe(2);
    expect(created.every((p) => p.updatedAt === 123)).toBe(true);
  });
  test('new parent ids are used by their children', () => {
    let n = 0;
    const created = mergeSeed([], validateSeed([{ name: '주방', kind: 'room', children: [{ name: '냉장고', kind: 'furniture' }] }]), () => `id${++n}`, 0);
    expect(created[1].parentId).toBe(created[0].id);
  });
});
