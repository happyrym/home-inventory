const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
export const CODE_LENGTH = 26;
export const PUBLIC_APP_URL = 'https://happyrym.github.io/home-inventory/';

export function generateCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(random(CODE_LENGTH), (b) => ALPHABET[b & 31]).join('');
}

export function normalizeCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z2-7]/g, '');
}

export function extractCode(input: string): string {
  const m = input.match(/[?&]code=([^&#\s]+)/);
  return normalizeCode(m ? decodeURIComponent(m[1]) : input);
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

export function joinLink(code: string): string {
  return `${PUBLIC_APP_URL}#/join?code=${code}`;
}
