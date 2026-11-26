import { describe, expect, it } from 'vitest';
import { matchesFilter, matchesSearch } from './invoiceFilters';
import type { InvoiceBalance } from '../../lib/types';

const row = (o: Partial<InvoiceBalance>): InvoiceBalance => ({
  id: 'x', number: 'EDR-0001', status: 'issued', customer_id: 'c', customer_name: 'Mokoena Family', issue_date: '2026-11-01', due_date: '2026-11-08',
  total_cents: 1000, paid_cents: 0, balance_cents: 1000, is_overdue: false, ...o,
});

describe('matchesFilter', () => {
  const unpaid = row({});
  const overdue = row({ is_overdue: true });
  const partly = row({ paid_cents: 500, balance_cents: 500 });
  const paid = row({ paid_cents: 1000, balance_cents: 0 });
  const draft = row({ status: 'draft', number: null, issue_date: null, is_overdue: null });
  const voided = row({ status: 'void' });

  it('unpaid includes everything still owing', () => {
    expect([unpaid, overdue, partly, paid, draft, voided].map((r) => matchesFilter(r, 'unpaid'))).toEqual([true, true, true, false, false, false]);
  });
  it('the other chips', () => {
    expect(matchesFilter(overdue, 'overdue')).toBe(true);
    expect(matchesFilter(unpaid, 'overdue')).toBe(false);
    expect(matchesFilter(paid, 'paid')).toBe(true);
    expect(matchesFilter(draft, 'drafts')).toBe(true);
    expect(matchesFilter(voided, 'void')).toBe(true);
    expect(matchesFilter(voided, 'all')).toBe(true);
  });
});

describe('matchesSearch', () => {
  it('finds by customer and number', () => {
    expect(matchesSearch(row({}), 'mokoena')).toBe(true);
    expect(matchesSearch(row({}), 'EDR-0001')).toBe(true);
    expect(matchesSearch(row({}), 'edr1')).toBe(true);
    expect(matchesSearch(row({}), '1')).toBe(true);
    expect(matchesSearch(row({ number: 'EDR-0012' }), '1')).toBe(false);
    expect(matchesSearch(row({ number: 'EDR-0012' }), '12')).toBe(true);
    expect(matchesSearch(row({}), 'nkosi')).toBe(false);
    expect(matchesSearch(row({ number: null, status: 'draft' }), 'draft')).toBe(true);
    expect(matchesSearch(row({}), '  ')).toBe(true);
  });
});
