import { Link } from 'react-router';
import type { InvoiceBalance } from '../lib/types';
import { displayStatus } from '../lib/invoiceStatus';
import { formatZAR } from '../lib/money';
import { formatDate } from '../lib/dates';
import { StatusPill } from './StatusPill';

export function InvoiceRow({ row, to, showCustomer = true }: { row: InvoiceBalance; to?: string; showCustomer?: boolean }) {
  const status = displayStatus(row);
  const sub = [showCustomer ? row.customer_name : null, row.issue_date ? formatDate(row.issue_date) : 'Not issued yet'].filter(Boolean).join(' · ');
  return (
    <li>
      <Link to={to ?? (row.status === 'draft' ? `/invoices/${row.id}/edit` : `/invoices/${row.id}`)} className="list-row">
        <span className="list-main">
          <strong className={status === 'void' ? 'struck' : undefined}>{row.number ?? 'Draft'}</strong>
          <span className="muted small">{sub}</span>
        </span>
        <span className="list-side">
          <span className="amount">{formatZAR(Number(row.total_cents))}</span>
          <StatusPill status={status} />
          {status === 'partly_paid' || (status === 'overdue' && Number(row.paid_cents) > 0) ? (
            <span className="muted small">{formatZAR(Number(row.paid_cents))} paid</span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
