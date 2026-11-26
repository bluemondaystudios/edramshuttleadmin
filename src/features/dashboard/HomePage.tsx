import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { requireSupabase, friendlyError } from '../../lib/supabase';
import { formatZAR } from '../../lib/money';
import { formatDate, formatMonth, monthRange, todayISO } from '../../lib/dates';
import { displayStatus, type InvoiceBalanceRow } from '../../lib/invoiceStatus';
import { StatusPill } from '../../ui/StatusPill';
import { EmptyState } from '../../ui/EmptyState';

interface BalanceRow extends InvoiceBalanceRow {
  id: string;
  number: string | null;
  customer_name: string;
  issue_date: string | null;
  due_date: string | null;
}

const BALANCE_COLUMNS = 'id, number, status, customer_name, issue_date, due_date, total_cents, paid_cents, balance_cents, is_overdue';

async function sumLedger(kind: 'income' | 'expense', start: string, end: string): Promise<number> {
  const { data, error } = await requireSupabase()
    .from('ledger')
    .select('amount_cents')
    .eq('kind', kind)
    .gte('entry_date', start)
    .lte('entry_date', end);
  if (error) throw error;
  return (data as { amount_cents: number }[]).reduce((sum, r) => sum + Number(r.amount_cents), 0);
}

function useDashboard() {
  const today = todayISO();
  const { start, end } = monthRange(today);
  return useQuery({
    queryKey: ['dashboard', start],
    queryFn: async () => {
      const db = requireSupabase();
      const [received, spent, open, recent] = await Promise.all([
        sumLedger('income', start, end),
        sumLedger('expense', start, end),
        db.from('invoice_balances').select(BALANCE_COLUMNS).eq('status', 'issued').gt('balance_cents', 0).order('due_date'),
        db.from('invoice_balances').select(BALANCE_COLUMNS).order('issue_date', { ascending: false, nullsFirst: true }).limit(5),
      ]);
      if (open.error) throw open.error;
      if (recent.error) throw recent.error;
      const openRows = (open.data ?? []) as BalanceRow[];
      const overdue = openRows.filter((r) => r.is_overdue);
      return {
        received,
        spent,
        outstanding: openRows.reduce((s, r) => s + Number(r.balance_cents), 0),
        outstandingCount: openRows.length,
        overdue,
        overdueTotal: overdue.reduce((s, r) => s + Number(r.balance_cents), 0),
        recent: (recent.data ?? []) as BalanceRow[],
      };
    },
  });
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'red' }) {
  return (
    <div className={`tile card${tone ? ` tile-${tone}` : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub ? <span className="tile-sub">{sub}</span> : null}
    </div>
  );
}

function InvoiceRow({ row }: { row: BalanceRow }) {
  const status = displayStatus(row);
  return (
    <li>
      <Link to={`/invoices/${row.id}`} className="list-row">
        <span className="list-main">
          <strong className={status === 'void' ? 'struck' : undefined}>{row.number ?? 'Draft'}</strong>
          <span className="muted small">
            {row.customer_name}
            {row.issue_date ? ` · ${formatDate(row.issue_date)}` : ''}
          </span>
        </span>
        <span className="list-side">
          <span className="amount">{formatZAR(Number(row.total_cents))}</span>
          <StatusPill status={status} />
        </span>
      </Link>
    </li>
  );
}

export function HomePage() {
  const today = todayISO();
  const q = useDashboard();
  const d = q.data;
  const dash = '—';

  return (
    <div className="page">
      <div className="page-head">
        <h1>Home</h1>
        <p className="muted">{formatMonth(today)}</p>
      </div>

      {q.isError ? (
        <p className="alert alert-error" role="alert">
          Couldn't load your figures. {friendlyError(q.error)}
        </p>
      ) : null}

      <div className="tiles" aria-busy={q.isPending}>
        <Tile label="Received this month" value={d ? formatZAR(d.received) : dash} />
        <Tile
          label="Outstanding"
          value={d ? formatZAR(d.outstanding) : dash}
          sub={d ? `${d.outstandingCount} ${d.outstandingCount === 1 ? 'invoice' : 'invoices'}` : undefined}
        />
        <Tile
          label="Overdue"
          value={d ? String(d.overdue.length) : dash}
          sub={d && d.overdue.length > 0 ? formatZAR(d.overdueTotal) : d ? 'Nothing overdue' : undefined}
          tone={d && d.overdue.length > 0 ? 'red' : undefined}
        />
        <Tile label="Expenses this month" value={d ? formatZAR(d.spent) : dash} />
      </div>

      {d && d.overdue.length > 0 ? (
        <section className="section">
          <h2>Overdue</h2>
          <ul className="list card">
            {d.overdue.map((r) => (
              <InvoiceRow key={r.id} row={r} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h2>Recent invoices</h2>
          {d && d.recent.length > 0 ? <Link to="/invoices">See all</Link> : null}
        </div>
        {d && d.recent.length > 0 ? (
          <ul className="list card">
            {d.recent.map((r) => (
              <InvoiceRow key={r.id} row={r} />
            ))}
          </ul>
        ) : d ? (
          <EmptyState icon="invoice" title="No invoices yet">
            Your invoices will show up here. Tap <strong>＋</strong> to create one once invoicing is switched on.
          </EmptyState>
        ) : null}
      </section>
    </div>
  );
}
