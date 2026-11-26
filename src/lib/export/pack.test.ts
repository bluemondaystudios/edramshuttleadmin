import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { financialYear } from '../dates';
import { sampleInvoice, sampleSettings } from '../pdf/testFixtures';
import { buildInvoicePdf } from '../pdf/invoicePdf';
import type { Payment, Vehicle } from '../types';
import { BOM } from './csv';
import { expensesCsv, invoicesCsv, packEntries, paymentsCsv, summaryCsv, type PackExpense, type YearData } from './pack';
import { buildZip } from './zip';

const fy = financialYear('2026-11-26');
const pay = (amount: number, paid_on: string): Payment => ({ id: paid_on, invoice_id: 'i1', paid_on, amount_cents: amount, method: 'eft', reference: 'EDR-0001', notes: null, created_at: '' });
const vehicles: Vehicle[] = [{ id: 'v1', label: '15 Seater Shuttle', registration_plate: 'AB 12 CD GP', seats: 15, active: true, created_at: '' }];
const expenses: PackExpense[] = [
  { id: 'f0000000-0000-0000-0000-000000000001', spent_on: '2026-11-26', amount_cents: 120050, category: 'fuel', vehicle_id: 'v1', supplier: 'Engen, Gezina', description: null, payment_method: 'card', receipt_path: '2026/11/f0000000-0000-0000-0000-000000000001.jpg' },
  { id: 'f0000000-0000-0000-0000-000000000002', spent_on: '2026-12-01', amount_cents: 9900, category: 'tolls', vehicle_id: null, supplier: 'SANRAL', description: null, payment_method: 'cash', receipt_path: null },
  { id: 'f0000000-0000-0000-0000-000000000003', spent_on: '2026-12-02', amount_cents: 5000, category: 'parking', vehicle_id: null, supplier: null, description: null, payment_method: 'cash', receipt_path: '2026/12/missing.jpg' },
];
const data: YearData = {
  fy,
  settings: sampleSettings,
  vehicles,
  expenses,
  invoices: [
    sampleInvoice({ id: 'i1', seq: 1, number: 'EDR-0001', payments: [pay(222500, '2026-11-27')] }),
    sampleInvoice({ id: 'i2', seq: 2, number: 'EDR-0002', status: 'void', void_reason: 'Wrong customer', voided_at: '2026-11-27T10:00:00Z' }),
    sampleInvoice({ id: 'i0', seq: 0, number: 'EDR-0000', issue_date: '2026-01-10', payments: [] }), // last year
  ],
};

describe('export pack CSVs', () => {
  it('summary', () => {
    const csv = summaryCsv(data);
    expect(csv.startsWith(BOM + 'item,amount,count\r\n')).toBe(true);
    expect(csv).toContain('Money received (payments dated in the year),2225.00,1');
    expect(csv).toContain('Expenses: Fuel,1200.50,1');
    expect(csv).toContain('Expenses by vehicle: 15 Seater Shuttle (AB 12 CD GP),1200.50,1');
    expect(csv).toContain('Received minus expenses,875.50,');
  });
  it('invoices: the year only, void included', () => {
    const csv = invoicesCsv(data);
    expect(csv).toContain('EDR-0001,issued,2026-11-26,2026-12-03,Mokoena Family,2225.00,2225.00,0.00,,EDR-0001.pdf');
    expect(csv).toContain('EDR-0002,issued'.replace('issued', 'void'));
    expect(csv).toContain('Wrong customer');
    expect(csv).not.toContain('EDR-0000');
  });
  it('payments', () => {
    expect(paymentsCsv(data)).toContain('2026-11-27,EDR-0001,Mokoena Family,2225.00,EFT,EDR-0001');
  });
  it('expenses with receipt file names; commas quoted', () => {
    const csv = expensesCsv(data);
    expect(csv).toContain('2026-11-26,Fuel,15 Seater Shuttle (AB 12 CD GP),"Engen, Gezina",,Card,1200.50,2026-11-26_fuel_1200.50_f0000000-0000-0000-0000-000000000001.jpg');
    expect(csv).toContain('2026-12-01,Tolls,,SANRAL,,Cash,99.00,');
  });
});

describe('export pack ZIP', () => {
  it('contains everything, in the agreed layout, and lists missing receipts', async () => {
    const { root, entries } = packEntries(data, {
      invoicePdf: (inv) => new Uint8Array(buildInvoicePdf({ invoice: inv }).output('arraybuffer')),
      receipt: async (path) => (path.includes('missing') ? null : new Uint8Array([0xff, 0xd8, 0xff, 0xd9])),
    });
    const progress: number[] = [];
    const { blob } = await buildZip(entries, (p) => progress.push(p.done));
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(root).toBe('EDRAM-records-2026-27');
    expect(Object.keys(files).sort()).toEqual(
      [
        'README.txt',
        'expenses.csv',
        'invoices.csv',
        'invoices/EDR-0001.pdf',
        'invoices/EDR-0002.pdf',
        'payments.csv',
        'receipts/2026-11-26_fuel_1200.50_f0000000-0000-0000-0000-000000000001.jpg',
        'summary.csv',
      ].map((f) => `${root}/${f}`),
    );
    expect(strFromU8(files[`${root}/invoices/EDR-0001.pdf`]!.subarray(0, 5))).toBe('%PDF-');
    const readme = strFromU8(files[`${root}/README.txt`]!);
    expect(readme).toContain('records for the 2026/27 tax year');
    expect(readme).toContain('1 Mar 2026 to 28 Feb 2027');
    expect(readme).toContain('MISSING FILES');
    expect(readme).toContain('receipts/2026-12-02_parking_50.00_f0000000-0000-0000-0000-000000000003.jpg');
    expect(progress.at(-1)).toBe(entries.length);
  });
});
