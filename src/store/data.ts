import { deleteDoc, doc, onSnapshot, setDoc, updateDoc, writeBatch, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { itemsCol, placesCol } from '../refs';
import { normalizeItem, normalizePlace } from '../lib/normalize';
import type { Item, Place } from '../lib/types';

// 쓰기 함수들은 Promise를 돌려주지만 화면은 await하지 않는다. Firestore 쓰기는 서버 확인까지
// resolve되지 않아 오프라인이면 무한 대기하고, 로컬 캐시에는 즉시 반영되기 때문.
// updatedAt을 serverTimestamp가 아닌 숫자로 쓰는 이유: 오프라인 스냅샷에서 null이 되어 정렬이 깨진다.
export type ItemInput = Omit<Item, 'id' | 'updatedAt'>;
const BATCH_LIMIT = 500;
type OnError = (e: Error) => void;

export function subscribePlaces(db: Firestore, code: string, cb: (p: Place[]) => void, onError?: OnError): Unsubscribe {
  return onSnapshot(placesCol(db, code), (snap) => cb(snap.docs.map((d) => normalizePlace(d.id, d.data() as Record<string, unknown>))), onError);
}

export function subscribeItems(db: Firestore, code: string, cb: (i: Item[]) => void, onError?: OnError): Unsubscribe {
  return onSnapshot(itemsCol(db, code), (snap) => cb(snap.docs.map((d) => normalizeItem(d.id, d.data() as Record<string, unknown>))), onError);
}

export function saveItem(db: Firestore, code: string, input: ItemInput, id?: string): Promise<string> {
  const ref = id ? doc(itemsCol(db, code), id) : doc(itemsCol(db, code));
  const { name, aliases, placeId, qty, note } = input;
  return setDoc(ref, { name, aliases, placeId, qty, note, updatedAt: Date.now() }).then(() => ref.id);
}

// '위치 이동'은 placeId만 갱신한다. 폼 전체를 setDoc하면 편집 중이던 미저장 값과 다른 기기의 변경을 덮는다.
export function moveItem(db: Firestore, code: string, id: string, placeId: string | null): Promise<void> {
  return updateDoc(doc(itemsCol(db, code), id), { placeId, updatedAt: Date.now() });
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

async function batchSet(db: Firestore, refs: { id: string; data: Record<string, unknown> }[], col: ReturnType<typeof placesCol>): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const { id, data } of refs.slice(i, i + BATCH_LIMIT)) batch.set(doc(col, id), data);
    await batch.commit();
  }
}

export function createPlaces(db: Firestore, code: string, places: Place[]): Promise<void> {
  return batchSet(db, places.map(({ id, ...rest }) => ({ id, data: rest })), placesCol(db, code));
}

// 백업 복원용: id를 보존해 set하므로 같은 파일을 두 번 넣어도 중복이 생기지 않는다.
export function createItems(db: Firestore, code: string, items: Item[]): Promise<void> {
  return batchSet(db, items.map(({ id, ...rest }) => ({ id, data: rest })), itemsCol(db, code));
}
