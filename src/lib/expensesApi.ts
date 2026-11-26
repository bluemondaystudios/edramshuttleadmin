import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStore, del, get, set, values } from 'idb-keyval';
import { requireSupabase, supabase } from './supabase';
import { createExpenseQueue, type ExpenseRow, type QueuedExpense } from './offlineQueue';
import type { ExpenseCategory } from './expenseCategories';
import type { PaymentMethod } from './types';
import { receiptPath } from './receipts';

export interface Expense {
  id: string;
  spent_on: string;
  amount_cents: number;
  category: ExpenseCategory;
  vehicle_id: string | null;
  supplier: string | null;
  description: string | null;
  payment_method: PaymentMethod;
  receipt_path: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// The queue (one per app), stored in IndexedDB
// ---------------------------------------------------------------------------

const idb = typeof indexedDB !== 'undefined' ? createStore('edram-admin', 'expense-queue') : undefined;

async function uploadReceipt(path: string, bytes: ArrayBuffer) {
  // Raw bytes with upsert: a retried upload simply replaces the same file
  const { error } = await requireSupabase().storage.from('receipts').upload(path, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
  if (error) throw error;
}

export const expenseQueue = createExpenseQueue(
  {
    get: (k) => get(k, idb),
    set: (k, v) => set(k, v, idb),
    del: (k) => del(k, idb),
    values: () => values<QueuedExpense>(idb),
  },
  () =>
    supabase
      ? {
          uploadReceipt,
          async insertExpenseOnce(row: ExpenseRow) {
            // "insert, or do nothing if this id is already there": retries can't duplicate
            const { error } = await requireSupabase().from('expenses').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
            if (error) throw error;
          },
        }
      : null,
);

export function useExpenseQueue(): QueuedExpense[] {
  return useSyncExternalStore(expenseQueue.subscribe, expenseQueue.items, expenseQueue.items);
}

/**
 * Mounted once while signed in: loads the queue, uploads on start, whenever the phone
 * comes back online or the app comes back to the front, and refreshes lists after uploads.
 */
export function useExpenseSync() {
  const qc = useQueryClient();
  const items = useExpenseQueue();
  const prev = useRef(items.length);

  useEffect(() => {
    const go = () => void expenseQueue.sync();
    void expenseQueue.load().then(go);
    const onVisible = () => document.visibilityState === 'visible' && go();
    window.addEventListener('online', go);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => navigator.onLine && expenseQueue.items().length > 0 && go(), 60_000);
    return () => {
      window.removeEventListener('online', go);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (items.length < prev.current) {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    }
    prev.current = items.length;
  }, [items.length, qc]);
}

/** New expense: made on the phone (id included) and handed to the queue. */
export async function logExpense(input: Omit<ExpenseRow, 'id' | 'receipt_path'>, receipt: Blob | null): Promise<string> {
  const id = crypto.randomUUID();
  const row: ExpenseRow = { ...input, id, receipt_path: receipt ? receiptPath(id, input.spent_on) : null };
  await expenseQueue.add(row, receipt ? await receipt.arrayBuffer() : null);
  return id;
}

// ---------------------------------------------------------------------------
// Expenses on the server
// ---------------------------------------------------------------------------

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('expenses')
        .select('*')
        .is('deleted_at', null)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: ['expenses', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('expenses').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Expense | null;
    },
  });
}

export type ExpenseEdit = Pick<Expense, 'spent_on' | 'amount_cents' | 'category' | 'vehicle_id' | 'supplier' | 'description' | 'payment_method'>;

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, newReceipt }: { id: string; patch: Partial<ExpenseEdit> & { deleted_at?: string }; newReceipt?: { blob: Blob; spentOn: string; existingPath: string | null } }) => {
      const update: Record<string, unknown> = { ...patch };
      if (newReceipt) {
        // Keep the same file name when replacing, so the old photo is overwritten rather than orphaned
        const path = newReceipt.existingPath ?? receiptPath(id, newReceipt.spentOn);
        await uploadReceipt(path, await newReceipt.blob.arrayBuffer());
        update.receipt_path = path;
      }
      const { data, error } = await requireSupabase().from('expenses').update(update).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['expenses'] }), qc.invalidateQueries({ queryKey: ['dashboard'] }), qc.invalidateQueries({ queryKey: ['receipt-urls'] })]);
    },
  });
}

/** Short-lived links to private receipt photos, fetched in one request. */
export function useReceiptUrls(paths: string[]) {
  const key = useMemo(() => [...new Set(paths)].sort(), [paths]);
  return useQuery({
    queryKey: ['receipt-urls', key],
    enabled: key.length > 0,
    staleTime: 50 * 60_000, // links last an hour
    queryFn: async () => {
      const { data, error } = await requireSupabase().storage.from('receipts').createSignedUrls(key, 3600);
      if (error) throw error;
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl!])) as Record<string, string>;
    },
  });
}

/** Object URL for a queued (not yet uploaded) receipt; revoked automatically. */
export function useQueuedReceiptUrl(bytes: ArrayBuffer | null | undefined): string | null {
  const url = useMemo(() => (bytes ? URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' })) : null), [bytes]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}
