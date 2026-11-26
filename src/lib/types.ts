// Row shapes as PostgREST returns them (see supabase/migrations/0001_init.sql).
// bigint and numeric columns arrive as JSON numbers.

export type InvoiceStatus = 'draft' | 'issued' | 'void';
export type PaymentMethod = 'eft' | 'cash' | 'card' | 'other';

export interface Customer {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  label: string;
  registration_plate: string | null;
  seats: number | null;
  active: boolean;
  created_at: string;
}

export interface BusinessSettings {
  id: 1;
  trading_name: string;
  legal_name: string | null;
  entity_type: 'sole_proprietor' | 'pty_ltd' | 'other' | null;
  registration_no: string | null;
  income_tax_no: string | null;
  address: string;
  phone: string;
  email: string;
  bank_name: string | null;
  account_name: string | null;
  account_no: string | null;
  branch_code: string | null;
  account_type: string | null;
  invoice_prefix: string;
  payment_terms_days: number;
  invoice_footer: string | null;
  financial_year_start_month: number;
  last_backup_at: string | null;
  updated_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  position: number;
  service_date: string | null;
  description: string;
  vehicle_id: string | null;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  paid_on: string;
  amount_cents: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  seq: number | null;
  number: string | null;
  status: InvoiceStatus;
  customer_id: string;
  customer_snapshot: Customer | null;
  seller_snapshot: BusinessSettings | null;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
  total_cents: number;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}

/** An invoice with its lines and payments embedded (one PostgREST request). */
export interface InvoiceWithDetails extends Invoice {
  invoice_lines: InvoiceLine[];
  payments: Payment[];
}

/** A row of the invoice_balances view. */
export interface InvoiceBalance {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  customer_id: string;
  customer_name: string;
  issue_date: string | null;
  due_date: string | null;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  is_overdue: boolean | null;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'eft', label: 'EFT' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export function paymentMethodLabel(m: PaymentMethod): string {
  return PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m;
}
