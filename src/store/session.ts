import { signInAnonymously, type Auth } from 'firebase/auth';

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

export function getLastAllowedAt(): number | null {
  const raw = read(LAST_ALLOWED_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}
export const setLastAllowedAt = (ts: number) => write(LAST_ALLOWED_KEY, String(ts));

export async function ensureAnonAuth(auth: Auth): Promise<string> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}
