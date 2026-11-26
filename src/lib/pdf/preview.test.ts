// Writes sample PDFs for a visual check. Only runs with PDF_PREVIEW_DIR set:
//   PDF_PREVIEW_DIR=/some/dir npx vitest run src/lib/pdf/preview.test.ts
import { describe, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildInvoicePdf } from './invoicePdf';
import { sampleInvoice } from './testFixtures';

const dir = process.env.PDF_PREVIEW_DIR;

describe.skipIf(!dir)('PDF preview', () => {
  it('writes samples', () => {
    const logo = `data:image/png;base64,${readFileSync('src/assets/van-green.png').toString('base64')}`;
    const pay = { id: 'p1', invoice_id: 'i1', amount_cents: 222500, paid_on: '2026-11-27', method: 'eft' as const, reference: null, notes: null, created_at: '' };
    const v = { v1: '15 Seater #1' };
    const save = (name: string, inv: ReturnType<typeof sampleInvoice>) =>
      writeFileSync(`${dir}/${name}.pdf`, Buffer.from(buildInvoicePdf({ invoice: inv, vehicleLabels: v, logoDataUrl: logo }).output('arraybuffer')));
    save('unpaid', sampleInvoice());
    save('paid', sampleInvoice({ payments: [pay] }));
    save('void', sampleInvoice({ status: 'void', void_reason: 'Wrong customer', voided_at: '2026-11-27T10:00:00Z' }));
  });
});
