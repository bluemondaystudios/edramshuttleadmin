import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { expenseQueue, useExpense, useExpenseQueue, useQueuedReceiptUrl, useReceiptUrls, useUpdateExpense } from '../../lib/expensesApi';
import { friendlyError } from '../../lib/supabase';
import { formatZAR } from '../../lib/money';
import { formatDate } from '../../lib/dates';
import { categoryLabel, type ExpenseCategory } from '../../lib/expenseCategories';
import { isNetworkError } from '../../lib/offlineQueue';
import { useOnline } from '../../lib/useOnline';
import { PageHeader } from '../../ui/PageHeader';
import { ExpenseForm } from './ExpenseForm';

export function ExpenseDetail() {
  const { id } = useParams();
  const queued = useExpenseQueue().find((i) => i.row.id === id);
  const q = useExpense(queued ? undefined : id);
  if (queued) return <QueuedExpenseView item={queued} />;
  if (q.isError) return <p className="alert alert-error">Couldn't load this expense. {friendlyError(q.error)}</p>;
  if (q.data === undefined) return <div className="page" aria-busy="true" />;
  if (q.data === null || q.data.deleted_at) return <p className="alert alert-info">This expense was deleted. It's kept in your records but no longer counted.</p>;
  return <EditExpense key={q.data.id} expense={q.data} />;
}

function QueuedExpenseView({ item }: { item: ReturnType<typeof useExpenseQueue>[number] }) {
  const online = useOnline();
  const url = useQueuedReceiptUrl(item.receipt);
  const [busy, setBusy] = useState(false);
  const problem = item.lastError && !isNetworkError(item.lastError) ? item.lastError : null;
  return (
    <div className="page">
      <PageHeader title={item.row.supplier ?? categoryLabel(item.row.category as ExpenseCategory)} back="/expenses" sub={`${formatDate(item.row.spent_on)} · ${formatZAR(item.row.amount_cents)}`} />
      <p className={`alert ${problem ? 'alert-error' : 'alert-warn'}`}>
        {problem
          ? `This expense couldn't be uploaded: ${friendlyError({ message: problem })}`
          : "Saved on this phone and waiting to upload. It will go up by itself when there's signal."}
      </p>
      {url ? (
        <div className="receipt-preview card">
          <img src={url} alt="Receipt" />
        </div>
      ) : (
        <p className="muted">No receipt photo.</p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!online || busy}
        onClick={async () => {
          setBusy(true);
          await expenseQueue.sync();
          setBusy(false);
        }}
      >
        {busy ? 'Uploading…' : online ? 'Upload now' : 'Waiting for signal'}
      </button>
    </div>
  );
}

function EditExpense({ expense }: { expense: NonNullable<ReturnType<typeof useExpense>['data']> }) {
  const navigate = useNavigate();
  const online = useOnline();
  const update = useUpdateExpense();
  const urls = useReceiptUrls(expense.receipt_path ? [expense.receipt_path] : []);
  const [saved, setSaved] = useState(false);
  const receiptUrl = expense.receipt_path ? (urls.data?.[expense.receipt_path] ?? null) : null;

  return (
    <div className="page has-action-bar">
      <PageHeader title={expense.supplier ?? categoryLabel(expense.category)} back="/expenses" sub={`${formatDate(expense.spent_on)} · ${formatZAR(Number(expense.amount_cents))}`} />
      {saved ? (
        <p className="alert alert-info" role="status">
          Changes saved.
        </p>
      ) : null}
      {!online ? <p className="alert alert-warn">You're offline. Changes to an uploaded expense can be saved once you have signal.</p> : null}
      <ExpenseForm
        initial={{ ...expense, amount_cents: Number(expense.amount_cents) }}
        existingReceiptUrl={receiptUrl}
        submitLabel="Save changes"
        canSave={online}
        onSubmit={async (values, photo) => {
          await update.mutateAsync({
            id: expense.id,
            patch: values,
            newReceipt: photo ? { blob: photo, spentOn: values.spent_on, existingPath: expense.receipt_path } : undefined,
          });
          setSaved(true);
        }}
      >
        <button
          type="button"
          className="btn btn-link btn-danger-text"
          disabled={!online || update.isPending}
          onClick={async () => {
            if (!window.confirm("Delete this expense? It stops counting in your totals, but it's kept in your records (and its receipt photo is kept).")) return;
            try {
              await update.mutateAsync({ id: expense.id, patch: { deleted_at: new Date().toISOString() } });
              navigate('/expenses', { replace: true });
            } catch {
              // shown below
            }
          }}
        >
          Delete expense
        </button>
        {update.isError ? <p className="alert alert-error">{friendlyError(update.error)}</p> : null}
      </ExpenseForm>
    </div>
  );
}
