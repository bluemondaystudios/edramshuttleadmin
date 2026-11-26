// Example invoice data for tests and previews only. Made-up people; never real records.
import type { BusinessSettings, Customer, InvoiceWithDetails } from '../types';

export const sampleSettings: BusinessSettings = {
  id: 1,
  trading_name: 'EDRAM Shuttle and Tours',
  legal_name: null,
  entity_type: 'sole_proprietor',
  registration_no: null,
  income_tax_no: null,
  address: '299 12th Avenue, Lenora, Gezina, Pretoria',
  phone: '081 215 3162',
  email: 'bookings@edramshuttle.co.za',
  bank_name: 'Example Bank',
  account_name: 'EDRAM Shuttle and Tours',
  account_no: '0000000000',
  branch_code: '000000',
  account_type: 'Business cheque',
  invoice_prefix: 'EDR-',
  payment_terms_days: 7,
  invoice_footer: 'Reliable • Safe • On-Time • Professional',
  financial_year_start_month: 3,
  last_backup_at: null,
  updated_at: '2026-11-01T00:00:00Z',
};

export const sampleCustomer: Customer = {
  id: 'c1',
  name: 'Mokoena Family',
  contact_person: 'Thabo Mokoena',
  phone: '082 000 0000',
  email: 'family@example.com',
  address: '1 Example Street, Gezina, Pretoria',
  notes: null,
  archived: false,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};

export function sampleInvoice(overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
  return {
    id: 'i1',
    seq: 1,
    number: 'EDR-0001',
    status: 'issued',
    customer_id: 'c1',
    customer_snapshot: sampleCustomer,
    seller_snapshot: sampleSettings,
    issue_date: '2026-11-26',
    due_date: '2026-12-03',
    notes: 'Pick-up at 05:30 from Gezina.',
    total_cents: 222500,
    void_reason: null,
    voided_at: null,
    created_at: '2026-11-26T08:00:00Z',
    updated_at: '2026-11-26T08:00:00Z',
    invoice_lines: [
      { id: 'l1', invoice_id: 'i1', position: 1, service_date: '2026-11-25', description: 'Airport transfer – O.R. Tambo', vehicle_id: 'v1', quantity: 2, unit_price_cents: 85000, amount_cents: 170000 },
      { id: 'l2', invoice_id: 'i1', position: 2, service_date: '2026-11-25', description: 'Waiting time', vehicle_id: null, quantity: 1.5, unit_price_cents: 35000, amount_cents: 52500 },
    ],
    payments: [],
    ...overrides,
  };
}
