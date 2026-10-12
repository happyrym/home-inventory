import { describe, expect, test } from 'vitest';
import { normalize, toChosung, isChosungQuery } from '../../src/lib/hangul';

describe('normalize', () => {
  test('lowercases, strips whitespace, NFC', () => {
    expect(normalize(' USB  케이블 ')).toBe('usb케이블');
    expect(normalize('한한')).toBe('한한');
  });
});

describe('toChosung', () => {
  test('extracts initial consonants, keeps non-hangul', () => {
    expect(toChosung('충전기')).toBe('ㅊㅈㄱ');
    expect(toChosung('usb케이블')).toBe('usbㅋㅇㅂ');
    expect(toChosung('쌀')).toBe('ㅆ');
  });
});

describe('isChosungQuery', () => {
  test('true only when every char is a compatibility initial consonant', () => {
    expect(isChosungQuery('ㅊㅈㄱ')).toBe(true);
    expect(isChosungQuery('ㅊ전기')).toBe(false);
    expect(isChosungQuery('')).toBe(false);
  });
});
