import { onAuthStateChanged, signInAnonymously, type Auth, type Unsubscribe } from 'firebase/auth';

const CODE_KEY = 'hi.code';
const LAST_ALLOWED_KEY = 'hi.lastAllowedAt';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

export const getStoredCode = () => read(CODE_KEY);
export const storeCode = (code: string) => write(CODE_KEY, code);
export const clearCode = () => { write(CODE_KEY, null); write(LAST_ALLOWED_KEY, null); };
export const clearLastAllowedAt = () => write(LAST_ALLOWED_KEY, null);

export function getLastAllowedAt(): number | null {
  const raw = read(LAST_ALLOWED_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}
export const setLastAllowedAt = (ts: number) => write(LAST_ALLOWED_KEY, String(ts));

// onAuthStateChanged는 영속 세션 복원이 끝난 뒤 처음 호출되므로, 그때 사용자가 없을 때만 익명 로그인한다.
// (복원 전에 signInAnonymously를 부르면 실행마다 새 계정이 생긴다.) 계정이 삭제돼 로그아웃되면 다시 null이
// 오므로 자동으로 재로그인된다.
export function watchAnonAuth(auth: Auth, onUid: (uid: string | null) => void, onFail: (e: unknown) => void): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    if (user) { onUid(user.uid); return; }
    onUid(null);
    signInAnonymously(auth).catch(onFail);
  });
}
