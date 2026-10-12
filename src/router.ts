import { signal } from '@preact/signals';

export interface Route { path: string; params: URLSearchParams }

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path.startsWith('/') ? path : `/${path}`, params: new URLSearchParams(query) };
}

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/'); const s = path.split('/');
  if (p.length !== s.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) out[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return out;
}

// 라우트를 모듈 수준 signal로 두는 이유: hashchange 리스너를 컴포넌트 effect에서 등록하면
// 자식(Join)의 effect가 부모(App)보다 먼저 돌아, 초대 링크 자동 입장이 바꾼 해시를 놓친다.
export const route = signal<Route>(parseHash(location.hash));
addEventListener('hashchange', () => { route.value = parseHash(location.hash); });

export function navigate(to: string): void {
  location.hash = to.startsWith('#') ? to : `#${to}`;
}

export function replaceHash(to: string): void {
  history.replaceState(null, '', `${location.pathname}${location.search}#${to.replace(/^#/, '')}`);
  route.value = parseHash(location.hash);
}

export function useRoute(): Route {
  return route.value;
}
