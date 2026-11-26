import { describe, expect, it } from 'vitest';
import { formatInvoiceNumber, formatQuantity, lineAmountCents, parseQuantity, sumCents } from './invoiceMath';

describe('parseQuantity', () => {
  it.each([
    ['1', 1],
    ['1.5', 1.5],
    ['1,5', 1.5],
    [' 2.25 ', 2.25],
    ['.5', 0.5],
    ['12', 12],
  ])('%j -> %d', (input, q) => expect(parseQuantity(input)).toBe(q));

  it.each(['', '0', '0.00', '-1', 'abc', '1.234', '1e3', '123456789'])('rejects %j', (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe('lineAmountCents', () => {
  it('matches the database test invoice (2 × R850 + 1.5 × R350 = R2 225)', () => {
    expect(lineAmountCents(2, 85000) + lineAmountCents(1.5, 35000)).toBe(222500);
  });
  it('rounds half-cents away from zero like Postgres', () => {
    expect(lineAmountCents(0.5, 1)).toBe(1); // 0.5c -> 1c
    expect(lineAmountCents(0.25, 1)).toBe(0); // 0.25c -> 0c
    expect(lineAmountCents(1.5, 33)).toBe(50); // 49.5c -> 50c
    expect(lineAmountCents(0.33, 1000)).toBe(330);
  });
  it('avoids floating point drift', () => {
    expect(lineAmountCents(1.15, 10000)).toBe(11500); // 1.15 * 10000 = 11499.999… in floats
    expect(lineAmountCents(2.01, 333)).toBe(669); // 669.33
  });
  it('handles zero prices', () => {
    expect(lineAmountCents(3, 0)).toBe(0);
  });
});

describe('helpers', () => {
  it('sums', () => expect(sumCents([100, 250, 0])).toBe(350));
  it('formats quantities', () => {
    expect(formatQuantity(1)).toBe('1');
    expect(formatQuantity(1.5)).toBe('1.5');
    expect(formatQuantity(2.25)).toBe('2.25');
  });
  it('previews invoice numbers like the database', () => {
    expect(formatInvoiceNumber('EDR-', 1)).toBe('EDR-0001');
    expect(formatInvoiceNumber('EDR-', 42)).toBe('EDR-0042');
    expect(formatInvoiceNumber('INV', 1234)).toBe('INV1234');
  });
});
