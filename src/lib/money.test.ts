import { describe, expect, it } from 'vitest';
import { centsToDecimal, formatZAR, parseZAR, plainSpaces } from './money';

describe('formatZAR', () => {
  it('formats cents as South African rand', () => {
    expect(plainSpaces(formatZAR(222500))).toBe('R 2 225,00');
    expect(plainSpaces(formatZAR(0))).toBe('R 0,00');
    expect(plainSpaces(formatZAR(5))).toBe('R 0,05');
    expect(plainSpaces(formatZAR(123456789))).toBe('R 1 234 567,89');
  });
  it('uses non-breaking spaces that plainSpaces removes', () => {
    expect(formatZAR(222500)).toMatch(/ /);
    expect(plainSpaces(formatZAR(222500))).not.toMatch(/[  ]/);
  });
});

describe('parseZAR', () => {
  it.each([
    ['2225', 222500],
    ['2225.5', 222550],
    ['2225,5', 222550],
    ['2 225,50', 222550],
    ['R2,225.50', 222550],
    ['R 2 225,00', 222500],
    ['R 2 225,00', 222500],
    ['r 850', 85000],
    ['0.99', 99],
    ['.5', 50],
    ['1.234.567,89', 123456789],
    ['2,225', 222500],
    ['007', 700],
  ])('parses %j as %i cents', (input, cents) => {
    expect(parseZAR(input)).toBe(cents);
  });

  it.each(['', '   ', 'abc', '-50', '12.345.6', '1,22,333', '2.225.5.0', 'R', '1e5'])('rejects %j', (input) => {
    expect(parseZAR(input)).toBeNull();
  });

  it('round-trips with formatZAR', () => {
    for (const c of [0, 1, 99, 100, 222550, 120050, 987654321]) {
      expect(parseZAR(formatZAR(c))).toBe(c);
    }
  });
});

describe('centsToDecimal', () => {
  it('writes plain decimals for CSV', () => {
    expect(centsToDecimal(120050)).toBe('1200.50');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(centsToDecimal(0)).toBe('0.00');
    expect(centsToDecimal(-9900)).toBe('-99.00');
  });
});
