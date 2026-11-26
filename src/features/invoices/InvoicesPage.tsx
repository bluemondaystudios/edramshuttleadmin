import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useInvoiceList } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { PageHeader } from '../../ui/PageHeader';
import { EmptyState } from '../../ui/EmptyState';
import { InvoiceRow } from '../../ui/InvoiceRow';
import { Icon } from '../../ui/Icon';
import { FILTERS, isFilterId, matchesFilter, matchesSearch, type FilterId } from './invoiceFilters';

export function InvoicesPage() {
  const q = useInvoiceList();
  const [params, setParams] = useSearchParams();
  const filterParam = params.get('filter');
  const filter: FilterId = isFilterId(filterParam) ? filterParam : 'all';
  const forPayment = params.get('for') === 'payment';
  const [search, setSearch] = useState('');

  const rows = useMemo(() => (q.data ?? []).filter((r) => matchesFilter(r, filter) && matchesSearch(r, search)), [q.data, filter, search]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, (q.data ?? []).filter((r) => matchesFilter(r, f.id)).length])), [q.data]);

  return (
    <div className="page">
      <PageHeader title={forPayment ? 'Record a payment' : 'Invoices'}>
        {!forPayment ? (
          <Link to="/invoices/new" className="btn btn-primary btn-sm">
            <Icon name="plus" size={20} /> New
          </Link>
        ) : null}
      </PageHeader>

      {forPayment ? <p className="alert alert-info">Choose the invoice that was paid.</p> : null}

      <div className="chips" role="tablist" aria-label="Filter invoices">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`chip${filter === f.id ? ' is-active' : ''}`}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (f.id === 'all') next.delete('filter');
              else next.set('filter', f.id);
              setParams(next, { replace: true });
            }}
          >
            {f.label}
            {q.data && f.id !== 'all' && counts[f.id] ? <span className="chip-count">{counts[f.id]}</span> : null}
          </button>
        ))}
      </div>

      {(q.data?.length ?? 0) > 0 ? (
        <input className="input search" type="search" placeholder="Search number or customer" aria-label="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} />
      ) : null}

      {q.isError ? <p className="alert alert-error">Couldn't load invoices. {friendlyError(q.error)}</p> : null}

      {q.data && q.data.length === 0 ? (
        <EmptyState icon="invoice" title="No invoices yet">
          <p>Create your first invoice. It takes under a minute.</p>
          <Link to="/invoices/new" className="btn btn-primary">
            New invoice
          </Link>
        </EmptyState>
      ) : rows.length > 0 ? (
        <ul className="list card">
          {rows.map((r) => (
            <InvoiceRow key={r.id} row={r} to={forPayment ? `/invoices/${r.id}?pay=1` : undefined} />
          ))}
        </ul>
      ) : q.data ? (
        <p className="muted center">{search ? `No invoices match “${search}”.` : 'No invoices here.'}</p>
      ) : null}
    </div>
  );
}
