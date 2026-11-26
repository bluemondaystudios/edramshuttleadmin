// CSV for Excel (CLAUDE.md section 12): UTF-8 with a BOM, comma separated,
// amounts as plain decimals (1200.50), dates as ISO (2026-11-26).

export type Cell = string | number | boolean | null | undefined;

export const BOM = '﻿';

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Stop spreadsheet formula injection from text typed into the app (e.g. a supplier "=HYPERLINK(...)")
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A whole CSV file: BOM, header row, data rows, CRLF line endings (what Excel expects). */
export function toCsv(header: string[], rows: Cell[][]): string {
  return BOM + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
