import { describe, expect, it } from 'vitest';
import { buildInvoicePdf, customerLines, invoiceTotals, sellerLines } from './invoicePdf';
import { sampleCustomer, sampleInvoice, sampleSettings } from './testFixtures';

// Uncompressed output keeps the text readable, so the tests can look for it.
function pdfText(input: Parameters<typeof buildInvoicePdf>[0]): string {
  return buildInvoicePdf({ ...input, compress: false }).output();
}

describe('buildInvoicePdf', () => {
  it('says INVOICE and never Tax Invoice or VAT', () => {
    const text = pdfText({ invoice: sampleInvoice(), vehicleLabels: { v1: '15 Seater #1' } });
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).not.toMatch(/tax invoice/i);
    expect(text).not.toMatch(/\bVAT\b/);
    for (const s of ['(INVOICE)', '(EDR-0001)', '(Mokoena Family)', '(15 Seater #1)', '(R 2 225,00)', '(Balance due)', 'as your payment reference.']) {
      expect(text).toContain(s);
    }
    expect(text).not.toContain('(PAID)');
  });

  it('stamps PAID with the date when fully paid, and VOID with the reason', () => {
    const pay = { id: 'p1', invoice_id: 'i1', amount_cents: 222500, paid_on: '2026-11-27', method: 'eft' as const, reference: null, notes: null, created_at: '' };
    const paid = pdfText({ invoice: sampleInvoice({ payments: [pay] }) });
    expect(paid).toContain('(PAID)');
    expect(paid).toContain('(27 Nov 2026)');
    const voided = pdfText({ invoice: sampleInvoice({ status: 'void', void_reason: 'Wrong customer', voided_at: '2026-11-27T10:00:00Z' }) });
    expect(voided).toContain('(VOID)');
    expect(voided).toContain('Wrong customer');
    expect(voided).not.toContain('(PAID)');
  });

  it('refuses drafts', () => {
    expect(() => buildInvoicePdf({ invoice: sampleInvoice({ status: 'draft', number: null, seq: null, issue_date: null }) })).toThrow();
  });

  it('builds paid, partly paid and void invoices without errors', () => {
    const pay = { id: 'p1', invoice_id: 'i1', amount_cents: 222500, method: 'eft' as const, reference: null, notes: null, created_at: '' };
    expect(() => buildInvoicePdf({ invoice: sampleInvoice({ payments: [{ ...pay, paid_on: '2026-11-27' }] }) })).not.toThrow();
    expect(() => buildInvoicePdf({ invoice: sampleInvoice({ payments: [{ ...pay, amount_cents: 1000, paid_on: '2026-11-27' }] }) })).not.toThrow();
    expect(() => buildInvoicePdf({ invoice: sampleInvoice({ status: 'void', void_reason: 'Wrong customer', voided_at: '2026-11-27T10:00:00Z' }) })).not.toThrow();
  });

  it('copes with many lines (more than one page)', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `l${i}`, invoice_id: 'i1', position: i, service_date: '2026-11-01', description: `School transport day ${i + 1}`, vehicle_id: null, quantity: 1, unit_price_cents: 10000, amount_cents: 10000,
    }));
    const doc = buildInvoicePdf({ invoice: sampleInvoice({ invoice_lines: many, total_cents: 600000 }) });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});

describe('invoiceTotals', () => {
  const pay = (amount: number, paid_on: string) => ({ id: paid_on, invoice_id: 'i1', amount_cents: amount, paid_on, method: 'cash' as const, reference: null, notes: null, created_at: '' });
  it('unpaid', () => {
    expect(invoiceTotals(sampleInvoice())).toEqual({ totalCents: 222500, paidCents: 0, balanceCents: 222500, paidOn: null });
  });
  it('partly paid has no paid date', () => {
    expect(invoiceTotals(sampleInvoice({ payments: [pay(100000, '2026-11-27')] })).paidOn).toBeNull();
  });
  it('fully paid uses the last payment date', () => {
    const t = invoiceTotals(sampleInvoice({ payments: [pay(200000, '2026-11-30'), pay(22500, '2026-11-28')] }));
    expect(t).toMatchObject({ paidCents: 222500, balanceCents: 0, paidOn: '2026-11-30' });
  });
  it('void invoices are never stamped paid', () => {
    expect(invoiceTotals(sampleInvoice({ status: 'void' })).paidOn).toBeNull();
  });
});

describe('address blocks', () => {
  it('seller block shows the entity when there is no registration number', () => {
    expect(sellerLines(sampleSettings)).toEqual([
      'EDRAM Shuttle and Tours', 'Sole proprietor', '299 12th Avenue', 'Lenora', 'Gezina', 'Pretoria', '081 215 3162', 'bookings@edramshuttle.co.za',
    ]);
    expect(sellerLines({ ...sampleSettings, entity_type: 'pty_ltd', legal_name: 'EDRAM Holdings (Pty) Ltd', registration_no: '2020/123456/07' }).slice(0, 3)).toEqual([
      'EDRAM Shuttle and Tours', 'EDRAM Holdings (Pty) Ltd', 'Reg. no. 2020/123456/07',
    ]);
  });
  it('customer block', () => {
    expect(customerLines(sampleCustomer)).toEqual(['Mokoena Family', 'Attn: Thabo Mokoena', '1 Example Street', 'Gezina', 'Pretoria', '082 000 0000', 'family@example.com']);
  });
});
