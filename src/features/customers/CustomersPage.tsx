import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCustomers } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { PageHeader } from '../../ui/PageHeader';
import { EmptyState } from '../../ui/EmptyState';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { CustomerForm } from './CustomerForm';

export function CustomersPage() {
  const q = useCustomers();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data ?? [])
      .filter((c) => showArchived || !c.archived)
      .filter((c) => !term || [c.name, c.contact_person, c.phone, c.email].some((v) => v?.toLowerCase().includes(term)));
  }, [q.data, search, showArchived]);
  const archivedCount = (q.data ?? []).filter((c) => c.archived).length;

  return (
    <div className="page">
      <PageHeader title="Customers" back="/more">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={20} /> Add
        </button>
      </PageHeader>

      {(q.data?.length ?? 0) > 0 ? (
        <input className="input search" type="search" placeholder="Search name, phone or email" aria-label="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
      ) : null}

      {q.isError ? <p className="alert alert-error">Couldn't load customers. {friendlyError(q.error)}</p> : null}

      {q.data && q.data.length === 0 ? (
        <EmptyState icon="users" title="No customers yet">
          Add the people and organisations you bill. You can also add a customer while creating an invoice.
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <ul className="list card">
          {rows.map((c) => (
            <li key={c.id}>
              <Link to={`/customers/${c.id}`} className="list-row">
                <span className="list-main">
                  <strong>{c.name}</strong>
                  <span className="muted small">{[c.contact_person, c.phone].filter(Boolean).join(' · ') || 'No contact details'}</span>
                </span>
                {c.archived ? <span className="pill pill-grey">Archived</span> : <Icon name="chevron" className="muted" />}
              </Link>
            </li>
          ))}
        </ul>
      ) : q.data && q.data.length > 0 ? (
        <p className="muted center">No customers match “{search}”.</p>
      ) : null}

      {archivedCount > 0 ? (
        <button type="button" className="btn btn-link" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Hide archived customers' : `Show archived customers (${archivedCount})`}
        </button>
      ) : null}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New customer">
        {adding ? (
          <CustomerForm
            onSaved={(c) => {
              setAdding(false);
              navigate(`/customers/${c.id}`);
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
