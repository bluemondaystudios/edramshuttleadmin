import { describe, expect, it } from 'vitest';
import { receiptPath } from './receipts';

describe('receiptPath', () => {
  it('files receipts by year and month', () => {
    expect(receiptPath('F0000000-0000-0000-0000-000000000001', '2026-11-26')).toBe('2026/11/f0000000-0000-0000-0000-000000000001.jpg');
  });
  it('rejects anything that could escape the folder', () => {
    expect(() => receiptPath('../../x', '2026-11-26')).toThrow();
    expect(() => receiptPath('f0000000-0000-0000-0000-000000000001', '26/11/2026')).toThrow();
  });
});
