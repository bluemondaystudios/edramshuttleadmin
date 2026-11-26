// The tax-year export pack (CLAUDE.md section 12) and the full backup (section 13).
// The file contents are built by pure functions (tested); fetching and zipping are injected.

import type { FinancialYear } from '../dates';
import { formatDate } from '../dates';
import { centsToDecimal } from '../money';
import { categoryLabel, type ExpenseCategory } from '../expenseCategories';
import type { BusinessSettings, InvoiceWithDetails, Vehicle } from '../types';
import { paymentMethodLabel } from '../types';
import { invoiceFileName } from '../share';
import { toCsv } from './csv';
import { packName, receiptFileName } from './names';
import { computeYearReport, type YearReport } from './yearReport';
import type { ZipEntry } from './zip';

export interface PackExpense {
  id: string;
  spent_on: string;
  amount_cents: number;
  category: ExpenseCategory;
  vehicle_id: string | null;
  supplier: string | null;
  description: string | null;
  payment_method: 'eft' | 'cash' | 'card' | 'other';
  receipt_path: string | null;
}

export interface YearData {
  fy: FinancialYear;
  settings: BusinessSettings;
  /** Issued and void invoices issued on or before the year end, with lines and payments. */
  invoices: InvoiceWithDetails[];
  /** Expenses dated in the year, not deleted. */
  expenses: PackExpense[];
  vehicles: Vehicle[];
}

const amount = (cents: number) => centsToDecimal(Number(cents));
const inYear = (d: string | null | undefined, fy: FinancialYear) => !!d && d >= fy.start && d <= fy.end;

export function yearReportOf(data: YearData): YearReport {
  return computeYearReport(data.fy, data.invoices, data.expenses);
}

export function summaryCsv(data: YearData, r = yearReportOf(data)): string {
  const labels = vehicleLabels(data.vehicles);
  const rows: (string | number)[][] = [
    ['Money received (payments dated in the year)', amount(r.receivedCents), r.paymentCount],
    ['Invoiced (invoices issued in the year, excluding void)', amount(r.invoicedCents), r.invoiceCount],
    ['Void invoices issued in the year', amount(0), r.voidCount],
    [`Outstanding at year end (${data.fy.end})`, amount(r.outstandingAtYearEndCents), ''],
    ['Expenses total', amount(r.expensesCents), r.expenseCount],
    ...r.byCategory.map((c) => [`Expenses: ${categoryLabel(c.category)}`, amount(c.cents), c.count]),
    ...r.byVehicle.map((v) => [`Expenses by vehicle: ${v.vehicleId ? (labels[v.vehicleId] ?? 'Unknown vehicle') : 'No vehicle'}`, amount(v.cents), v.count]),
    ['Received minus expenses', amount(r.netCents), ''],
  ];
  return toCsv(['item', 'amount', 'count'], rows);
}

export function invoicesCsv(data: YearData): string {
  const rows = data.invoices
    .filter((i) => inYear(i.issue_date, data.fy))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .map((i) => {
      const paid = i.payments.reduce((s, p) => s + Number(p.amount_cents), 0);
      const balance = i.status === 'void' ? 0 : Number(i.total_cents) - paid;
      return [i.number, i.status, i.issue_date, i.due_date, i.customer_snapshot?.name ?? '', amount(i.total_cents), amount(paid), amount(balance), i.void_reason ?? '', invoiceFileName(i.number!)];
    });
  return toCsv(['number', 'status', 'issue_date', 'due_date', 'customer', 'total', 'paid', 'balance', 'void_reason', 'pdf_file'], rows);
}

export function paymentsCsv(data: YearData): string {
  const rows = data.invoices
    .flatMap((i) => i.payments.filter((p) => inYear(p.paid_on, data.fy)).map((p) => ({ i, p })))
    .sort((a, b) => a.p.paid_on.localeCompare(b.p.paid_on) || (a.i.seq ?? 0) - (b.i.seq ?? 0))
    .map(({ i, p }) => [p.paid_on, i.number, i.customer_snapshot?.name ?? '', amount(p.amount_cents), paymentMethodLabel(p.method), p.reference ?? '']);
  return toCsv(['paid_on', 'invoice_number', 'customer', 'amount', 'method', 'reference'], rows);
}

export function expensesCsv(data: YearData): string {
  const labels = vehicleLabels(data.vehicles);
  const rows = [...data.expenses]
    .filter((e) => inYear(e.spent_on, data.fy))
    .sort((a, b) => a.spent_on.localeCompare(b.spent_on))
    .map((e) => [
      e.spent_on,
      categoryLabel(e.category),
      e.vehicle_id ? (labels[e.vehicle_id] ?? '') : '',
      e.supplier ?? '',
      e.description ?? '',
      paymentMethodLabel(e.payment_method),
      amount(e.amount_cents),
      e.receipt_path ? receiptFileName(e) : '',
    ]);
  return toCsv(['date', 'category', 'vehicle', 'supplier', 'note', 'method', 'amount', 'receipt_file'], rows);
}

