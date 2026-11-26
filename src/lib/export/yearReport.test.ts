import { describe, expect, it } from 'vitest';
import { financialYear } from '../dates';
import { sampleInvoice } from '../pdf/testFixtures';
import type { Payment } from '../types';
import { computeYearReport, type ReportExpense } from './yearReport';

const fy = financialYear('2026-11-26'); // 1 Mar 2026 – 28 Feb 2027
const pay = (amount: number, paid_on: string): Payment => ({ id: paid_on + amount, invoice_id: 'x', paid_on, amount_cents: amount, method: 'eft', reference: null, notes: null, created_at: '' });

describe('computeYearReport', () => {
  const invoices = [
    // last year's invoice, paid this year: counts as received this year, not invoiced
    sampleInvoice({ id: 'a', number: 'EDR-0001', issue_date: '2026-02-20', total_cents: 100000, payments: [pay(100000, '2026-03-05')] }),
    // this year, partly paid before year end, rest after
    sampleInvoice({ id: 'b', number: 'EDR-0002', issue_date: '2026-11-01', total_cents: 222500, payments: [pay(100000, '2026-12-01'), pay(122500, '2027-03-02')] }),
    // this year, unpaid
    sampleInvoice({ id: 'c', number: 'EDR-0003', issue_date: '2027-02-28', total_cents: 50000, payments: [] }),
    // void: not invoiced, not outstanding
    sampleInvoice({ id: 'd', number: 'EDR-0004', status: 'void', issue_date: '2026-06-01', total_cents: 99900, void_reason: 'x', payments: [] }),
    // next year: ignored
    sampleInvoice({ id: 'e', number: 'EDR-0005', issue_date: '2027-03-01', total_cents: 70000, payments: [pay(70000, '2027-03-01')] }),
  ];
  const expenses: ReportExpense[] = [
    { spent_on: '2026-03-01', amount_cents: 120050, category: 'fuel', vehicle_id: 'v1' },
    { spent_on: '2027-02-28', amount_cents: 9900, category: 'tolls', vehicle_id: null },
    { spent_on: '2026-07-10', amount_cents: 45000, category: 'fuel', vehicle_id: 'v2' },
    { spent_on: '2026-02-28', amount_cents: 1, category: 'other', vehicle_id: null }, // last year
  ];
  const r = computeYearReport(fy, invoices, expenses);

  it('counts money when it is received', () => {
    expect(r.receivedCents).toBe(200000); // 1000 (a, paid in March) + 1000 (b, December)
    expect(r.paymentCount).toBe(2);
  });
  it('counts invoices issued in the year, excluding void ones', () => {
    expect(r.invoicedCents).toBe(272500);
    expect(r.invoiceCount).toBe(2);
    expect(r.voidCount).toBe(1);
  });
  it('works out what was still owed on the last day of the year', () => {
    expect(r.outstandingAtYearEndCents).toBe(122500 + 50000);
  });
  it('totals expenses by category and vehicle', () => {
    expect(r.expensesCents).toBe(174950);
    expect(r.expenseCount).toBe(3);
    expect(r.byCategory).toEqual([
      { category: 'fuel', cents: 165050, count: 2 },
      { category: 'tolls', cents: 9900, count: 1 },
    ]);
    expect(r.byVehicle).toEqual([
      { vehicleId: 'v1', cents: 120050, count: 1 },
      { vehicleId: 'v2', cents: 45000, count: 1 },
      { vehicleId: null, cents: 9900, count: 1 },
    ]);
  });
  it('net is received minus expenses', () => {
    expect(r.netCents).toBe(200000 - 174950);
  });
  it('an empty year is all zeros', () => {
    const e = computeYearReport(fy, [], []);
    expect([e.receivedCents, e.invoicedCents, e.outstandingAtYearEndCents, e.expensesCents, e.netCents]).toEqual([0, 0, 0, 0, 0]);
  });
});
