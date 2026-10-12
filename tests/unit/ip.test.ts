import { describe, expect, test, vi } from 'vitest';
import { isV4, expandV6, v6Prefix64, toNetwork, matchesAny, fetchPublicIps, getCachedIps, cacheIps, IP_CACHE_TTL_MS } from '../../src/lib/ip';

describe('address helpers', () => {
  test('isV4', () => {
    expect(isV4('121.134.1.20')).toBe(true);
    expect(isV4('2001:db8::1')).toBe(false);
  });
  test('expandV6 handles :: and case', () => {
    expect(expandV6('2001:DB8::1')).toEqual(['2001', 'db8', '0', '0', '0', '0', '0', '1']);
    expect(expandV6('::1')).toEqual(['0', '0', '0', '0', '0', '0', '0', '1']);
    expect(() => expandV6('1::2::3')).toThrow();
    expect(() => expandV6('1:2:3')).toThrow();
  });
  test('v6Prefix64', () => {
    expect(v6Prefix64('2001:db8:abcd:0012:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:abcd:12');
  });
  test('toNetwork classifies', () => {
    expect(toNetwork('1.2.3.4', '집', 5)).toEqual({ addr: '1.2.3.4', kind: 'v4', label: '집', addedAt: 5 });
    expect(toNetwork('2001:db8:abcd:12:1:2:3:4', '집', 5)).toEqual({ addr: '2001:db8:abcd:12', kind: 'v6-64', label: '집', addedAt: 5 });
  });
});

describe('matchesAny', () => {
  const nets = [toNetwork('1.2.3.4', 'a', 0), toNetwork('2001:db8:abcd:12::1', 'b', 0)];
  test('v4 exact, v6 by /64, otherwise false', () => {
    expect(matchesAny(['1.2.3.4'], nets)).toBe(true);
    expect(matchesAny(['1.2.3.5'], nets)).toBe(false);
    expect(matchesAny(['2001:db8:abcd:12:ffff::9'], nets)).toBe(true);
    expect(matchesAny(['2001:db8:abcd:13::1'], nets)).toBe(false);
    expect(matchesAny(['9.9.9.9', '2001:db8:abcd:12::2'], nets)).toBe(true);
    expect(matchesAny([], nets)).toBe(false);
    expect(matchesAny(['garbage'], nets)).toBe(false);
  });
});

describe('fetchPublicIps', () => {
  const json = (ip: string) => Promise.resolve(new Response(JSON.stringify({ ip }), { headers: { 'content-type': 'application/json' } }));
  const text = (ip: string) => Promise.resolve(new Response(`${ip}\n`, { headers: { 'content-type': 'text/plain' } }));
  const mock = (fn: (url: string) => Promise<Response>) => vi.fn(fn) as unknown as typeof fetch;

  test('queries three sources, dedupes, keeps both families', async () => {
    const f = mock((url) => (url.includes('api64') ? json('2001:db8::1') : url.includes('icanhazip') ? text('1.2.3.4') : json('1.2.3.4')));
    expect(await fetchPublicIps(f)).toEqual(['1.2.3.4', '2001:db8::1']);
    expect(f).toHaveBeenCalledTimes(3);
  });
  test('partial failure still returns', async () => {
    const f = mock((url) => (url.includes('ipify') ? Promise.reject(new Error('down')) : text('1.2.3.4')));
    expect(await fetchPublicIps(f)).toEqual(['1.2.3.4']);
  });
  test('total failure throws ip-lookup-failed', async () => {
    const f = mock(() => Promise.reject(new Error('down')));
    await expect(fetchPublicIps(f)).rejects.toThrow('ip-lookup-failed');
  });
  test('timeout counts as failure', async () => {
    const f = mock(() => new Promise<Response>(() => {}));
    await expect(fetchPublicIps(f, 10)).rejects.toThrow('ip-lookup-failed');
  });
  test('rejects non-ok, non-ip or empty responses', async () => {
    const html = () => Promise.resolve(new Response('<html>error</html>', { status: 502 }));
    const f = mock((url) => (url.includes('icanhazip') ? html() : url.includes('api64') ? json('') : Promise.resolve(new Response('{}'))));
    await expect(fetchPublicIps(f)).rejects.toThrow('ip-lookup-failed');
    const g = mock((url) => (url.includes('icanhazip') ? text('not an ip') : json('1.2.3.4')));
    expect(await fetchPublicIps(g)).toEqual(['1.2.3.4']);
  });
  test('incremental callback fires per unique ip', async () => {
    const seen: string[] = [];
    const f = mock((url) => (url.includes('api64') ? json('2001:db8::1') : json('1.2.3.4')));
    const { fetchPublicIpsIncremental } = await import('../../src/lib/ip');
    expect(await fetchPublicIpsIncremental((ip) => seen.push(ip), f)).toEqual(['1.2.3.4', '2001:db8::1']);
    expect(seen).toEqual(['1.2.3.4', '2001:db8::1']);
  });
});

describe('ip cache', () => {
  const mem = (): Storage => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 };
  };
  test('returns within ttl, null after', () => {
    const s = mem();
    cacheIps(s, ['1.2.3.4'], 1000);
    expect(getCachedIps(s, 1000 + IP_CACHE_TTL_MS - 1)).toEqual(['1.2.3.4']);
    expect(getCachedIps(s, 1000 + IP_CACHE_TTL_MS)).toBeNull();
    expect(getCachedIps(mem(), 0)).toBeNull();
  });
});
