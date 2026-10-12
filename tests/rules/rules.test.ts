import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, type Firestore } from 'firebase/firestore';

const HID = 'a'.repeat(26);
const OTHER = 'b'.repeat(26);
let env: RulesTestEnvironment;

const fs = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore;
const anon = () => fs(env.authenticatedContext('anon-uid', { firebase: { sign_in_provider: 'anonymous' } }));
const nobody = () => fs(env.unauthenticatedContext());
const net = (addr: string) => ({ addr, kind: 'v4', label: '집', addedAt: 1 });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-home-inventory',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(fs(ctx), `households/${HID}`), { name: '집', allowedNetworks: [], createdAt: 1 });
    await setDoc(doc(fs(ctx), `households/${HID}/items/i1`), { name: '충전기' });
  });
});

describe('households/{hid}', () => {
  test('unauthenticated cannot get', () => assertFails(getDoc(doc(nobody(), `households/${HID}`))));
  test('authenticated can get', () => assertSucceeds(getDoc(doc(anon(), `households/${HID}`))));
  test('authenticated cannot list', () => assertFails(getDocs(collection(anon(), 'households'))));
  test('authenticated cannot create or delete', async () => {
    await assertFails(setDoc(doc(anon(), `households/${OTHER}`), { name: 'x', allowedNetworks: [], createdAt: 1 }));
    await assertFails(deleteDoc(doc(anon(), `households/${HID}`)));
  });
  test('update limited to allowedNetworks and name, max 5', async () => {
    const ref = doc(anon(), `households/${HID}`);
    await assertSucceeds(updateDoc(ref, { allowedNetworks: [net('1.1.1.1')] }));
    await assertSucceeds(updateDoc(ref, { name: '우리집' }));
    await assertFails(updateDoc(ref, { createdAt: 2 }));
    await assertFails(updateDoc(ref, { allowedNetworks: 'nope' }));
    await assertFails(updateDoc(ref, { allowedNetworks: ['1', '2', '3', '4', '5', '6'].map(net) }));
  });
  test('name must be a short string', async () => {
    const ref = doc(anon(), `households/${HID}`);
    await assertFails(updateDoc(ref, { name: 42 }));
    await assertFails(updateDoc(ref, { name: 'x'.repeat(51) }));
    await assertSucceeds(updateDoc(ref, { name: 'x'.repeat(50) }));
  });
});

describe('subcollections', () => {
  test('authenticated can read and write items/places of an existing household', async () => {
    await assertSucceeds(getDoc(doc(anon(), `households/${HID}/items/i1`)));
    await assertSucceeds(setDoc(doc(anon(), `households/${HID}/places/p1`), { name: '거실', parentId: null, kind: 'room', order: 0, updatedAt: 1 }));
    await assertSucceeds(getDocs(collection(anon(), `households/${HID}/items`)));
  });
  test('unauthenticated cannot read items', () => assertFails(getDoc(doc(nobody(), `households/${HID}/items/i1`))));
  test('writes under a non-existent household are denied', async () => {
    await assertFails(setDoc(doc(anon(), `households/${OTHER}/items/x`), { name: 'junk' }));
    await assertFails(getDocs(collection(anon(), `households/${OTHER}/items`)));
  });
  test('other top-level collections are closed', () => assertFails(setDoc(doc(anon(), 'junk/x'), { a: 1 })));
  test('collection group query across households is denied', () => assertFails(getDocs(collectionGroup(anon(), 'items'))));
});
