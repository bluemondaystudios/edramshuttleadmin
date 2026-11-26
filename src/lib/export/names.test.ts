import { describe, expect, it } from 'vitest';
import { financialYear } from '../dates';
import { backupName, packName, receiptFileName } from './names';

describe('export names', () => {
  it('names the pack after the tax year', () => {
    expect(packName(financialYear('2026-11-26'))).toBe('EDRAM-records-2026-27');
  });
  it('names backups by date', () => {
    expect(backupName('2026-11-26')).toBe('EDRAM-backup-2026-11-26');
  });
  it('names receipts so they sort by date and are easy to match', () => {
    expect(receiptFileName({ id: 'f0000000-0000-0000-0000-000000000001', spent_on: '2026-11-26', category: 'fuel', amount_cents: 120050 })).toBe(
      '2026-11-26_fuel_1200.50_f0000000-0000-0000-0000-000000000001.jpg',
    );
  });
});
