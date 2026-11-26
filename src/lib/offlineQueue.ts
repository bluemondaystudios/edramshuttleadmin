// The expense queue (CLAUDE.md section 15, phase 2).
//
// Every expense is first saved on the phone (IndexedDB), then uploaded. With signal that
// takes a second; without, it waits and retries on the `online` event and on app start.
// The expense id is made on the phone, and the upload is "insert, or do nothing if that id
// already exists", so a retry after a lost response can never create a duplicate.

export interface ExpenseRow {
  id: string;
  spent_on: string;
  amount_cents: number;
  category: string;
  vehicle_id: string | null;
  supplier: string | null;
  description: string | null;
  payment_method: string;
  receipt_path: string | null;
}

export interface QueuedExpense {
  row: ExpenseRow;
  /** Compressed JPEG bytes (ArrayBuffer: Safari stores these more reliably than Blobs). */
  receipt: ArrayBuffer | null;
  receiptUploaded: boolean;
  queuedAt: string;
  attempts: number;
  lastError: string | null;
}

/** Minimal key-value store: idb-keyval in the app, a Map in tests. */
export interface QueueStore {
  get(key: string): Promise<QueuedExpense | undefined>;
  set(key: string, value: QueuedExpense): Promise<void>;
  del(key: string): Promise<void>;
  values(): Promise<QueuedExpense[]>;
}

export interface QueueUploader {
  uploadReceipt(path: string, bytes: ArrayBuffer): Promise<void>;
  insertExpenseOnce(row: ExpenseRow): Promise<void>;
}

export function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err);
  return /failed to fetch|network|load failed|offline|timed? ?out|ERR_INTERNET/i.test(msg);
}

export function createExpenseQueue(store: QueueStore, uploader: () => QueueUploader | null) {
  let items: QueuedExpense[] = [];
  let loaded = false;
  let syncing: Promise<void> | null = null;
  let again = false; // a sync was asked for while one was running
  let lastQueued = 0;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const sorted = (list: QueuedExpense[]) => [...list].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));

  async function load() {
    items = sorted(await store.values());
    loaded = true;
    emit();
  }

  async function save(item: QueuedExpense) {
    await store.set(item.row.id, item);
    items = sorted([...items.filter((i) => i.row.id !== item.row.id), item]);
    emit();
  }

  async function remove(id: string) {
    await store.del(id);
    items = items.filter((i) => i.row.id !== id);
    emit();
  }

  async function runSync() {
    const up = uploader();
    if (!up) return; // not signed in / no backend: try again later
    for (const item of sorted(await store.values())) {
      try {
        if (item.receipt && item.row.receipt_path && !item.receiptUploaded) {
          await up.uploadReceipt(item.row.receipt_path, item.receipt);
          item.receiptUploaded = true;
          await save(item);
        }
        await up.insertExpenseOnce(item.row);
        await remove(item.row.id);
      } catch (err) {
        item.attempts += 1;
        item.lastError = err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err);
        await save(item);
        if (isNetworkError(err)) break; // still offline: stop and wait for the next chance
      }
    }
  }

  return {
    load,
    /** Saves an expense on this phone, then tries to upload it straight away. */
    async add(row: ExpenseRow, receipt: ArrayBuffer | null) {
      // Strictly increasing timestamps keep the upload order the same as the save order
      const t = Math.max(Date.now(), lastQueued + 1);
      lastQueued = t;
      await save({ row, receipt, receiptUploaded: false, queuedAt: new Date(t).toISOString(), attempts: 0, lastError: null });
      void this.sync();
    },
    /** Uploads everything waiting. Safe to call any time; overlapping calls share one run. */
    sync(): Promise<void> {
      if (syncing) {
        again = true; // run once more when the current run ends, to pick up anything new
        return syncing;
      }
      syncing = (async () => {
        do {
          again = false;
          await runSync();
        } while (again);
      })().finally(() => {
        syncing = null;
      });
      return syncing;
    },
    discard: remove,
    items: () => items,
    isLoaded: () => loaded,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export type ExpenseQueue = ReturnType<typeof createExpenseQueue>;
