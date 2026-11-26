import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useCustomer, useCustomerInvoices, useSaveCustomer } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { formatZAR } from '../../lib/money';
import { toWhatsAppNumber } from '../../lib/phone';
import { useOnline } from '../../lib/useOnline';
import { PageHeader } from '../../ui/PageHeader';
import { Sheet } from '../../ui/Sheet';
import { InvoiceRow } from '../../ui/InvoiceRow';
import { EmptyState } from '../../ui/EmptyState';
import { CustomerForm } from './CustomerForm';

export function CustomerDetail() {
  const { id } = useParams();
  const online = useOnline();
  const q = useCustomer(id);
  const invoices = useCustomerInvoices(id);
  const save = useSaveCustomer();
  const [editing, setEditing] = useState(false);
  const c = q.data;

  if (q.isError) return <p className="alert alert-error">Couldn't load this customer. {friendlyError(q.error)}</p>;
  if (!c) return <div className="page" aria-busy="true" />;

  const open = (invoices.data ?? []).filter((r) => r.status === 'issued');
  const owing = open.reduce((s, r) => s + Math.max(Number(r.balance_cents), 0), 0);
  const billed = open.reduce((s, r) => s + Number(r.total_cents), 0);
  const wa = c.phone ? toWhatsAppNumber(c.phone) : null;

  return (
    <div className="page">
      <PageHeader title={c.name} back="/customers" sub={c.archived ? 'Archived' : c.contact_person}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
          Edit
        </button>
      </PageHeader>

      <div className="tiles tiles-2">
        <div className={`tile card${owing > 0 ? ' tile-amber' : ''}`}>
          <span className="tile-label">Owing</span>
          <span className="tile-value">{formatZAR(owing)}</span>
        </div>
        <div className="tile card">
          <span className="tile-label">Billed (issued)</span>
          <span className="tile-value">{formatZAR(billed)}</span>
        </div>
      </div>

      <dl className="details card">
        {c.phone ? (
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${c.phone.replace(/\s+/g, '')}`}>{c.phone}</a>
              {wa ? (
                <>
                  {' · '}
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
        {c.email ? (
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${c.email}`}>{c.email}</a>
            </dd>
          </div>
        ) : null}
        {c.address ? (
          <div>
            <dt>Address</dt>
            <dd className="pre">{c.address}</dd>
          </div>
        ) : null}
        {c.notes ? (
          <div>
            <dt>Notes</dt>
            <dd className="pre">{c.notes}</dd>
          </div>
        ) : null}
        {!c.phone && !c.email && !c.address && !c.notes ? <p className="muted">No contact details yet.</p> : null}
      </dl>

      <section className="section">
        <div className="section-head">
          <h2>Invoices</h2>
          {!c.archived ? <Link to={`/invoices/new?customer=${c.id}`}>New invoice</Link> : null}
        </div>
        {invoices.data && invoices.data.length > 0 ? (
          <ul className="list card">
            {invoices.data.map((r) => (
              <InvoiceRow key={r.id} row={r} showCustomer={false} />
            ))}
          </ul>
        ) : invoices.data ? (
          <EmptyState icon="invoice" title="No invoices yet">
            Invoices for {c.name} will be listed here.
          </EmptyState>
        ) : null}
      </section>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={!online || save.isPending}
        onClick={() => save.mutate({ id: c.id, archived: !c.archived })}
      >
        {c.archived ? 'Restore customer' : 'Archive customer'}
      </button>
      <p className="muted small center">
        {c.archived ? 'Archived customers are hidden from lists and the invoice picker.' : "Archiving hides a customer you no longer serve. Their invoices are kept."}
      </p>
      {save.isError ? <p className="alert alert-error">{friendlyError(save.error)}</p> : null}

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit customer">
        {editing ? <CustomerForm customer={c} onSaved={() => setEditing(false)} /> : null}
      </Sheet>
    </div>
  );
}