export function packReadme(data: YearData, generatedAt: Date, r = yearReportOf(data), skipped: string[] = []): string {
  const s = data.settings;
  const lines = [
    `${s.trading_name}: records for the ${data.fy.label} tax year`,
    `Period: ${formatDate(data.fy.start)} to ${formatDate(data.fy.end)} (${data.fy.start} to ${data.fy.end})`,
    `Generated: ${generatedAt.toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' })} by EDRAM Admin`,
    '',
    'WHAT IS IN THIS FOLDER',
    '  summary.csv    Totals for the year: money received, invoiced, outstanding at year end,',
    '                 expenses by category and by vehicle, and received minus expenses.',
    '  invoices.csv   Every invoice issued in the year, void ones included, with what was paid.',
    '  payments.csv   Every payment received in the year (the date the money came in).',
    '  expenses.csv   Every expense dated in the year, with the file name of its receipt photo.',
    '  invoices/      A PDF of each invoice in invoices.csv, as issued.',
    '  receipts/      A photo of each expense receipt, named date_category_amount_id.jpg.',
    '',
    'HOW THE FIGURES ARE WORKED OUT',
    '  - Amounts are in South African rand (ZAR), written as plain decimals (1200.50).',
    '    Dates are written as year-month-day (2026-11-26).',
    '  - Income is counted when it was received (payments.csv). Invoiced totals and the',
    '    balance outstanding at year end are given too; your accountant decides the basis.',
    '  - The business is not VAT-registered: no amounts include VAT.',
    '  - Void invoices were cancelled. They keep their numbers so the sequence has no gaps,',
    '    and nothing is owed on them.',
    '  - Deleted expenses are not included here. They are kept in the full backup and the',
    '    audit log, as are all changes to financial records.',
    '',
    `TOTALS  received ${centsToDecimal(r.receivedCents)}  ·  invoiced ${centsToDecimal(r.invoicedCents)}  ·  expenses ${centsToDecimal(r.expensesCents)}  ·  received minus expenses ${centsToDecimal(r.netCents)}`,
    `COUNTS  ${r.invoiceCount} invoices (+${r.voidCount} void)  ·  ${r.paymentCount} payments  ·  ${r.expenseCount} expenses`,
  ];
  if (skipped.length) {
    lines.push('', 'MISSING FILES (could not be downloaded when this pack was made):', ...skipped.map((p) => `  ${p}`));
  }
  lines.push('', `Contact: ${s.phone} · ${s.email}`);
  return lines.join('\r\n') + '\r\n';
}

export interface PackDeps {
  /** PDF bytes for an issued or void invoice. */
  invoicePdf: (inv: InvoiceWithDetails) => Uint8Array;
  /** Receipt bytes from storage, or null if missing. */
  receipt: (path: string) => Promise<Uint8Array | null>;
}

/** Every file in the pack, in order. The README goes last so it can list anything missing. */
export function packEntries(data: YearData, deps: PackDeps): { root: string; entries: ZipEntry[] } {
  const root = packName(data.fy);
  const r = yearReportOf(data);
  const entries: ZipEntry[] = [
    { path: `${root}/summary.csv`, data: summaryCsv(data, r) },
    { path: `${root}/invoices.csv`, data: invoicesCsv(data) },
    { path: `${root}/payments.csv`, data: paymentsCsv(data) },
    { path: `${root}/expenses.csv`, data: expensesCsv(data) },
  ];
  for (const inv of data.invoices.filter((i) => inYear(i.issue_date, data.fy)).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))) {
    entries.push({ path: `${root}/invoices/${invoiceFileName(inv.number!)}`, data: async () => deps.invoicePdf(inv) });
  }
  const missing: string[] = [];
  for (const e of data.expenses.filter((x) => x.receipt_path && inYear(x.spent_on, data.fy))) {
    const path = `${root}/receipts/${receiptFileName(e)}`;
    entries.push({
      path,
      data: async () => {
        const bytes = await deps.receipt(e.receipt_path!).catch(() => null);
        if (!bytes) missing.push(path.slice(root.length + 1));
        return bytes;
      },
    });
  }
  // Last, so it can list anything that couldn't be fetched
  entries.push({ path: `${root}/README.txt`, data: async () => new TextEncoder().encode(packReadme(data, new Date(), r, missing)) });
  return { root, entries };
}

function vehicleLabels(vehicles: Vehicle[]): Record<string, string> {
  return Object.fromEntries(vehicles.map((v) => [v.id, v.registration_plate ? `${v.label} (${v.registration_plate})` : v.label]));
}
