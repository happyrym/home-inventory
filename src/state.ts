import { computed, effect, signal } from '@preact/signals';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { auth, db } from './firebase';
import { decideGate } from './lib/gate';
import { cacheIps, fetchPublicIpsIncremental, getCachedIps, matchesAny } from './lib/ip';
import { buildTree, makePathOf } from './lib/places';
import type { Household, Item, Place } from './lib/types';
import { subscribeItems, subscribePlaces } from './store/data';
import { subscribeHousehold } from './store/household';
import { clearCode, clearLastAllowedAt, getLastAllowedAt, getStoredCode, setLastAllowedAt, storeCode, watchAnonAuth } from './store/session';

export const code = signal<string | null>(getStoredCode());
export const uid = signal<string | null>(null);
export const authFailed = signal(false);
export const household = signal<Household | null | undefined>(undefined);
export const householdFailed = signal(false);
export const ips = signal<string[] | null>(null);
export const ipsComplete = signal(false);
export const ipFailed = signal(false);
export const lastAllowedAt = signal<number | null>(getLastAllowedAt());
export const now = signal(Date.now());
export const places = signal<Place[]>([]);
export const items = signal<Item[]>([]);
export const dataReady = signal(false);
export const searchQuery = signal('');
const retryTick = signal(0);
// gate가 lastAllowedAt에 의존하므로 allowed 때마다 쓰면 effect가 자기 자신을 재트리거한다.
// peek()로 추적을 피하고 1분 간격으로만 기록한다.
const LAST_ALLOWED_WRITE_GAP_MS = 60 * 1000;
const NOW_TICK_MS = 60 * 1000;
// 유예(오프라인 판정)인데 브라우저는 온라인이라고 하면 네트워크 전환 중 일시 실패일 수 있다.
// LTE에서 계속 열려 있지 않도록 점점 간격을 늘리며 재확인한다.
const GRACE_RETRY_MS = [3_000, 10_000, 30_000, 60_000];

export const gate = computed(() => decideGate({
  code: code.value, uid: uid.value, authFailed: authFailed.value,
  household: household.value, householdFailed: householdFailed.value,
  ips: ips.value, ipsComplete: ipsComplete.value, ipFailed: ipFailed.value,
  lastAllowedAt: lastAllowedAt.value, now: now.value,
}));
export const pathOf = computed(() => makePathOf(places.value));
export const tree = computed(() => buildTree(places.value));

let unsubHousehold: (() => void) | null = null;
let unsubData: (() => void)[] = [];
let booted = false;
let ipSeq = 0;
let graceTimer: number | null = null;
let graceRetries = 0;

// 세션 캐시는 새로고침 비용을 줄이는 용도. force(복귀·온라인·수동)는 캐시를 건너뛴다.
// 복귀·online이 연달아 오면 요청이 겹치므로 seq로 늦게 끝난 옛 응답을 버린다.
// 재확인 중에는 이전 주소를 유지하다가, 새 결과가 집과 일치하거나 전부 끝났을 때만 교체한다(화면 깜빡임 방지).
export async function refreshIps(force = false): Promise<void> {
  const my = ++ipSeq;
  now.value = Date.now();
  const cached = force ? null : getCachedIps(sessionStorage, now.value);
  if (cached) { ips.value = cached; ipsComplete.value = true; ipFailed.value = false; return; }
  ipsComplete.value = false;
  const partial: string[] = [];
  const nets = () => household.peek()?.allowedNetworks ?? [];
  try {
    const got = await fetchPublicIpsIncremental((ip) => {
      if (my !== ipSeq) return;
      partial.push(ip);
      if (ips.peek() === null || matchesAny(partial, nets())) ips.value = [...partial];
    });
    if (my !== ipSeq) return;
    cacheIps(sessionStorage, got, Date.now());
    ips.value = got;
    ipFailed.value = false;
  } catch {
    if (my !== ipSeq) return;
    ips.value = null;
    ipFailed.value = true;
  } finally {
    if (my === ipSeq) ipsComplete.value = true;
  }
}

export function retryHousehold(): void {
  householdFailed.value = false;
  retryTick.value++;
}

export function adoptCode(c: string): void {
  if (c === code.value) return;
  storeCode(c);
  clearLastAllowedAt();
  lastAllowedAt.value = null;
  householdFailed.value = false;
  code.value = c;
}

function startData(c: string): void {
  if (unsubData.length) return;
  let gotPlaces = false; let gotItems = false;
  const ready = () => { if (gotPlaces && gotItems) dataReady.value = true; };
  const fail = () => { householdFailed.value = true; };
  unsubData = [
    subscribePlaces(db, c, (p) => { places.value = p; gotPlaces = true; ready(); }, fail),
    subscribeItems(db, c, (i) => { items.value = i; gotItems = true; ready(); }, fail),
  ];
}

function stopData(): void {
  unsubData.forEach((u) => u());
  unsubData = [];
  places.value = [];
  items.value = [];
  dataReady.value = false;
}

function clearGraceTimer(): void {
  if (graceTimer !== null) { clearTimeout(graceTimer); graceTimer = null; }
}

export function boot(): void {
  if (booted) return;
  booted = true;

  // 구독은 uid가 생긴 뒤에만 건다. 영속 세션이 없는 새 기기에서 먼저 listen하면 permission-denied가
  // 떨어지고, 그걸 '문서 없음'으로 오판해 초대 링크 첫 입장이 실패했다.
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

  effect(() => {
    const g = gate.value;
    if (g.kind === 'allowed' && g.offlineGrace) {
      if (graceTimer === null && navigator.onLine) {
        const delay = GRACE_RETRY_MS[Math.min(graceRetries++, GRACE_RETRY_MS.length - 1)];
        graceTimer = window.setTimeout(() => { graceTimer = null; void refreshIps(true); }, delay);
      }
    } else {
      graceRetries = 0;
      clearGraceTimer();
    }
  });

  watchAnonAuth(auth, (u) => { uid.value = u; }, () => { authFailed.value = true; });
  void refreshIps();
  // 집에서 연 앱을 들고 나가도 리로드 없이는 게이트가 안 바뀌므로, 복귀·온라인 전환 때 캐시를 무시하고 다시 본다.
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refreshIps(true); });
  addEventListener('online', () => void refreshIps(true));
  setInterval(() => { now.value = Date.now(); }, NOW_TICK_MS);
}

// code를 먼저 지워야 한다. lastAllowedAt을 먼저 null로 만들면 gate가 아직 allowed인 채 재계산되어
// effect가 통과 시각을 다시 써 버린다. Firestore 영속 캐시에는 households/<code>/... 경로가 키로 남으므로
// 코드까지 지우려면 IndexedDB를 비우고 새로 시작해야 한다.
export async function leave(): Promise<void> {
  code.value = null;
  clearCode();
  lastAllowedAt.value = null;
  clearGraceTimer();
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch { /* best effort */ }
  location.reload();
}
