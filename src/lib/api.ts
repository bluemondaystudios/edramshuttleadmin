// All reads and writes to Supabase, wrapped in TanStack Query hooks.
// Business rules (numbering, frozen invoices, voids) are enforced by the database;
// these hooks only call it and keep the screens' caches fresh.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { requireSupabase } from './supabase';
import type { BusinessSettings, Customer, Invoice, InvoiceBalance, InvoiceLine, InvoiceWithDetails, Payment, PaymentMethod, Vehicle } from './types';

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

const BALANCE_COLUMNS = 'id, number, status, customer_id, customer_name, issue_date, due_date, total_cents, paid_cents, balance_cents, is_overdue';

/** Everything that shows money or invoice state goes stale together after a change. */
function invalidateMoney(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['invoices'] }),
    qc.invalidateQueries({ queryKey: ['invoice'] }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
    qc.invalidateQueries({ queryKey: ['customer-invoices'] }),
    qc.invalidateQueries({ queryKey: ['issued-count'] }),
  ]);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => check<BusinessSettings>(await requireSupabase().from('business_settings').select('*').eq('id', 1).single()),
    staleTime: 5 * 60_000,
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<BusinessSettings>) => {
      const { id: _id, updated_at: _u, last_backup_at: _b, ...rest } = patch;
      return check<BusinessSettings>(await requireSupabase().from('business_settings').update(rest).eq('id', 1).select('*').single());
    },
    onSuccess: (data) => qc.setQueryData(['settings'], data),
  });
}

/** How many invoices have ever been issued (the prefix is locked after the first). */
export function useIssuedCount() {
  return useQuery({
    queryKey: ['issued-count'],
    queryFn: async () => {
      const res = await requireSupabase().from('invoices').select('seq').not('seq', 'is', null).order('seq', { ascending: false }).limit(1);
      const rows = check<{ seq: number }[]>(res);
      return rows[0]?.seq ?? 0;
    },
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type CustomerInput = Pick<Customer, 'name' | 'contact_person' | 'phone' | 'email' | 'address' | 'notes'>;

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => check<Customer[]>(await requireSupabase().from('customers').select('*').order('name')),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    enabled: !!id,
    queryFn: async () => check<Customer>(await requireSupabase().from('customers').select('*').eq('id', id!).single()),
  });
}

export function useSaveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CustomerInput> & { id?: string; archived?: boolean }) => {
      const db = requireSupabase().from('customers');
      const res = id ? await db.update(input).eq('id', id).select('*').single() : await db.insert(input).select('*').single();
      return check<Customer>(res);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useCustomerInvoices(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-invoices', customerId],
    enabled: !!customerId,
    queryFn: async () =>
      check<InvoiceBalance[]>(
        await requireSupabase()
          .from('invoice_balances')
          .select(BALANCE_COLUMNS)
          .eq('customer_id', customerId!)
          .order('issue_date', { ascending: false, nullsFirst: true })
          .order('number', { ascending: false }),
      ),
  });
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export type VehicleInput = Pick<Vehicle, 'label' | 'registration_plate' | 'seats' | 'active'>;

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => check<Vehicle[]>(await requireSupabase().from('vehicles').select('*').order('label')),
    staleTime: 5 * 60_000,
  });
}

