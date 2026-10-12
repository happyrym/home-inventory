import { describe, expect, test } from 'vitest';
import { decideGate, OFFLINE_GRACE_MS, type GateInput } from '../../src/lib/gate';
import { toNetwork } from '../../src/lib/ip';

const NOW = 1_000_000_000;
const base: GateInput = {
  code: 'c'.repeat(26), uid: 'u1', authFailed: false,
  household: { name: '집', allowedNetworks: [toNetwork('1.2.3.4', '집', 0)], createdAt: 0 }, householdFailed: false,
  ips: ['1.2.3.4'], ipFailed: false, lastAllowedAt: null, now: NOW,
};

describe('decideGate', () => {
  test('no code', () => expect(decideGate({ ...base, code: null })).toEqual({ kind: 'no-code' }));
  test('auth failed', () => expect(decideGate({ ...base, uid: null, authFailed: true })).toEqual({ kind: 'error', reason: 'auth-failed' }));
  test('household subscription failed (e.g. permission)', () => {
    expect(decideGate({ ...base, household: undefined, householdFailed: true })).toEqual({ kind: 'error', reason: 'household-failed' });
  });
  test('checking while auth, household or ips pending', () => {
    expect(decideGate({ ...base, uid: null })).toEqual({ kind: 'checking' });
    expect(decideGate({ ...base, household: undefined })).toEqual({ kind: 'checking' });
    expect(decideGate({ ...base, ips: null })).toEqual({ kind: 'checking' });
  });
  test('household missing', () => expect(decideGate({ ...base, household: null })).toEqual({ kind: 'error', reason: 'household-missing' }));
  test('ip lookup failed without grace', () => {
    expect(decideGate({ ...base, ips: null, ipFailed: true })).toEqual({ kind: 'error', reason: 'ip-lookup-failed' });
    expect(decideGate({ ...base, ips: null, ipFailed: true, lastAllowedAt: NOW - OFFLINE_GRACE_MS })).toEqual({ kind: 'error', reason: 'ip-lookup-failed' });
  });
  test('ip lookup failed within grace is allowed offline', () => {
    expect(decideGate({ ...base, ips: null, ipFailed: true, lastAllowedAt: NOW - OFFLINE_GRACE_MS + 1 })).toEqual({ kind: 'allowed', offlineGrace: true });
  });
  test('first run with no or missing networks is blocked with firstRun', () => {
    expect(decideGate({ ...base, household: { ...base.household!, allowedNetworks: [] } })).toEqual({ kind: 'blocked', ips: ['1.2.3.4'], firstRun: true });
    expect(decideGate({ ...base, household: { name: '집', createdAt: 0 } })).toEqual({ kind: 'blocked', ips: ['1.2.3.4'], firstRun: true });
  });
  test('allowed / blocked by match', () => {
    expect(decideGate(base)).toEqual({ kind: 'allowed' });
    expect(decideGate({ ...base, ips: ['5.6.7.8'] })).toEqual({ kind: 'blocked', ips: ['5.6.7.8'], firstRun: false });
  });
  test('household-missing wins over ip failure', () => {
    expect(decideGate({ ...base, household: null, ips: null, ipFailed: true })).toEqual({ kind: 'error', reason: 'household-missing' });
  });
});
