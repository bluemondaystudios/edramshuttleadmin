import { useNavigate } from 'react-router';
import { logExpense } from '../../lib/expensesApi';
import { PageHeader } from '../../ui/PageHeader';
import { ExpenseForm } from './ExpenseForm';

/** Works with or without signal: the expense is saved on the phone and uploaded when possible. */
export function LogExpensePage() {
  const navigate = useNavigate();
  return (
    <div className="page has-action-bar">
      <PageHeader title="Log expense" back="/expenses" sub="Works without signal too." />
      <ExpenseForm
        submitLabel="Save expense"
        canSave
        confirmWithoutPhoto
        onSubmit={async (values, photo) => {
          const id = await logExpense(values, photo);
          navigate('/expenses', { replace: true, state: { saved: id, offline: !navigator.onLine } });
        }}
      />
    </div>
  );
}