export function useSaveVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<VehicleInput> & { id?: string }) => {
      const db = requireSupabase().from('vehicles');
      const res = id ? await db.update(input).eq('id', id).select('*').single() : await db.insert(input).select('*').single();
      return check<Vehicle>(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}

/** The fleet from the website, to save typing on first use. */
export const STANDARD_FLEET: VehicleInput[] = [
  { label: '5 Seater SUV #1', seats: 5, registration_plate: null, active: true },
  { label: '5 Seater SUV #2', seats: 5, registration_plate: null, active: true },
  { label: '5 Seater SUV #3', seats: 5, registration_plate: null, active: true },
  { label: '7 Seater Van #1', seats: 7, registration_plate: null, active: true },
  { label: '7 Seater Van #2', seats: 7, registration_plate: null, active: true },
  { label: '15 Seater Shuttle', seats: 15, registration_plate: null, active: true },
  { label: '22 Seater Coach', seats: 22, registration_plate: null, active: true },
];

export function useAddStandardFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => check<Vehicle[]>(await requireSupabase().from('vehicles').insert(STANDARD_FLEET).select('*')),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export function useInvoiceList() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () =>
      check<InvoiceBalance[]>(
        await requireSupabase()
          .from('invoice_balances')
          .select(BALANCE_COLUMNS)
          .order('issue_date', { ascending: false, nullsFirst: true })
          .order('number', { ascending: false }),
      ),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoice', id],
    enabled: !!id,
    queryFn: async () => {
      const inv = check<InvoiceWithDetails>(
        await requireSupabase().from('invoices').select('*, invoice_lines(*), payments(*)').eq('id', id!).single(),
      );
      inv.invoice_lines.sort((a, b) => a.position - b.position);
      inv.payments.sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at));
      return inv;
    },
  });
}

export interface DraftLineInput {
  description: string;
  service_date: string | null;
  vehicle_id: string | null;
  quantity: number;
  unit_price_cents: number;
}

export interface DraftInput {
  id?: string;
  customer_id: string;
  notes: string | null;
  lines: DraftLineInput[];
}

/** Creates or updates a draft, replacing its lines. Returns the invoice id. */
export async function saveDraft(input: DraftInput): Promise<string> {
  const db = requireSupabase();
  let id = input.id;
  if (id) {
    check(await db.from('invoices').update({ customer_id: input.customer_id, notes: input.notes }).eq('id', id).eq('status', 'draft').select('id').single());
    check(await db.from('invoice_lines').delete().eq('invoice_id', id));
  } else {
    const created = check<Pick<Invoice, 'id'>>(await db.from('invoices').insert({ customer_id: input.customer_id, notes: input.notes }).select('id').single());
    id = created.id;
  }
  if (input.lines.length > 0) {
    const rows = input.lines.map((l, i) => ({ ...l, invoice_id: id, position: i + 1 }));
    check(await db.from('invoice_lines').insert(rows));
  }
  return id;
}

export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveDraft,
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draft, issueDate }: { draft: DraftInput; issueDate: string }) => {
      const id = await saveDraft(draft);
      return check<Invoice>(await requireSupabase().rpc('issue_invoice', { p_invoice_id: id, p_issue_date: issueDate }).single());
    },
    onSettled: () => invalidateMoney(qc),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      check<Invoice>(await requireSupabase().rpc('void_invoice', { p_invoice_id: id, p_reason: reason }).single()),
    onSettled: () => invalidateMoney(qc),
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await requireSupabase().from('invoices').delete().eq('id', id).eq('status', 'draft').select('id');
      const rows = check<{ id: string }[]>(res);
      if (rows.length === 0) throw new Error('Only drafts can be deleted.');
    },
    onSuccess: () => invalidateMoney(qc),
  });
}

/** Copies an invoice's customer, notes and lines into a new draft. Returns the new id. */
export function useDuplicateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inv: InvoiceWithDetails) =>
      saveDraft({
        customer_id: inv.customer_id,
        notes: inv.notes,
        lines: inv.invoice_lines.map((l: InvoiceLine) => ({
          description: l.description,
          service_date: null, // a new trip will have a new date
          vehicle_id: l.vehicle_id,
          quantity: Number(l.quantity),
          unit_price_cents: Number(l.unit_price_cents),
        })),
      }),
    onSuccess: () => invalidateMoney(qc),
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface PaymentInput {
  invoice_id: string;
  paid_on: string;
  amount_cents: number;
  method: PaymentMethod;
  reference: string | null;
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PaymentInput) => check<Payment>(await requireSupabase().from('payments').insert(input).select('*').single()),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      check(await requireSupabase().from('payments').delete().eq('id', id));
    },
    onSuccess: () => invalidateMoney(qc),
  });
}
