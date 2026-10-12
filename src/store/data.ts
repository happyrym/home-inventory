import { deleteDoc, doc, onSnapshot, setDoc, updateDoc, writeBatch, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { itemsCol, placesCol } from '../refs';
import type { Item, Place } from '../lib/types';

export type ItemInput = Omit<Item, 'id' | 'updatedAt'>;
const BATCH_LIMIT = 500;

export function subscribePlaces(db: Firestore, code: string, cb: (p: Place[]) => void): Unsubscribe {
  return onSnapshot(placesCol(db, code), (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Place, 'id'>), id: d.id }))));
}

export function subscribeItems(db: Firestore, code: string, cb: (i: Item[]) => void): Unsubscribe {
  return onSnapshot(itemsCol(db, code), (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Item, 'id'>), id: d.id }))));
}

export function saveItem(db: Firestore, code: string, input: ItemInput, id?: string): Promise<string> {
  const ref = id ? doc(itemsCol(db, code), id) : doc(itemsCol(db, code));
  const { name, aliases, placeId, qty, note } = input;
  return setDoc(ref, { name, aliases, placeId, qty, note, updatedAt: Date.now() }).then(() => ref.id);
}

export function deleteItem(db: Firestore, code: string, id: string): Promise<void> {
  return deleteDoc(doc(itemsCol(db, code), id));
}

export function newPlaceId(db: Firestore, code: string): string {
  return doc(placesCol(db, code)).id;
}

export function createPlace(db: Firestore, code: string, input: Omit<Place, 'id' | 'updatedAt'>): Promise<string> {
  const ref = doc(placesCol(db, code));
  return setDoc(ref, { ...input, updatedAt: Date.now() }).then(() => ref.id);
}

export function updatePlace(db: Firestore, code: string, id: string, patch: Partial<Omit<Place, 'id' | 'updatedAt'>>): Promise<void> {
  return updateDoc(doc(placesCol(db, code), id), { ...patch, updatedAt: Date.now() });
}

export function deletePlace(db: Firestore, code: string, id: string): Promise<void> {
  return deleteDoc(doc(placesCol(db, code), id));
}

export async function createPlaces(db: Firestore, code: string, places: Place[]): Promise<void> {
  for (let i = 0; i < places.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const { id, ...rest } of places.slice(i, i + BATCH_LIMIT)) batch.set(doc(placesCol(db, code), id), rest);
    await batch.commit();
  }
}
