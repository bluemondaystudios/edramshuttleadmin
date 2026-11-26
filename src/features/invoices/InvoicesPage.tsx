import { EmptyState } from '../../ui/EmptyState';

export function InvoicesPage() {
  return (
    <div className="page">
      <div className="page-head">
        <h1>Invoices</h1>
      </div>
      <EmptyState icon="invoice" title="Invoicing is on its way">
        Creating, sending and tracking invoices is the next update. Your invoices will be listed here, newest first.
      </EmptyState>
    </div>
  );
}
