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
  ipFailed: boolean;
  lastAllowedAt: number | null;
  now: number;
}

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
  if (input.ips === null) return { kind: 'checking' };
  const nets = input.household.allowedNetworks ?? [];
  if (nets.length === 0) return { kind: 'blocked', ips: input.ips, firstRun: true };
  return matchesAny(input.ips, nets) ? { kind: 'allowed' } : { kind: 'blocked', ips: input.ips, firstRun: false };
}
