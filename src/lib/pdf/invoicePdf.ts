// Builds the invoice PDF on the device (CLAUDE.md section 10).
// Everything printed comes from the invoice's snapshots, so an old invoice always
// looks exactly as it did when it was issued.
// Never write "Tax Invoice" or VAT: the business is not VAT-registered.

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { BusinessSettings, Customer, InvoiceWithDetails } from '../types';
import { formatZAR, plainSpaces } from '../money';
import { formatDate } from '../dates';
import { formatQuantity, sumCents } from '../invoiceMath';

export interface InvoicePdfInput {
  invoice: InvoiceWithDetails;
  /** Vehicle id -> label, for the Vehicle column. */
  vehicleLabels?: Record<string, string>;
  /** PNG data URL of the van logo. Optional so the PDF can be built in tests. */
  logoDataUrl?: string;
  /** Compress the PDF streams (default true). Tests turn it off to read the text. */
  compress?: boolean;
}

const BLACK: [number, number, number] = [11, 11, 11];
const GREEN: [number, number, number] = [72, 154, 54];
const GREY: [number, number, number] = [107, 107, 107];
const RED: [number, number, number] = [197, 48, 48];
const LINE: [number, number, number] = [220, 222, 220];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 15; // margin

const money = (cents: number) => plainSpaces(formatZAR(cents));

const ENTITY: Record<string, string> = { sole_proprietor: 'Sole proprietor', pty_ltd: '(Pty) Ltd', other: '' };

/** Lines for the "From" block. */
export function sellerLines(s: BusinessSettings): string[] {
  const out = [s.trading_name];
  if (s.legal_name && s.legal_name !== s.trading_name) out.push(s.legal_name);
  if (s.registration_no) out.push(`Reg. no. ${s.registration_no}`);
  else if (s.entity_type && ENTITY[s.entity_type]) out.push(ENTITY[s.entity_type] as string);
  out.push(...splitAddress(s.address));
  if (s.phone) out.push(s.phone);
  if (s.email) out.push(s.email);
  return out;
}

/** Lines for the "Bill to" block. */
export function customerLines(c: Customer): string[] {
  const out = [c.name];
  if (c.contact_person) out.push(`Attn: ${c.contact_person}`);
  if (c.address) out.push(...splitAddress(c.address));
  if (c.phone) out.push(c.phone);
  if (c.email) out.push(c.email);
  return out;
}

