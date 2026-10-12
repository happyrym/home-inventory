import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { addNetworks, removeNetwork, subscribeHousehold, MAX_NETWORKS } from '../../src/store/household';
import { saveItem, deleteItem, createPlace, updatePlace, deletePlace, createPlaces, subscribeItems, subscribePlaces, newPlaceId } from '../../src/store/data';
import { toNetwork } from '../../src/lib/ip';
import type { Household, Item, Place } from '../../src/lib/types';

const HID = 'a'.repeat(26);
let env: RulesTestEnvironment;
let db: Firestore;

const fs = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const onceHousehold = (code: string, pick: (h: Household | null) => boolean = () => true) =>
  new Promise<Household | null>((resolve, reject) => {
    const un = subscribeHousehold(db, code, (h) => { if (pick(h)) { un(); resolve(h); } }, reject);
  });
const once = <T>(subscribe: (cb: (v: T) => void) => () => void, pick: (v: T) => boolean = () => true) =>
  new Promise<T>((resolve) => { const un = subscribe((v) => { if (pick(v)) { un(); resolve(v); } }); });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-home-inventory', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(fs(ctx), `households/${HID}`), { name: '집', allowedNetworks: [], createdAt: 1 });
  });
  db = fs(env.authenticatedContext('u1'));
});

describe('household store', () => {
  test('subscribe yields doc, null for missing', async () => {
    expect((await onceHousehold(HID))?.name).toBe('집');
    expect(await onceHousehold('b'.repeat(26))).toBeNull();
  });
  test('addNetworks dedupes by addr and caps at MAX_NETWORKS dropping oldest', async () => {
    await addNetworks(db, HID, [toNetwork('1.1.1.1', 'a', 1)]);
    await addNetworks(db, HID, [toNetwork('1.1.1.1', 'a-again', 2), toNetwork('2.2.2.2', 'b', 3)]);
    let h = await onceHousehold(HID);
    expect(h!.allowedNetworks!.map((n) => n.addr)).toEqual(['1.1.1.1', '2.2.2.2']);
    for (let i = 3; i <= 7; i++) await addNetworks(db, HID, [toNetwork(`${i}.${i}.${i}.${i}`, 'x', i)]);
    h = await onceHousehold(HID, (v) => v!.allowedNetworks!.length === MAX_NETWORKS);
    expect(h!.allowedNetworks!.map((n) => n.addr)).toEqual(['3.3.3.3', '4.4.4.4', '5.5.5.5', '6.6.6.6', '7.7.7.7']);
  });
  test('removeNetwork', async () => {
    await addNetworks(db, HID, [toNetwork('1.1.1.1', 'a', 1), toNetwork('2.2.2.2', 'b', 2)]);
    await removeNetwork(db, HID, '1.1.1.1');
    const h = await onceHousehold(HID, (v) => v!.allowedNetworks!.length === 1);
    expect(h!.allowedNetworks![0].addr).toBe('2.2.2.2');
  });
});

describe('data store', () => {
  test('item save/update/delete round trip', async () => {
    const id = await saveItem(db, HID, { name: '충전기', aliases: [], placeId: null, qty: 1, note: '' });
    let items = await once<Item[]>((cb) => subscribeItems(db, HID, cb), (v) => v.length === 1);
    expect(items[0]).toMatchObject({ id, name: '충전기' });
    expect(items[0].updatedAt).toBeGreaterThan(0);
    await saveItem(db, HID, { ...items[0], name: '충전기2' }, id);
    items = await once<Item[]>((cb) => subscribeItems(db, HID, cb), (v) => v[0]?.name === '충전기2');
    expect(items[0].id).toBe(id);
    await deleteItem(db, HID, id);
    items = await once<Item[]>((cb) => subscribeItems(db, HID, cb), (v) => v.length === 0);
    expect(items).toEqual([]);
  });
  test('place create/update/delete and batch create', async () => {
    const id = await createPlace(db, HID, { name: '거실', parentId: null, kind: 'room', order: 0 });
    await updatePlace(db, HID, id, { name: '큰방' });
    let places = await once<Place[]>((cb) => subscribePlaces(db, HID, cb), (v) => v[0]?.name === '큰방');
    expect(places[0].id).toBe(id);
    const batch: Place[] = Array.from({ length: 3 }, (_, i) => ({ id: newPlaceId(db, HID), name: `방${i}`, parentId: id, kind: 'room', order: i, updatedAt: 1 }));
    await createPlaces(db, HID, batch);
    places = await once<Place[]>((cb) => subscribePlaces(db, HID, cb), (v) => v.length === 4);
    expect(places.filter((p) => p.parentId === id)).toHaveLength(3);
    await deletePlace(db, HID, batch[0].id);
    places = await once<Place[]>((cb) => subscribePlaces(db, HID, cb), (v) => v.length === 3);
    expect(places.find((p) => p.id === batch[0].id)).toBeUndefined();
  });
});
