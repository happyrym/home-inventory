import { computed, effect, signal } from '@preact/signals';
import { auth, db } from './firebase';
import { decideGate } from './lib/gate';
import { cacheIps, fetchPublicIps, getCachedIps } from './lib/ip';
import { buildTree, makePathOf } from './lib/places';
import type { Household, Item, Place } from './lib/types';
import { subscribeItems, subscribePlaces } from './store/data';
import { subscribeHousehold } from './store/household';
import { clearCode, ensureAnonAuth, getLastAllowedAt, getStoredCode, setLastAllowedAt } from './store/session';

export const code = signal<string | null>(getStoredCode());
export const uid = signal<string | null>(null);
export const authFailed = signal(false);
export const household = signal<Household | null | undefined>(undefined);
export const householdFailed = signal(false);
export const ips = signal<string[] | null>(null);
export const ipFailed = signal(false);
export const lastAllowedAt = signal<number | null>(getLastAllowedAt());
export const now = signal(Date.now());
export const places = signal<Place[]>([]);
export const items = signal<Item[]>([]);
export const dataReady = signal(false);
const retryTick = signal(0);
const LAST_ALLOWED_WRITE_GAP_MS = 60 * 1000;

export const gate = computed(() => decideGate({
  code: code.value, uid: uid.value, authFailed: authFailed.value,
  household: household.value, householdFailed: householdFailed.value,
  ips: ips.value, ipFailed: ipFailed.value,
  lastAllowedAt: lastAllowedAt.value, now: now.value,
}));
export const pathOf = computed(() => makePathOf(places.value));
export const tree = computed(() => buildTree(places.value));

let unsubHousehold: (() => void) | null = null;
let unsubData: (() => void)[] = [];
let booted = false;

export async function refreshIps(force = false): Promise<void> {
  now.value = Date.now();
  const cached = force ? null : getCachedIps(sessionStorage, now.value);
  if (cached) { ips.value = cached; ipFailed.value = false; return; }
  try {
    const got = await fetchPublicIps();
    cacheIps(sessionStorage, got, Date.now());
    ips.value = got;
    ipFailed.value = false;
  } catch {
    ips.value = null;
    ipFailed.value = true;
  }
}

export function retryHousehold(): void {
  householdFailed.value = false;
  retryTick.value++;
}

function startData(c: string): void {
  if (unsubData.length) return;
  let gotPlaces = false; let gotItems = false;
  const ready = () => { if (gotPlaces && gotItems) dataReady.value = true; };
  unsubData = [
    subscribePlaces(db, c, (p) => { places.value = p; gotPlaces = true; ready(); }),
    subscribeItems(db, c, (i) => { items.value = i; gotItems = true; ready(); }),
  ];
}

function stopData(): void {
  unsubData.forEach((u) => u());
  unsubData = [];
  places.value = [];
  items.value = [];
  dataReady.value = false;
}

export function boot(): void {
  if (booted) return;
  booted = true;

  effect(() => {
    const c = code.value; const u = uid.value; void retryTick.value;
    unsubHousehold?.();
    unsubHousehold = null;
    household.value = undefined;
    stopData();
    if (!c || !u) return;
    unsubHousehold = subscribeHousehold(db, c,
      (h) => { household.value = h; },
      () => { householdFailed.value = true; });
  });

  effect(() => {
    const g = gate.value; const c = code.value;
    if (g.kind === 'allowed' && c) {
      startData(c);
      const t = Date.now();
      if (!g.offlineGrace && t - (lastAllowedAt.peek() ?? 0) > LAST_ALLOWED_WRITE_GAP_MS) { setLastAllowedAt(t); lastAllowedAt.value = t; }
    } else if (g.kind !== 'checking') {
      stopData();
    }
  });

  ensureAnonAuth(auth).then((u) => { uid.value = u; }, () => { authFailed.value = true; });
  void refreshIps();
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refreshIps(true); });
  addEventListener('online', () => void refreshIps(true));
}

export function leave(): void {
  clearCode();
  lastAllowedAt.value = null;
  code.value = null;
}
