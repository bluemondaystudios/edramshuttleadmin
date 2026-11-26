import { centsToDecimal } from '../money';
import type { FinancialYear } from '../dates';

/** "EDRAM-records-2026-27" (folder inside the ZIP, and the ZIP's name without .zip). */
export function packName(fy: FinancialYear): string {
  return `EDRAM-records-${fy.slug}`;
}

/** "EDRAM-backup-2026-11-26" */
export function backupName(todayIso: string): string {
  return `EDRAM-backup-${todayIso}`;
}

/** receipts/2026-11-26_fuel_1200.50_<expense-id>.jpg (CLAUDE.md section 12). */
export function receiptFileName(e: { id: string; spent_on: string; category: string; amount_cents: number }): string {
  return `${e.spent_on}_${e.category}_${centsToDecimal(Number(e.amount_cents))}_${e.id}.jpg`;
}
