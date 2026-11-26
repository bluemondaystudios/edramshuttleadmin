import { EmptyState } from '../../ui/EmptyState';

export function ExpensesPage() {
  return (
    <div className="page">
      <div className="page-head">
        <h1>Expenses</h1>
      </div>
      <EmptyState icon="receipt" title="Expenses are coming soon">
        You'll be able to snap a receipt and log an expense in a few seconds. They'll be grouped by month here.
      </EmptyState>
    </div>
  );
}
