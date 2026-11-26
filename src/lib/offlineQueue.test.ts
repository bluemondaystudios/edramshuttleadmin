import { describe, expect, it } from 'vitest';
import { createExpenseQueue, type ExpenseRow, type QueueStore, type QueuedExpense } from './offlineQueue';

function memoryStore(): QueueStore & { map: Map<string, QueuedExpense> } {
  const map = new Map<string, QueuedExpense>();
  return {
    map,
    get: async (k) => (map.has(k) ? structuredClone(map.get(k)!) : undefined),
    set: async (k, v) => void map.set(k, structuredClone(v)),
    del: async (k) => void map.delete(k),
    values: async () => [...map.values()].map((v) => structuredClone(v)),
  };
}

/** A fake server: stores rows by id with "insert or ignore", and can be switched offline. */
function fakeServer() {
  const rows = new Map<string, ExpenseRow>();
  const files = new Map<string, number>();
  const s = {
    online: true,
    loseNextResponse: false,
    uploads: 0,
    inserts: 0,
    rows,
    files,
    uploader: {
      async uploadReceipt(path: string, bytes: ArrayBuffer) {
        if (!s.online) throw new TypeError('Failed to fetch');
        s.uploads++;
        files.set(path, bytes.byteLength);
      },
      async insertExpenseOnce(row: ExpenseRow) {
        if (!s.online) throw new TypeError('Failed to fetch');
        s.inserts++;
        if (!rows.has(row.id)) rows.set(row.id, row);
        if (s.loseNextResponse) {
          s.loseNextResponse = false;
          throw new TypeError('Failed to fetch'); // saved on the server, but the phone never heard back
        }
      },
    },
  };
  return s;
}

const row = (id: string, receipt = true): ExpenseRow => ({
  id, spent_on: '2026-11-26', amount_cents: 120050, category: 'fuel', vehicle_id: null, supplier: 'Engen', description: null,
  payment_method: 'card', receipt_path: receipt ? `2026/11/${id}.jpg` : null,
});

describe('expense queue', () => {
  it('uploads straight away when online', async () => {
    const store = memoryStore();
    const server = fakeServer();
    const q = createExpenseQueue(store, () => server.uploader);
    await q.load();
    await q.add(row('a'), new ArrayBuffer(10));
    await q.sync();
    expect(server.rows.size).toBe(1);
    expect(server.files.get('2026/11/a.jpg')).toBe(10);
    expect(store.map.size).toBe(0);
    expect(q.items()).toEqual([]);
  });

  it('keeps expenses on the phone while offline and uploads each exactly once later', async () => {
    const store = memoryStore();
    const server = fakeServer();
    server.online = false;
    const q = createExpenseQueue(store, () => server.uploader);
    await q.load();
    await q.add(row('a'), new ArrayBuffer(5));
    await q.add(row('b', false), null);
    await q.sync();
    expect(server.rows.size).toBe(0);
    expect(q.items().map((i) => i.row.id)).toEqual(['a', 'b']);
    expect(q.items()[0]!.lastError).toMatch(/fetch/);

    server.online = true;
    await Promise.all([q.sync(), q.sync(), q.sync()]); // e.g. 'online' event + app start at once
    await q.sync();
    expect([...server.rows.keys()].sort()).toEqual(['a', 'b']);
    expect(server.uploads).toBe(1);
    expect(q.items()).toEqual([]);
  });

  it('a retry after a lost response does not create a duplicate', async () => {
    const store = memoryStore();
    const server = fakeServer();
    server.loseNextResponse = true;
    const q = createExpenseQueue(store, () => server.uploader);
    await q.load();
    await q.add(row('a'), new ArrayBuffer(5)); // first try: saved on the server, but the reply is lost
    await q.sync(); // retry
    expect(server.rows.size).toBe(1);
    expect(server.inserts).toBe(2);
    expect(server.uploads).toBe(1); // the receipt isn't sent again once it got through
    expect(q.items()).toEqual([]);
  });

  it('survives an app restart (reloads from the store)', async () => {
    const store = memoryStore();
    const server = fakeServer();
    server.online = false;
    const q1 = createExpenseQueue(store, () => server.uploader);
    await q1.load();
    await q1.add(row('a'), new ArrayBuffer(5));
    await q1.sync();

    server.online = true;
    const q2 = createExpenseQueue(store, () => server.uploader); // a fresh app start
    await q2.load();
    expect(q2.items()).toHaveLength(1);
    await q2.sync();
    expect(server.rows.size).toBe(1);
    expect(q2.items()).toEqual([]);
  });

  it('keeps a rejected expense with its error and carries on with the rest', async () => {
    const store = memoryStore();
    const server = fakeServer();
    const realInsert = server.uploader.insertExpenseOnce;
    server.uploader.insertExpenseOnce = async (r) => {
      if (r.id === 'bad') throw new Error('new row violates check constraint');
      return realInsert(r);
    };
    const q = createExpenseQueue(store, () => server.uploader);
    await q.load();
    await q.add(row('bad', false), null);
    await q.add(row('good', false), null);
    await q.sync();
    expect([...server.rows.keys()]).toEqual(['good']);
    expect(q.items().map((i) => [i.row.id, i.attempts > 0, i.lastError])).toEqual([['bad', true, 'new row violates check constraint']]);
  });

  it('waits while signed out', async () => {
    const store = memoryStore();
    const q = createExpenseQueue(store, () => null);
    await q.load();
    await q.add(row('a', false), null);
    await q.sync();
    expect(q.items()).toHaveLength(1);
    expect(q.items()[0]!.attempts).toBe(0);
  });
});