function splitAddress(address: string): string[] {
  return address
    .split(/\n|,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Bank details for the payment box, only the ones that are filled in. */
export function bankLines(s: BusinessSettings): [string, string][] {
  const rows: [string, string | null][] = [
    ['Bank', s.bank_name],
    ['Account name', s.account_name],
    ['Account number', s.account_no],
    ['Branch code', s.branch_code],
    ['Account type', s.account_type],
  ];
  return rows.filter((r): r is [string, string] => !!r[1] && r[1].trim() !== '');
}

export interface PdfTotals {
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  /** Fully paid: the date of the last payment. */
  paidOn: string | null;
}

export function invoiceTotals(invoice: InvoiceWithDetails): PdfTotals {
  const paidCents = sumCents(invoice.payments.map((p) => Number(p.amount_cents)));
  const totalCents = Number(invoice.total_cents);
  const balanceCents = totalCents - paidCents;
  const fullyPaid = invoice.status === 'issued' && invoice.payments.length > 0 && balanceCents <= 0;
  const lastPayment = [...invoice.payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on)).at(-1);
  return { totalCents, paidCents, balanceCents, paidOn: fullyPaid && lastPayment ? lastPayment.paid_on : null };
}

export function buildInvoicePdf({ invoice, vehicleLabels = {}, logoDataUrl, compress = true }: InvoicePdfInput): jsPDF {
  if (invoice.status === 'draft' || !invoice.number || !invoice.issue_date) {
    throw new Error('Only issued or void invoices have a PDF');
  }
  const seller = invoice.seller_snapshot;
  const customer = invoice.customer_snapshot;
  if (!seller || !customer) throw new Error('This invoice is missing its issued details');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress });
  doc.setProperties({ title: `Invoice ${invoice.number}`, subject: `Invoice ${invoice.number}`, author: seller.trading_name, creator: 'EDRAM Admin' });
  const totals = invoiceTotals(invoice);

  // ---------- Header ----------
  let y = M;
  if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', M, y, 24, 15);
  const textX = logoDataUrl ? M + 28 : M;
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...BLACK);
  doc.text('EDRAM', textX, y + 8);
  doc.setFontSize(8).setTextColor(...GREEN);
  doc.text('SHUTTLE AND TOURS', textX, y + 13, { charSpace: 0.4 });

  doc.setFont('helvetica', 'bold').setFontSize(26).setTextColor(...BLACK);
  doc.text('INVOICE', PAGE_W - M, y + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(10);
  const meta: [string, string][] = [
    ['Invoice no.', invoice.number],
    ['Date', formatDate(invoice.issue_date)],
  ];
  if (invoice.due_date) meta.push(['Due', formatDate(invoice.due_date)]);
  meta.forEach(([label, value], i) => {
    const ly = y + 16 + i * 5;
    doc.setTextColor(...GREY).text(label, PAGE_W - M - 32, ly, { align: 'right' });
    doc.setTextColor(...BLACK).setFont('helvetica', 'bold').text(value, PAGE_W - M, ly, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  });

  y = M + 16 + meta.length * 5 + 3;
  doc.setDrawColor(...GREEN).setLineWidth(0.8).line(M, y, PAGE_W - M, y);
  y += 8;

  // ---------- From / Bill to ----------
  const colW = (PAGE_W - 2 * M - 10) / 2;
  const block = (title: string, lines: string[], x: number): number => {
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...GREY).text(title.toUpperCase(), x, y, { charSpace: 0.3 });
    let by = y + 5;
    lines.forEach((line, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal').setFontSize(i === 0 ? 11 : 9.5).setTextColor(...BLACK);
      const wrapped = doc.splitTextToSize(plainSpaces(line), colW) as string[];
      doc.text(wrapped, x, by);
      by += wrapped.length * (i === 0 ? 5 : 4.4);
    });
    return by;
  };
  const endFrom = block('From', sellerLines(seller), M);
  const endTo = block('Bill to', customerLines(customer), M + colW + 10);
  y = Math.max(endFrom, endTo) + 4;

  // ---------- Lines ----------
  const lines = [...invoice.invoice_lines].sort((a, b) => a.position - b.position);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Date', 'Description', 'Vehicle', 'Qty', 'Unit price', 'Amount']],
    body: lines.map((l) => [
      l.service_date ? formatDate(l.service_date) : '',
      plainSpaces(l.description),
      l.vehicle_id ? (vehicleLabels[l.vehicle_id] ?? '') : '',
      formatQuantity(Number(l.quantity)),
      money(Number(l.unit_price_cents)),
      money(Number(l.amount_cents)),
    ]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, textColor: BLACK, valign: 'top' },
    headStyles: { fillColor: BLACK, textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { lineColor: LINE, lineWidth: { bottom: 0.2 } },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 32 },
      3: { cellWidth: 12, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 27, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index >= 3) data.cell.styles.halign = 'right';
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ---------- Totals ----------
  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 25) {
      doc.addPage();
      y = M;
    }
  };
  ensureSpace(24);
  const labelX = PAGE_W - M - 40;
  const totalRows: [string, string, boolean][] = [
    ['Total', money(totals.totalCents), false],
    ['Paid', money(totals.paidCents), false],
    ['Balance due', money(invoice.status === 'void' ? 0 : Math.max(totals.balanceCents, 0)), true],
  ];
  const totalsTop = y;
  totalRows.forEach(([label, value, bold]) => {
    if (bold) {
      doc.setDrawColor(...BLACK).setLineWidth(0.3).line(labelX - 20, y - 4, PAGE_W - M, y - 4);
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 12 : 10).setTextColor(...(bold ? BLACK : GREY));
    doc.text(label, labelX, y, { align: 'right' });
    doc.setTextColor(...BLACK).text(value, PAGE_W - M, y, { align: 'right' });
    y += bold ? 8 : 6;
  });

  // ---------- Paid stamp (left of the totals, below the table) ----------
  if (totals.paidOn) {
    const angle = 8;
    const rad = (angle * Math.PI) / 180;
    const sx = M + 8;
    const sy = totalsTop + 15; // keeps the tilted box clear of the table above
    const rotate = ([bx, by]: [number, number]): [number, number] => [
      sx + bx * Math.cos(rad) + by * Math.sin(rad),
      sy - bx * Math.sin(rad) + by * Math.cos(rad),
    ];
    doc.setTextColor(...GREEN).setFont('helvetica', 'bold').setFontSize(30);
    doc.text('PAID', sx, sy, { angle });
    doc.setFontSize(10).text(formatDate(totals.paidOn), ...rotate([1, 7]), { angle });
    doc.setDrawColor(...GREEN).setLineWidth(1.1);
    const box = ([[-4, -13], [40, -13], [40, 10], [-4, 10]] as [number, number][]).map(rotate);
    for (let i = 0; i < 4; i++) {
      const a = box[i]!;
      const b = box[(i + 1) % 4]!;
      doc.line(a[0], a[1], b[0], b[1]);
    }
    y = Math.max(y, totalsTop + 28);
  }

  // ---------- Void notice (instead of the payment box) ----------
  if (invoice.status === 'void') {
    const reason = doc.splitTextToSize(
      `VOID: ${plainSpaces(invoice.void_reason ?? '')}${invoice.voided_at ? ` (voided ${formatDate(invoice.voided_at.slice(0, 10))})` : ''}`,
      PAGE_W - 2 * M - 10,
    ) as string[];
    const boxH = 11 + reason.length * 5;
    y += 2;
    ensureSpace(boxH + 4);
    doc.setDrawColor(...RED).setLineWidth(0.6).roundedRect(M, y, PAGE_W - 2 * M, boxH, 2, 2, 'S');
    doc.setTextColor(...RED).setFont('helvetica', 'bold').setFontSize(10).text(reason, M + 5, y + 6);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).text('This invoice was cancelled. Nothing is owed on it.', M + 5, y + 6 + reason.length * 5);
    y += boxH + 6;
  }

  // ---------- Payment box ----------
  y += 2;
  const bank = bankLines(seller);
  if (invoice.status !== 'void') {
    const boxH = 12 + Math.max(bank.length, 1) * 5 + 8;
    ensureSpace(boxH + 4);
    doc.setFillColor(243, 244, 243).setDrawColor(...LINE).setLineWidth(0.2).roundedRect(M, y, PAGE_W - 2 * M, boxH, 2, 2, 'FD');
    let py = y + 7;
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...BLACK).text('How to pay', M + 5, py);
    py += 6;
    doc.setFontSize(9.5);
    if (bank.length === 0) {
      doc.setFont('helvetica', 'normal').text(`Please contact us on ${seller.phone} for payment details.`, M + 5, py);
      py += 5;
    }
    bank.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal').setTextColor(...GREY).text(label, M + 5, py);
      doc.setTextColor(...BLACK).setFont('helvetica', 'bold').text(plainSpaces(value), M + 45, py);
      py += 5;
    });
    py += 1;
    doc.setFont('helvetica', 'normal').setTextColor(...BLACK).text('Please use ', M + 5, py);
    const w1 = doc.getTextWidth('Please use ');
    doc.setFont('helvetica', 'bold').text(invoice.number, M + 5 + w1, py);
    const w2 = doc.getTextWidth(invoice.number);
    doc.setFont('helvetica', 'normal').text(' as your payment reference.', M + 5 + w1 + w2, py);
    y += boxH + 6;
  }

  // ---------- Notes ----------
  if (invoice.notes && invoice.notes.trim()) {
    const wrapped = doc.splitTextToSize(plainSpaces(invoice.notes.trim()), PAGE_W - 2 * M) as string[];
    ensureSpace(8 + wrapped.length * 4.4);
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...GREY).text('NOTES', M, y, { charSpace: 0.3 });
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...BLACK).text(wrapped, M, y + 5);
    y += 8 + wrapped.length * 4.4;
  }

  // ---------- Void watermark (every page) ----------
  if (invoice.status === 'void') {
    for (let p = 1; p <= doc.getNumberOfPages(); p++) {
      doc.setPage(p);
      doc.saveGraphicsState();
      doc.setGState(doc.GState({ opacity: 0.18 }));
      doc.setTextColor(...RED).setFont('helvetica', 'bold').setFontSize(120);
      doc.text('VOID', 42, 215, { angle: 40 });
      doc.restoreGraphicsState();
    }
  }

  // ---------- Footer (every page) ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, PAGE_H - 20, PAGE_W - M, PAGE_H - 20);
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...GREEN);
    if (seller.invoice_footer) doc.text(plainSpaces(seller.invoice_footer), PAGE_W / 2, PAGE_H - 14, { align: 'center' });
    doc.setFont('helvetica', 'normal').setTextColor(...GREY).text('Thank you for travelling with EDRAM.', PAGE_W / 2, PAGE_H - 9, { align: 'center' });
    if (pages > 1) doc.setFontSize(8).text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 9, { align: 'right' });
  }

  return doc;
}

/** The PDF as a File, ready to share or download. */
export function invoicePdfFile(input: InvoicePdfInput, fileName: string): File {
  const blob = buildInvoicePdf(input).output('blob');
  return new File([blob], fileName, { type: 'application/pdf' });
}
