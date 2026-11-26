export type InvoiceStatus = 'draft' | 'issued' | 'void';

export interface InvoiceBalanceRow {
  status: InvoiceStatus;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  is_overdue: boolean | null;
}

export type DisplayStatus = 'draft' | 'unpaid' | 'overdue' | 'partly_paid' | 'paid' | 'void';

/** Which status pill an invoice shows (section 9 of CLAUDE.md). */
export function displayStatus(row: InvoiceBalanceRow): DisplayStatus {
  if (row.status === 'draft') return 'draft';
  if (row.status === 'void') return 'void';
  if (row.balance_cents <= 0) return 'paid';
  if (row.is_overdue) return 'overdue';
  if (row.paid_cents > 0) return 'partly_paid';
  return 'unpaid';
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: 'Draft',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
  partly_paid: 'Partly paid',
  paid: 'Paid',
  void: 'Void',
};

export const STATUS_TONE: Record<DisplayStatus, 'grey' | 'amber' | 'red' | 'green'> = {
  draft: 'grey',
  unpaid: 'amber',
  overdue: 'red',
  partly_paid: 'amber',
  paid: 'green',
  void: 'grey',
};
