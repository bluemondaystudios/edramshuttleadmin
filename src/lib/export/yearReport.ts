// Tax-year figures (CLAUDE.md section 12). Income is counted when it's received;
// invoiced totals and the balance outstanding at year end are shown alongside,
// and the accountant decides the basis.

import type { FinancialYear } from '../dates';
import type { InvoiceWithDetails } from '../types';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../expenseCategories';

export interface ReportExpense {
  spent_on: string;
  amount_cents: number;
  category: ExpenseCategory;
  vehicle_id: string | null;
}

export interface YearReport {
  receivedCents: number;
  paymentCount: number;
  invoicedCents: number;
  invoiceCount: number;
  voidCount: number;
  /** Still owed at the last day of the year, on invoices issued up to then (void ones excluded). */
  outstandingAtYearEndCents: number;
  expensesCents: number;
  expenseCount: number;
  byCategory: { category: ExpenseCategory; cents: number; count: number }[];
  byVehicle: { vehicleId: string | null; cents: number; count: number }[];
  /** Received minus expenses. */
  netCents: number;
}

const inYear = (d: string | null, fy: FinancialYear) => !!d && d >= fy.start && d <= fy.end;

/**
 * @param invoices every issued or void invoice issued on or before the year end, with its payments
 * @param expenses every (not deleted) expense dated in the year
 */
export function computeYearReport(fy: FinancialYear, invoices: InvoiceWithDetails[], expenses: ReportExpense[]): YearReport {
  let receivedCents = 0;
  let paymentCount = 0;
  let invoicedCents = 0;
  let invoiceCount = 0;
  let voidCount = 0;
  let outstanding = 0;

  for (const inv of invoices) {
    if (inv.status === 'draft' || !inv.issue_date || inv.issue_date > fy.end) continue;
    for (const p of inv.payments) {
      if (inYear(p.paid_on, fy)) {
        receivedCents += Number(p.amount_cents);
        paymentCount++;
      }
    }
    if (inv.status === 'void') {
      if (inYear(inv.issue_date, fy)) voidCount++;
      continue;
    }
    if (inYear(inv.issue_date, fy)) {
      invoicedCents += Number(inv.total_cents);
      invoiceCount++;
    }
    const paidByYearEnd = inv.payments.filter((p) => p.paid_on <= fy.end).reduce((s, p) => s + Number(p.amount_cents), 0);
    outstanding += Math.max(Number(inv.total_cents) - paidByYearEnd, 0);
  }

  const cat = new Map<ExpenseCategory, { cents: number; count: number }>();
  const veh = new Map<string | null, { cents: number; count: number }>();
  let expensesCents = 0;
  let expenseCount = 0;
  for (const e of expenses) {
    if (!inYear(e.spent_on, fy)) continue;
    const c = Number(e.amount_cents);
    expensesCents += c;
    expenseCount++;
    const a = cat.get(e.category) ?? { cents: 0, count: 0 };
    cat.set(e.category, { cents: a.cents + c, count: a.count + 1 });
    const b = veh.get(e.vehicle_id) ?? { cents: 0, count: 0 };
    veh.set(e.vehicle_id, { cents: b.cents + c, count: b.count + 1 });
  }

  const order = new Map(EXPENSE_CATEGORIES.map((c, i) => [c.value, i]));
  return {
    receivedCents,
    paymentCount,
    invoicedCents,
    invoiceCount,
    voidCount,
    outstandingAtYearEndCents: outstanding,
    expensesCents,
    expenseCount,
    byCategory: [...cat.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((x, y) => y.cents - x.cents || (order.get(x.category) ?? 0) - (order.get(y.category) ?? 0)),
    byVehicle: [...veh.entries()]
      .map(([vehicleId, v]) => ({ vehicleId, ...v }))
      .sort((x, y) => (x.vehicleId === null ? 1 : 0) - (y.vehicleId === null ? 1 : 0) || y.cents - x.cents),
    netCents: receivedCents - expensesCents,
  };
}
