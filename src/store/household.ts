import { onSnapshot, runTransaction, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { householdRef } from '../refs';
import type { AllowedNetwork, Household } from '../lib/types';

export const MAX_NETWORKS = 5;

export function subscribeHousehold(
  db: Firestore, code: string, cb: (h: Household | null) => void, onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(householdRef(db, code), (snap) => cb(snap.exists() ? (snap.data() as Household) : null), onError);
}

// 트랜잭션으로 머지하는 이유: 두 폰이 동시에 등록하면 마지막 쓰기가 상대 것을 덮는다.
// slice(-MAX_NETWORKS)는 규칙의 size() <= 5와 맞춰야 한다.
export async function addNetworks(db: Firestore, code: string, nets: AllowedNetwork[]): Promise<void> {
  const ref = householdRef(db, code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('household-missing');
    const current = (snap.data() as Household).allowedNetworks ?? [];
    const incoming = new Set(nets.map((n) => n.addr));
    const merged = [...current.filter((n) => !incoming.has(n.addr)), ...nets]
      .sort((a, b) => a.addedAt - b.addedAt)
      .slice(-MAX_NETWORKS);
    tx.update(ref, { allowedNetworks: merged });
  });
}

export async function removeNetwork(db: Firestore, code: string, addr: string): Promise<void> {
  const ref = householdRef(db, code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('household-missing');
    const current = (snap.data() as Household).allowedNetworks ?? [];
    tx.update(ref, { allowedNetworks: current.filter((n) => n.addr !== addr) });
  });
}
