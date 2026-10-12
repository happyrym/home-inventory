import { matchesAny } from './ip';
import type { Household } from './types';

export const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000;

export type GateState =
  | { kind: 'no-code' }
  | { kind: 'checking' }
  | { kind: 'allowed'; offlineGrace?: true }
  | { kind: 'blocked'; ips: string[]; firstRun: boolean }
  | { kind: 'error'; reason: 'ip-lookup-failed' | 'household-missing' | 'household-failed' | 'auth-failed' };

export interface GateInput {
  code: string | null;
  uid: string | null;
  authFailed: boolean;
  household: Household | null | undefined;
  householdFailed: boolean;
  ips: string[] | null;
  ipsComplete: boolean;
  ipFailed: boolean;
  lastAllowedAt: number | null;
  now: number;
}

// 판정 우선순위: 코드 없음 > 인증 실패 > 구독 실패 > 로딩 > 문서 없음 > IP 조회 실패 > 대조.
// '문서 없음'을 IP 실패보다 앞에 두는 이유: 코드 오타를 네트워크 문제로 오해하지 않게 하려고.
// IP 조회 실패는 보통 오프라인이므로, 최근 24h 안에 집에서 통과한 기록이 있으면 캐시 검색을 허용한다.
// 주소가 부분만 도착했을 때(ipsComplete=false) 일치하면 바로 통과, 불일치면 차단이 아니라 대기.
export function decideGate(input: GateInput): GateState {
  if (!input.code) return { kind: 'no-code' };
  if (input.authFailed) return { kind: 'error', reason: 'auth-failed' };
  if (input.householdFailed) return { kind: 'error', reason: 'household-failed' };
  if (!input.uid || input.household === undefined) return { kind: 'checking' };
  if (input.household === null) return { kind: 'error', reason: 'household-missing' };
  if (input.ipFailed) {
    const withinGrace = input.lastAllowedAt !== null && input.now - input.lastAllowedAt < OFFLINE_GRACE_MS;
    return withinGrace ? { kind: 'allowed', offlineGrace: true } : { kind: 'error', reason: 'ip-lookup-failed' };
  }
  const nets = input.household.allowedNetworks ?? [];
  const ips = input.ips ?? [];
  if (ips.length > 0 && nets.length > 0 && matchesAny(ips, nets)) return { kind: 'allowed' };
  if (!input.ipsComplete || ips.length === 0) return { kind: 'checking' };
  if (nets.length === 0) return { kind: 'blocked', ips, firstRun: true };
  return { kind: 'blocked', ips, firstRun: false };
}
