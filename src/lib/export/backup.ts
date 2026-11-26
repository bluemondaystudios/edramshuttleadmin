// "Download everything" (CLAUDE.md section 13): every table as JSON, every receipt photo,
// and a PDF of every issued or void invoice. Supabase's free plan keeps no downloadable
// backups, so this ZIP is the business's own copy.

import type { InvoiceWithDetails } from '../types';
import { invoiceFileName } from '../share';
import type { ZipEntry } from './zip';

export const BACKUP_TABLES = ['business_settings', 'team_members', 'customers', 'vehicles', 'invoices', 'invoice_lines', 'payments', 'expenses', 'audit_log'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupData {
  tables: Record<BackupTable, Record<string, unknown>[]>;
  /** Issued and void invoices with lines and payments, for the PDFs. */
  invoices: InvoiceWithDetails[];
}

export interface BackupDeps {
  invoicePdf: (inv: InvoiceWithDetails) => Uint8Array;
  receipt: (path: string) => Promise<Uint8Array | null>;
}

export function backupEntries(root: string, data: BackupData, deps: BackupDeps, meta: { generatedAt: Date; appVersion: string }): ZipEntry[] {
  const receiptPaths = [...new Set(data.tables.expenses.map((e) => e.receipt_path).filter((p): p is string => typeof p === 'string' && p !== ''))].sort();
  const missing: string[] = [];
  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, data.tables[t].length]));
  const entries: ZipEntry[] = [
    {
      path: `${root}/data.json`,
      data: JSON.stringify({ format: 'edram-admin-backup', version: 1, generated_at: meta.generatedAt.toISOString(), app_version: meta.appVersion, row_counts: counts, tables: data.tables }, null, 2),
    },
  ];
  for (const inv of [...data.invoices].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))) {
    if (inv.number) entries.push({ path: `${root}/invoices/${invoiceFileName(inv.number)}`, data: async () => deps.invoicePdf(inv) });
  }
  for (const p of receiptPaths) {
    entries.push({
      path: `${root}/receipts/${p}`,
      data: async () => {
        const bytes = await deps.receipt(p).catch(() => null);
        if (!bytes) missing.push(p);
        return bytes;
      },
    });
  }
  entries.push({
    path: `${root}/README.txt`,
    data: async () =>
      new TextEncoder().encode(
        [
          'EDRAM Admin: full backup',
          `Made: ${meta.generatedAt.toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' })}`,
          '',
          '  data.json    Every record: business settings, customers, vehicles, invoices and their lines,',
          '               payments, expenses (deleted ones included) and the audit log of every change.',
          '               Amounts are in cents (222500 = R 2 225,00).',
          '  invoices/    A PDF of every issued and void invoice, as issued.',
          '  receipts/    Every receipt photo, in year/month folders, named by expense id',
          '               (the expense\'s receipt_path in data.json).',
          '',
          `Rows: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', ')}`,
          ...(missing.length ? ['', 'MISSING RECEIPTS (could not be downloaded):', ...missing.map((m) => `  ${m}`)] : []),
          '',
          'Keep this file somewhere safe that is not this phone, e.g. Google Drive or a computer.',
        ].join('\r\n') + '\r\n',
      ),
  });
  return entries;
}
