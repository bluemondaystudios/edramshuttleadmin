// Fetching a tax year's records (light: no PDF or ZIP code), shared by the Reports screen and the exports.

import { requireSupabase } from '../supabase';
import type { FinancialYear } from '../dates';
import type { BusinessSettings, InvoiceWithDetails, Vehicle } from '../types';
import { fetchAll } from './fetchAll';
import type { PackExpense, YearData } from './pack';

export async function settingsAndVehicles(): Promise<{ settings: BusinessSettings; vehicles: Vehicle[] }> {
  const db = requireSupabase();
  const [s, v] = await Promise.all([db.from('business_settings').select('*').eq('id', 1).single(), db.from('vehicles').select('*')]);
  if (s.error) throw s.error;
  if (v.error) throw v.error;
  return { settings: s.data as BusinessSettings, vehicles: v.data as Vehicle[] };
}

/** Issued and void invoices issued up to `until` (or all), with lines and payments. */
export async function fetchInvoices(until?: string): Promise<InvoiceWithDetails[]> {
  const db = requireSupabase();
  return fetchAll<InvoiceWithDetails>((from, to) => {
    let q = db.from('invoices').select('*, invoice_lines(*), payments(*)').neq('status', 'draft');
    if (until) q = q.lte('issue_date', until);
    return q.order('seq').range(from, to);
  });
}

export async function fetchYearData(fy: FinancialYear): Promise<YearData> {
  const db = requireSupabase();
  const [{ settings, vehicles }, invoices, expenses] = await Promise.all([
    settingsAndVehicles(),
    fetchInvoices(fy.end),
    fetchAll<PackExpense>((from, to) =>
      db.from('expenses').select('*').is('deleted_at', null).gte('spent_on', fy.start).lte('spent_on', fy.end).order('spent_on').order('id').range(from, to),
    ),
  ]);
  return { fy, settings, vehicles, invoices, expenses };
}

