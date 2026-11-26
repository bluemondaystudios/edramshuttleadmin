// An in-memory stand-in for the parts of Supabase the app uses (auth, PostgREST tables,
// views and RPCs), for clicking through the UI in a headless browser without a real project.
// It mirrors the database rules in supabase/migrations closely enough for UI testing;
// the real rules are tested by supabase/tests/db_tests.sql. Never used by the app itself.

const crypto = require('node:crypto');

function createFakeSupabase({ today }) {
  const user = { id: '00000000-0000-0000-0000-00000000000a', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const db = {
    business_settings: [{
      id: 1, trading_name: 'EDRAM Shuttle and Tours', legal_name: null, entity_type: null, registration_no: null, income_tax_no: null,
      address: '299 12th Avenue, Lenora, Gezina, Pretoria', phone: '081 215 3162', email: 'bookings@edramshuttle.co.za',
      bank_name: null, account_name: null, account_no: null, branch_code: null, account_type: null, invoice_prefix: 'EDR-',
      payment_terms_days: 7, invoice_footer: 'Reliable • Safe • On-Time • Professional', financial_year_start_month: 3, last_backup_at: null, updated_at: '2026-01-01T00:00:00Z',
    }],
    customers: [], vehicles: [], invoices: [], invoice_lines: [], payments: [], expenses: [],
  };
  let counter = 0;
  const now = () => new Date().toISOString();
  const uuid = () => crypto.randomUUID();
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  class DbError extends Error { constructor(message, status = 400, code = 'P0001') { super(message); this.status = status; this.code = code; } }

  const lineAmount = (q, p) => Math.round(q * p);
  const recalc = (invoiceId) => {
    const inv = db.invoices.find((i) => i.id === invoiceId);
    if (inv && inv.status === 'draft') inv.total_cents = db.invoice_lines.filter((l) => l.invoice_id === invoiceId).reduce((s, l) => s + l.amount_cents, 0);
  };
  const invStatus = (id) => db.invoices.find((i) => i.id === id)?.status;

  const views = {
    invoice_balances: () => db.invoices.map((i) => {
      const c = db.customers.find((x) => x.id === i.customer_id);
      const paid = db.payments.filter((p) => p.invoice_id === i.id).reduce((s, p) => s + p.amount_cents, 0);
      return {
        id: i.id, number: i.number, status: i.status, customer_id: i.customer_id, customer_name: i.customer_snapshot?.name ?? c?.name,
        issue_date: i.issue_date, due_date: i.due_date, total_cents: i.total_cents, paid_cents: paid, balance_cents: i.total_cents - paid,
        is_overdue: i.status === 'issued' && i.total_cents - paid > 0 && i.due_date < today,
      };
    }),
    ledger: () => [
      ...db.payments.map((p) => { const i = db.invoices.find((x) => x.id === p.invoice_id); return { entry_date: p.paid_on, kind: 'income', amount_cents: p.amount_cents, reference: i.number, party: i.customer_snapshot?.name, category: 'payment', method: p.method, receipt_path: null, source_id: p.id }; }),
      ...db.expenses.filter((e) => !e.deleted_at).map((e) => ({ entry_date: e.spent_on, kind: 'expense', amount_cents: e.amount_cents, reference: null, party: e.supplier, category: e.category, method: e.payment_method, receipt_path: e.receipt_path, source_id: e.id })),
    ],
  };

  const defaults = {
    customers: () => ({ id: uuid(), contact_person: null, phone: null, email: null, address: null, notes: null, archived: false, created_at: now(), updated_at: now() }),
    vehicles: () => ({ id: uuid(), registration_plate: null, seats: null, active: true, created_at: now() }),
    invoices: () => ({ id: uuid(), seq: null, number: null, status: 'draft', customer_snapshot: null, seller_snapshot: null, issue_date: null, due_date: null, notes: null, total_cents: 0, void_reason: null, voided_at: null, created_at: now(), updated_at: now() }),
    invoice_lines: () => ({ id: uuid(), position: 0, service_date: null, vehicle_id: null, quantity: 1 }),
    payments: () => ({ id: uuid(), paid_on: today, method: 'eft', reference: null, notes: null, created_at: now() }),
    expenses: () => ({ id: uuid(), spent_on: today, vehicle_id: null, supplier: null, description: null, payment_method: 'card', receipt_path: null, deleted_at: null, created_at: now(), updated_at: now() }),
  };
  const storage = new Map(); // 'bucket/path' -> { bytes: Buffer, contentType }

  // ---- query parsing ----
  function parseFilters(params) {
    const filters = [];
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset', 'columns'].includes(k)) continue;
      let neg = false; let rest = v;
      if (rest.startsWith('not.')) { neg = true; rest = rest.slice(4); }
      const dot = rest.indexOf('.');
      const op = rest.slice(0, dot); const val = rest.slice(dot + 1);
      filters.push((row) => {
        const x = row[k];
        let r;
        switch (op) {
          case 'eq': r = String(x) === val; break;
          case 'neq': r = String(x) !== val; break;
          case 'gt': r = Number(x) > Number(val) || (typeof x === 'string' && x > val); break;
          case 'gte': r = typeof x === 'number' ? x >= Number(val) : String(x) >= val; break;
          case 'lte': r = typeof x === 'number' ? x <= Number(val) : String(x) <= val; break;
          case 'lt': r = typeof x === 'number' ? x < Number(val) : String(x) < val; break;
          case 'is': r = val === 'null' ? x === null || x === undefined : String(x) === val; break;
          default: throw new DbError(`fake: unsupported operator ${op}`);
        }
        return neg ? !r : r;
      });
    }
    return filters;
  }
  function applyOrder(rows, order) {
    if (!order) return rows;
    const keys = order.split(',').map((o) => { const [col, ...mods] = o.split('.'); return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') }; });
    return [...rows].sort((a, b) => {
      for (const { col, desc, nullsFirst } of keys) {
        const x = a[col], y = b[col];
        if (x == null && y == null) continue;
        if (x == null) return nullsFirst ? -1 : 1;
        if (y == null) return nullsFirst ? 1 : -1;
        if (x < y) return desc ? 1 : -1;
        if (x > y) return desc ? -1 : 1;
      }
      return 0;
    });
  }
  function embed(rows, select) {
    if (!select) return rows;
    return rows.map((r) => {
      const out = { ...r };
      if (select.includes('invoice_lines(')) out.invoice_lines = db.invoice_lines.filter((l) => l.invoice_id === r.id).map((l) => ({ ...l }));
      if (select.includes('payments(')) out.payments = db.payments.filter((p) => p.invoice_id === r.id).map((p) => ({ ...p }));
      return out;
    });
  }
  const tableRows = (name) => (views[name] ? views[name]() : db[name]);

  // ---- rules (mirroring the migration's triggers) ----
  function beforeInsert(table, row) {
    if (table === 'invoices' && row.status !== 'draft') throw new DbError('New invoices must start as drafts');
    if (table === 'invoice_lines') {
      if (invStatus(row.invoice_id) !== 'draft') throw new DbError('Lines of an issued or void invoice cannot be changed');
      row.amount_cents = lineAmount(row.quantity, row.unit_price_cents);
    }
    if (table === 'payments' && invStatus(row.invoice_id) !== 'issued') throw new DbError('Payments can only be recorded against issued invoices');
  }
  function beforeUpdate(table, oldRow, patch) {
    if (table === 'invoices' && oldRow.status !== 'draft') throw new DbError(`Invoice ${oldRow.number} is ${oldRow.status}: it cannot be changed. Void it and issue a new one.`);
    if (table === 'invoices' && patch.status && patch.status !== 'draft') throw new DbError('Use issue_invoice() to issue an invoice');
  }
  function beforeDelete(table, row) {
    if (table === 'invoices' && row.status !== 'draft') return false; // RLS: silently 0 rows
    if (table === 'invoice_lines' && invStatus(row.invoice_id) && invStatus(row.invoice_id) !== 'draft') throw new DbError('Lines of an issued or void invoice cannot be changed');
    if (table === 'payments' && invStatus(row.invoice_id) !== 'issued') throw new DbError('Payments can only be recorded against issued invoices');
    if (table === 'expenses' || table === 'business_settings') return false;
    return true;
  }

  const rpc = {
    is_team_member: () => true,
    issue_invoice: ({ p_invoice_id, p_issue_date }) => {
      const inv = db.invoices.find((i) => i.id === p_invoice_id);
      if (!inv) throw new DbError('Invoice not found');
      if (inv.status !== 'draft') throw new DbError('Only drafts can be issued');
      if (!db.invoice_lines.some((l) => l.invoice_id === inv.id)) throw new DbError('Add at least one line before issuing');
      const s = db.business_settings[0];
      counter += 1;
      const date = p_issue_date ?? today;
      Object.assign(inv, {
        status: 'issued', seq: counter, number: s.invoice_prefix + String(counter).padStart(4, '0'), issue_date: date, due_date: addDays(date, s.payment_terms_days),
        customer_snapshot: { ...db.customers.find((c) => c.id === inv.customer_id) }, seller_snapshot: { ...s }, updated_at: now(),
      });
      return { ...inv };
    },
    void_invoice: ({ p_invoice_id, p_reason }) => {
      if (!p_reason || !p_reason.trim()) throw new DbError('A reason is required to void an invoice');
      if (db.payments.some((p) => p.invoice_id === p_invoice_id)) throw new DbError('This invoice has payments recorded. Remove them before voiding.');
      const inv = db.invoices.find((i) => i.id === p_invoice_id && i.status === 'issued');
      if (!inv) throw new DbError('Only issued invoices can be voided');
      Object.assign(inv, { status: 'void', void_reason: p_reason.trim(), voided_at: now() });
      return { ...inv };
    },
  };

  // ---- HTTP handler ----
  function handle({ method, url, headers, body, bodyBuffer }) {
    const u = new URL(url);
    const path = u.pathname;
    const json = (status, data) => ({ status, body: data === undefined ? '' : JSON.stringify(data) });
    try {
      // ---- Storage: upload (raw bytes), signed links, signed downloads ----
      const signGet = /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(path);
      if (method === 'GET' && signGet) {
        const obj = storage.get(`${signGet[1]}/${decodeURIComponent(signGet[2])}`);
        if (!obj) return json(404, { message: 'Object not found' });
        return { status: 200, body: obj.bytes, contentType: obj.contentType };
      }
      const signBatch = /^\/storage\/v1\/object\/sign\/([^/]+)$/.exec(path);
      if (method === 'POST' && signBatch) {
        const { paths } = JSON.parse(body);
        return json(200, paths.map((p) => (storage.has(`${signBatch[1]}/${p}`)
          ? { path: p, signedURL: `/object/sign/${signBatch[1]}/${p}?token=fake`, error: null }
          : { path: p, signedURL: null, error: 'Object not found' })));
      }
      const upload = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(path);
      if ((method === 'POST' || method === 'PUT') && upload) {
        const key = `${upload[1]}/${decodeURIComponent(upload[2])}`;
        if (storage.has(key) && method === 'POST' && headers['x-upsert'] !== 'true') return json(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
        storage.set(key, { bytes: bodyBuffer ?? Buffer.from(body ?? ''), contentType: headers['content-type'] || 'application/octet-stream' });
        return json(200, { Key: key, Id: uuid() });
      }

      if (path.startsWith('/auth/v1/token')) {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        return json(200, { access_token: 'fake.' + Buffer.from(JSON.stringify({ sub: user.id, exp })).toString('base64url') + '.sig', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user });
      }
      if (path.startsWith('/auth/v1/user')) return json(200, user);
      if (path.startsWith('/auth/v1/logout')) return json(204);
      if (!path.startsWith('/rest/v1/')) return json(404, { message: 'fake: not found' });

      const name = path.slice('/rest/v1/'.length);
      const single = (headers.accept || '').includes('vnd.pgrst.object');
      const wantRows = (headers.prefer || '').includes('return=representation') || u.searchParams.has('select');
      const finish = (rows) => {
        if (single) {
          if (rows.length !== 1) return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
          return json(200, rows[0]);
        }
        return json(200, rows);
      };

      if (name.startsWith('rpc/')) {
        const fn = rpc[name.slice(4)];
        if (!fn) return json(404, { message: `fake: no rpc ${name}` });
        const result = fn(body ? JSON.parse(body) : {});
        return single || typeof result !== 'object' ? json(200, result) : json(200, result);
      }

      const filters = parseFilters(u.searchParams);
      const select = u.searchParams.get('select');

      if (method === 'GET') {
        let rows = tableRows(name).filter((r) => filters.every((f) => f(r)));
        rows = applyOrder(rows, u.searchParams.get('order'));
        const limit = u.searchParams.get('limit');
        if (limit) rows = rows.slice(0, Number(limit));
        return finish(embed(rows.map((r) => ({ ...r })), select));
      }
      if (method === 'POST') {
        const input = JSON.parse(body);
        const list = Array.isArray(input) ? input : [input];
        const ignoreDup = (headers.prefer || '').includes('resolution=ignore-duplicates');
        const created = list.filter((r) => !(ignoreDup && r.id && db[name].some((x) => x.id === r.id))).map((r) => {
          const row = { ...(defaults[name]?.() ?? {}), ...r };
          beforeInsert(name, row);
          db[name].push(row);
          if (name === 'invoice_lines') recalc(row.invoice_id);
          return row;
        });
        return wantRows ? finish(created.map((r) => ({ ...r }))) : json(201);
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(body);
        const rows = db[name].filter((r) => filters.every((f) => f(r)));
        rows.forEach((r) => { beforeUpdate(name, r, patch); Object.assign(r, patch, 'updated_at' in r ? { updated_at: now() } : {}); });
        return wantRows ? finish(rows.map((r) => ({ ...r }))) : json(204);
      }
      if (method === 'DELETE') {
        const rows = db[name].filter((r) => filters.every((f) => f(r)));
        const deleted = rows.filter((r) => beforeDelete(name, r));
        db[name] = db[name].filter((r) => !deleted.includes(r));
        if (name === 'invoices') db.invoice_lines = db.invoice_lines.filter((l) => !deleted.some((d) => d.id === l.invoice_id));
        if (name === 'invoice_lines') new Set(deleted.map((d) => d.invoice_id)).forEach(recalc);
        return wantRows ? finish(deleted) : json(204);
      }
      return json(405, { message: 'fake: method not allowed' });
    } catch (err) {
      return json(err.status ?? 400, { message: err.message, code: err.code ?? 'P0001' });
    }
  }

  return { handle, db, user, storage };
}

module.exports = { createFakeSupabase };
