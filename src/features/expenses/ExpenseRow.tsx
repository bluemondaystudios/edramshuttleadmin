import { Link } from 'react-router';
import { categoryIcon, categoryLabel, type ExpenseCategory } from '../../lib/expenseCategories';
import { formatZAR } from '../../lib/money';
import { formatDate } from '../../lib/dates';
import { useQueuedReceiptUrl } from '../../lib/expensesApi';
import { isNetworkError } from '../../lib/offlineQueue';
import { Icon } from '../../ui/Icon';

export interface ExpenseListItem {
  id: string;
  spent_on: string;
  amount_cents: number;
  category: ExpenseCategory;
  supplier: string | null;
  vehicleLabel: string | null;
  thumbUrl: string | null;
  hasReceipt: boolean;
  queued?: { bytes: ArrayBuffer | null; lastError: string | null };
}

function QueuedThumb({ bytes }: { bytes: ArrayBuffer | null }) {
  const url = useQueuedReceiptUrl(bytes);
  return url ? <img className="thumb" src={url} alt="" /> : <span className="thumb thumb-empty" aria-hidden="true" />;
}

export function ExpenseRow({ item }: { item: ExpenseListItem }) {
  const sub = [formatDate(item.spent_on), item.supplier ? categoryLabel(item.category) : null, item.vehicleLabel].filter(Boolean).join(' · ');
  const failed = item.queued?.lastError && !isNetworkError(item.queued.lastError);
  return (
    <li>
      <Link to={`/expenses/${item.id}`} className="list-row">
        <span className="list-icon">
          <Icon name={categoryIcon(item.category)} />
        </span>
        <span className="list-main">
          <strong className="wrap">{item.supplier ?? categoryLabel(item.category)}</strong>
          <span className="muted small wrap">{sub}</span>
          {item.queued ? (
            <span className={`pill ${failed ? 'pill-red' : 'pill-amber'} pill-inline`}>
              <Icon name="clock" size={13} /> {failed ? 'Upload problem' : 'Waiting to upload'}
            </span>
          ) : !item.hasReceipt ? (
            <span className="muted small">No receipt photo</span>
          ) : null}
        </span>
        <span className="amount">{formatZAR(Number(item.amount_cents))}</span>
        {item.queued ? (
          <QueuedThumb bytes={item.queued.bytes} />
        ) : item.thumbUrl ? (
          <img className="thumb" src={item.thumbUrl} alt="" loading="lazy" />
        ) : (
          <span className="thumb thumb-empty" aria-hidden="true">
            {item.hasReceipt ? null : <Icon name="camera" size={18} />}
          </span>
        )}
      </Link>
    </li>
  );
}
