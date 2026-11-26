import { displayStatus } from '../../lib/invoiceStatus';
import type { InvoiceBalance } from '../../lib/types';

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'void', label: 'Void' },
] as const;

export type FilterId = (typeof FILTERS)[number]['id'];

export function isFilterId(v: string | null): v is FilterId {
  return FILTERS.some((f) => f.id === v);
}

/** Does an invoice belong under a filter chip? "Unpaid" means anything still owing, overdue included. */
export function matchesFilter(row: InvoiceBalance, filter: FilterId): boolean {
  const s = displayStatus(row);
  switch (filter) {
    case 'all':
      return true;
    case 'unpaid':
      return s === 'unpaid' || s === 'partly_paid' || s === 'overdue';
    case 'overdue':
      return s === 'overdue';
    case 'paid':
      return s === 'paid';
    case 'drafts':
      return s === 'draft';
    case 'void':
      return s === 'void';
  }
}

/** Search by invoice number or customer name, ignoring case and spaces/dashes in numbers ("edr1" finds EDR-0001). */
export function matchesSearch(row: InvoiceBalance, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  if (row.customer_name.toLowerCase().includes(t)) return true;
  if (!row.number) return 'draft'.includes(t);
  const num = row.number.toLowerCase();
  const digits = t.replace(/\D/g, '');
  if (digits === '') return num.includes(t); // "edr" matches every EDR- number
  // With digits, compare the number itself: "1", "edr1" and "EDR-0001" all find EDR-0001 (but not EDR-0012).
  const letters = t.replace(/[^a-z]/g, '');
  return Number(num.replace(/\D/g, '')) === Number(digits) && num.replace(/[^a-z]/g, '').startsWith(letters);
}
