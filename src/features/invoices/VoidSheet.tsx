import { useState } from 'react';
import { useVoidInvoice } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { useOnline } from '../../lib/useOnline';
import { Sheet } from '../../ui/Sheet';
import { Field } from '../../ui/Field';

export function VoidSheet({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice: { id: string; number: string; paymentCount: number } }) {
  const online = useOnline();
  const voidInvoice = useVoidInvoice();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = reason.trim() === '';

  return (
    <Sheet open={open} onClose={onClose} title={`Void ${invoice.number}?`}>
      {invoice.paymentCount > 0 ? (
        <>
          <p>
            This invoice has {invoice.paymentCount === 1 ? 'a payment' : `${invoice.paymentCount} payments`} recorded, so it can't be voided.
          </p>
          <p className="muted">
            If the payment was recorded by mistake, remove it first (under Payments), then void the invoice. Removed payments stay in the audit log.
          </p>
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
            OK
          </button>
        </>
      ) : (
        <form
          className="form"
          noValidate
          onSubmit={async (ev) => {
            ev.preventDefault();
            setTouched(true);
            if (missing) return;
            try {
              await voidInvoice.mutateAsync({ id: invoice.id, reason: reason.trim() });
              onClose();
            } catch {
              // shown below
            }
          }}
        >
          <p>
            Voiding cancels the invoice. It keeps its number and stays in your records marked <strong>VOID</strong>, so there are no gaps. This can't be undone.
          </p>
          <Field id="void-reason" label="Reason" error={touched && missing ? 'Give a reason, e.g. "Wrong customer"' : undefined} hint="Printed on the voided invoice">
            <textarea id="void-reason" className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {voidInvoice.isError ? <p className="alert alert-error">{friendlyError(voidInvoice.error)}</p> : null}
          <div className="sheet-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Keep it
            </button>
            <button type="submit" className="btn btn-danger grow" disabled={!online || voidInvoice.isPending}>
              {voidInvoice.isPending ? 'Voiding…' : 'Void invoice'}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
