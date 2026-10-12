import { describe, expect, test } from 'vitest';
import { CODE_LENGTH, PUBLIC_APP_URL, generateCode, normalizeCode, extractCode, isValidCode, joinLink } from '../../src/lib/household-code';

const CODE = 'abcdefghijklmnopqrstuvwxyz'.slice(0, 26);

describe('household code', () => {
  test('generateCode yields 26 lowercase base32 chars from random bytes', () => {
    const code = generateCode((n) => new Uint8Array(n).map((_, i) => i));
    expect(code).toHaveLength(CODE_LENGTH);
    expect(code).toMatch(/^[a-z2-7]{26}$/);
    expect(code.startsWith('abcdefgh')).toBe(true);
  });
  test('default generator uses crypto and differs per call', () => {
    expect(generateCode()).not.toBe(generateCode());
  });
  test('normalizeCode strips separators and case', () => {
    expect(normalizeCode(' ABCD-efgh ijkl ')).toBe('abcdefghijkl');
  });
  test('extractCode accepts raw code, join link, or code= fragment', () => {
    expect(extractCode(CODE)).toBe(CODE);
    expect(extractCode(joinLink(CODE))).toBe(CODE);
    expect(extractCode(`#/join?code=${CODE.toUpperCase()}`)).toBe(CODE);
  });
  test('isValidCode', () => {
    expect(isValidCode('a'.repeat(26))).toBe(true);
    expect(isValidCode('a'.repeat(25))).toBe(false);
    expect(isValidCode('1'.repeat(26))).toBe(false);
  });
  test('joinLink points at the public app url', () => {
    expect(joinLink(CODE)).toBe(`${PUBLIC_APP_URL}#/join?code=${CODE}`);
  });
});
