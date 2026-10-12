import type { AllowedNetwork } from './types';

const V4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
// 제공자를 둘로 나눈 이유: ipify 단독 장애가 곧 '집에서도 전면 차단'이 되기 때문.
const IP_SOURCES: { url: string; parse: 'json' | 'text' }[] = [
  { url: 'https://api.ipify.org?format=json', parse: 'json' },
  { url: 'https://api64.ipify.org?format=json', parse: 'json' },
  { url: 'https://ipv4.icanhazip.com', parse: 'text' },
];
const CACHE_KEY = 'hi.ips';
export const IP_CACHE_TTL_MS = 10 * 60 * 1000;

export function isV4(ip: string): boolean {
  return V4_RE.test(ip);
}

export function expandV6(ip: string): string[] {
  const halves = ip.split('::');
  if (halves.length > 2) throw new Error(`invalid ipv6: ${ip}`);
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? Array<string>(8 - head.length - tail.length).fill('0') : [];
  const parts = [...head, ...fill, ...tail];
  if (parts.length !== 8 || parts.some((p) => !/^[0-9a-fA-F]{1,4}$/.test(p))) throw new Error(`invalid ipv6: ${ip}`);
  return parts.map((p) => p.toLowerCase().replace(/^0+(?=.)/, ''));
}

// v6는 /64 프리픽스로만 비교한다. 폰은 프라이버시 확장으로 하위 64비트를 수시로 바꾸지만
// 공유기가 받은 프리픽스는 그대로이기 때문.
export function v6Prefix64(ip: string): string {
  return expandV6(ip).slice(0, 4).join(':');
}

export function toNetwork(ip: string, label: string, now: number): AllowedNetwork {
  return isV4(ip)
    ? { addr: ip, kind: 'v4', label, addedAt: now }
    : { addr: v6Prefix64(ip), kind: 'v6-64', label, addedAt: now };
}

function matchesOne(ip: string, net: AllowedNetwork): boolean {
  try {
    if (net.kind === 'v4') return isV4(ip) && ip === net.addr;
    return !isV4(ip) && v6Prefix64(ip) === net.addr;
  } catch {
    return false;
  }
}

export function matchesAny(ips: string[], nets: AllowedNetwork[]): boolean {
  return ips.some((ip) => nets.some((net) => matchesOne(ip, net)));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function readIp(res: Response, parse: 'json' | 'text'): Promise<string> {
  if (parse === 'json') return String(((await res.json()) as { ip: unknown }).ip);
  return (await res.text()).trim();
}

export async function fetchPublicIps(fetchFn: typeof fetch = fetch, timeoutMs = 5000): Promise<string[]> {
  const results = await Promise.allSettled(
    IP_SOURCES.map((s) => withTimeout(fetchFn(s.url).then((r) => readIp(r, s.parse)), timeoutMs)),
  );
  const ips = [...new Set(results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : [])))];
  if (ips.length === 0) throw new Error('ip-lookup-failed');
  return ips;
}

export function getCachedIps(storage: Storage, now: number): string[] | null {
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ips, at } = JSON.parse(raw) as { ips: string[]; at: number };
    return now - at < IP_CACHE_TTL_MS ? ips : null;
  } catch {
    return null;
  }
}

export function cacheIps(storage: Storage, ips: string[], now: number): void {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify({ ips, at: now }));
  } catch {
    /* storage unavailable: skip caching */
  }
}
