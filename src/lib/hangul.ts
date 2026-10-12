const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const PER_CHO = 21 * 28;

export function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

export function toChosung(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    out += code >= HANGUL_BASE && code <= HANGUL_LAST ? CHO[Math.floor((code - HANGUL_BASE) / PER_CHO)] : ch;
  }
  return out;
}

export function isChosungQuery(q: string): boolean {
  return q.length > 0 && [...q].every((ch) => CHO.includes(ch));
}
