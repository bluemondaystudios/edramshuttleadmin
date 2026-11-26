import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRecordPayment } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { centsToDecimal, formatZAR, parseZAR } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { useOnline } from '../../lib/useOnline';
import { PAYMENT_METHODS, type PaymentMethod } from '../../lib/types';
import { Sheet } from '../../ui/Sheet';
import { Field } from '../../ui/Field';
import { MoneyInput } from '../../ui/MoneyInput';

const schema = z.object({
  amount: z.string().refine((v) => (parseZAR(v) ?? 0) > 0, 'Enter the amount received'),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date it was paid'),
  method: z.enum(['eft', 'cash', 'card', 'other']),
  reference: z.string().max(200),
});
type FormValues = z.infer<typeof schema>;

export function RecordPaymentSheet({
  open,
  onClose,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  invoice: { id: string; number: string; balanceCents: number };
}) {
  return (
    <Sheet open={open} onClose={onClose} title={`Payment for ${invoice.number}`}>
      {open ? <PaymentForm invoice={invoice} onDone={onClose} /> : null}
    </Sheet>
  );
}

function PaymentForm({ invoice, onDone }: { invoice: { id: string; number: string; balanceCents: number }; onDone: () => void }) {
  const online = useOnline();
  const record = useRecordPayment();
  const { register, handleSubmit, formState, control, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: invoice.balanceCents > 0 ? centsToDecimal(invoice.balanceCents) : '', paid_on: todayISO(), method: 'eft', reference: '' },
  });
  const amount = parseZAR(useWatch({ control, name: 'amount' }) ?? '') ?? 0;
  const method = useWatch({ control, name: 'method' });
  const e = formState.errors;

  return (
    <form
      className="form"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        await record.mutateAsync({
          invoice_id: invoice.id,
          amount_cents: parseZAR(v.amount)!,
          paid_on: v.paid_on,
          method: v.method,
          reference: v.reference.trim() || null,
        });
        onDone();
      })}
    >
      <p className="muted">Balance due: {formatZAR(invoice.balanceCents)}</p>
      <Field id="p-amount" label="Amount received" error={e.amount?.message}>
        <MoneyInput id="p-amount" {...register('amount')} />
      </Field>
      {amount > invoice.balanceCents && invoice.balanceCents >= 0 ? (
        <p className="alert alert-warn">That's {formatZAR(amount - invoice.balanceCents)} more than the balance. Check the amount before saving.</p>
      ) : null}
      <Field id="p-date" label="Date received" error={e.paid_on?.message}>
        <input id="p-date" className="input" type="date" max={todayISO()} {...register('paid_on')} />
      </Field>
      <div className="field">
        <span className="label" id="p-method-label">
          Method
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="p-method-label">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={method === m.value}
              className={`seg${method === m.value ? ' is-active' : ''}`}
              onClick={() => setValue('method', m.value as PaymentMethod)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <Field id="p-ref" label="Reference" optional hint="e.g. the bank reference the customer used">
        <input id="p-ref" className="input" autoComplete="off" {...register('reference')} />
      </Field>
      {record.isError ? <p className="alert alert-error">Couldn't save the payment. {friendlyError(record.error)}</p> : null}
      <button type="submit" className="btn btn-primary btn-block" disabled={!online || formState.isSubmitting}>
        {formState.isSubmitting ? 'Saving…' : 'Save payment'}
      </button>
    </form>
  );
}
