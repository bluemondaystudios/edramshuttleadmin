import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { sampleInvoice } from '../pdf/testFixtures';
import { BACKUP_TABLES, backupEntries, type BackupData } from './backup';
import { buildZip } from './zip';

describe('backup', () => {
  it('contains every table, PDFs and receipts', async () => {
    const tables = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []])) as unknown as BackupData['tables'];
    tables.customers = [{ id: 'c1', name: 'Mokoena Family' }];
    tables.expenses = [
      { id: 'e1', receipt_path: '2026/11/e1.jpg', deleted_at: null },
      { id: 'e2', receipt_path: '2026/11/e2.jpg', deleted_at: '2026-11-27T00:00:00Z' }, // deleted expenses are backed up too
      { id: 'e3', receipt_path: null, deleted_at: null },
    ];
    tables.audit_log = [{ id: 1, table_name: 'customers', action: 'INSERT' }];
    const entries = backupEntries('EDRAM-backup-2026-11-26', { tables, invoices: [sampleInvoice()] }, {
      invoicePdf: () => new TextEncoder().encode('%PDF-1.3 fake'),
      receipt: async (p) => (p.includes('e2') ? null : new Uint8Array([1, 2, 3])),
    }, { generatedAt: new Date('2026-11-26T10:00:00Z'), appVersion: '0.4.0' });
    const { blob } = await buildZip(entries);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const root = 'EDRAM-backup-2026-11-26/';
    expect(Object.keys(files).sort()).toEqual([`${root}README.txt`, `${root}data.json`, `${root}invoices/EDR-0001.pdf`, `${root}receipts/2026/11/e1.jpg`]);
    const json = JSON.parse(strFromU8(files[`${root}data.json`]!));
    expect(json.format).toBe('edram-admin-backup');
    expect(Object.keys(json.tables).sort()).toEqual([...BACKUP_TABLES].sort());
    expect(json.tables.expenses).toHaveLength(3);
    expect(json.row_counts.customers).toBe(1);
    expect(strFromU8(files[`${root}README.txt`]!)).toContain('MISSING RECEIPTS');
  });
});
