import { describe, expect, it } from 'vitest';
import { displayStatus, type InvoiceBalanceRow } from './invoiceStatus';

const base: InvoiceBalanceRow = { status: 'issued', total_cents: 10000, paid_cents: 0, balance_cents: 10000, is_overdue: false };

describe('displayStatus', () => {
  it('drafts and voids win regardless of money', () => {
    expect(displayStatus({ ...base, status: 'draft', is_overdue: null })).toBe('draft');
    expect(displayStatus({ ...base, status: 'void' })).toBe('void');
  });
  it('issued invoices', () => {
    expect(displayStatus(base)).toBe('unpaid');
    expect(displayStatus({ ...base, is_overdue: true })).toBe('overdue');
    expect(displayStatus({ ...base, paid_cents: 4000, balance_cents: 6000 })).toBe('partly_paid');
    expect(displayStatus({ ...base, paid_cents: 4000, balance_cents: 6000, is_overdue: true })).toBe('overdue');
    expect(displayStatus({ ...base, paid_cents: 10000, balance_cents: 0 })).toBe('paid');
    expect(displayStatus({ ...base, paid_cents: 12000, balance_cents: -2000 })).toBe('paid');
  });
});
