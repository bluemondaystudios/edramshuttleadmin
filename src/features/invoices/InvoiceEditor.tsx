import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCustomers, useDeleteDraft, useInvoice, useIssueInvoice, useIssuedCount, useSaveDraft, useSettings, useVehicles, type DraftInput } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { formatZAR, parseZAR, centsToDecimal } from '../../lib/money';
import { formatDate, todayISO } from '../../lib/dates';
import { formatInvoiceNumber, formatQuantity, lineAmountCents, parseQuantity } from '../../lib/invoiceMath';
import { useOnline } from '../../lib/useOnline';
import type { Customer, InvoiceWithDetails } from '../../lib/types';
import { PageHeader } from '../../ui/PageHeader';
import { ActionBar } from '../../ui/ActionBar';
import { Field } from '../../ui/Field';
import { MoneyInput } from '../../ui/MoneyInput';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { CustomerPicker } from './CustomerPicker';
import { LINE_PRESETS } from './presets';

const lineSchema = z.object({
  description: z.string().trim().min(1, 'Describe the service').max(500),
  service_date: z.string(),
  vehicle_id: z.string(),
  quantity: z.string().refine((v) => parseQuantity(v) !== null, 'Enter a quantity, e.g. 1 or 1.5'),
  unit_price: z.string().refine((v) => parseZAR(v) !== null, 'Enter a price, e.g. 850'),
});

const schema = z.object({
  customer_id: z.string().min(1, 'Choose who the invoice is for'),
  notes: z.string().max(2000),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
});

type FormValues = z.infer<typeof schema>;
type LineValues = FormValues['lines'][number];

const blankLine = (): LineValues => ({ description: '', service_date: todayISO(), vehicle_id: '', quantity: '1', unit_price: '' });

function toDraft(values: FormValues, id?: string): DraftInput {
  return {
    id,
    customer_id: values.customer_id,
    notes: values.notes.trim() || null,
    lines: values.lines.map((l) => ({
      description: l.description.trim(),
      service_date: l.service_date || null,
      vehicle_id: l.vehicle_id || null,
      quantity: parseQuantity(l.quantity)!,
      unit_price_cents: parseZAR(l.unit_price)!,
    })),
  };
}

function liveAmount(l: Partial<LineValues> | undefined): number {
  const q = parseQuantity(l?.quantity ?? '');
  const p = parseZAR(l?.unit_price ?? '');
  return q !== null && p !== null ? lineAmountCents(q, p) : 0;
}

/** Route wrapper: loads the draft (when editing) before showing the form. */
export function InvoiceEditorPage() {
  const { id } = useParams();
  const q = useInvoice(id);
  if (!id) return <InvoiceEditor key="new" />;
  if (q.isError) return <p className="alert alert-error">Couldn't load this invoice. {friendlyError(q.error)}</p>;
  if (!q.data) return <div className="page" aria-busy="true" />;
  if (q.data.status !== 'draft') return <Navigate to={`/invoices/${id}`} replace />;
  return <InvoiceEditor key={id} draft={q.data} />;
}

function InvoiceEditor({ draft }: { draft?: InvoiceWithDetails }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const online = useOnline();
  const customers = useCustomers();
  const vehicles = useVehicles();
  const settings = useSettings();
  const issuedCount = useIssuedCount();
  const saveDraft = useSaveDraft();
  const issue = useIssueInvoice();
  const del = useDeleteDraft();

  const [pickingCustomer, setPickingCustomer] = useState(false);
  const [presetFor, setPresetFor] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<FormValues | null>(null);
  const [justPicked, setJustPicked] = useState<Customer | null>(null);
  const justSaved = (location.state as { saved?: boolean } | null)?.saved === true;

  const { control, register, handleSubmit, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: draft
      ? {
          customer_id: draft.customer_id,
          notes: draft.notes ?? '',
          lines: draft.invoice_lines.map((l) => ({
            description: l.description,
            service_date: l.service_date ?? '',
            vehicle_id: l.vehicle_id ?? '',
            quantity: formatQuantity(Number(l.quantity)),
            unit_price: centsToDecimal(Number(l.unit_price_cents)),
          })),
        }
      : { customer_id: params.get('customer') ?? '', notes: '', lines: [blankLine()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = useWatch({ control, name: 'lines' });
  const customerId = useWatch({ control, name: 'customer_id' });
  const total = (watchedLines ?? []).reduce((s, l) => s + liveAmount(l), 0);
  const e = formState.errors;

  const customer = useMemo(
    () => (justPicked?.id === customerId ? justPicked : customers.data?.find((c) => c.id === customerId)),
    [customers.data, customerId, justPicked],
  );
  const activeVehicles = (vehicles.data ?? []).filter((v) => v.active || watchedLines?.some((l) => l.vehicle_id === v.id));
  const nextNumber = settings.data && issuedCount.data !== undefined ? formatInvoiceNumber(settings.data.invoice_prefix, issuedCount.data + 1) : 'this invoice';
  const busy = saveDraft.isPending || issue.isPending || del.isPending;
  const error = saveDraft.error ?? issue.error ?? del.error;

  const onSave = handleSubmit(async (values) => {
    const id = await saveDraft.mutateAsync(toDraft(values, draft?.id));
    navigate(`/invoices/${id}/edit`, { replace: true, state: { saved: true } });
  });

  const onIssue = handleSubmit((values) => setConfirming(values));

  const confirmIssue = async () => {
    if (!confirming) return;
    const inv = await issue.mutateAsync({ draft: toDraft(confirming, draft?.id), issueDate: todayISO() }).catch(() => null);
    setConfirming(null);
    if (inv) navigate(`/invoices/${inv.id}`, { replace: true, state: { justIssued: true } });
  };

  return (
    // Not a <form>: the customer sheet contains its own form, and forms can't be nested.
    <div className="page has-action-bar">
      <PageHeader title={draft ? 'Edit draft' : 'New invoice'} back="/invoices" sub="Drafts can be changed until they're issued." />

      {justSaved && !formState.isDirty ? (
        <p className="alert alert-info" role="status">
          Draft saved.
        </p>
      ) : null}

      <section className="section">
        <h2>Customer</h2>
        <button type="button" className={`picker card${e.customer_id ? ' has-error' : ''}`} onClick={() => setPickingCustomer(true)} aria-describedby={e.customer_id ? 'customer-error' : undefined}>
          {customer ? (
            <span className="list-main">
              <strong>{customer.name}</strong>
              <span className="muted small">{[customer.contact_person, customer.phone].filter(Boolean).join(' · ') || 'Tap to change'}</span>
            </span>
          ) : (
            <span className="list-main">
              <strong>Choose customer</strong>
              <span className="muted small">Or add a new one</span>
            </span>
          )}
          <Icon name="chevron" className="muted" />
        </button>
        {e.customer_id ? (
          <span className="error-text" id="customer-error" role="alert">
            {e.customer_id.message}
          </span>
        ) : null}
      </section>

      <section className="section">
        <h2>Lines</h2>
        {fields.map((f, i) => {
          const le = e.lines?.[i];
          return (
            <fieldset key={f.id} className="card line-card">
              <legend className="visually-hidden">Line {i + 1}</legend>
              <div className="line-head">
                <span className="muted small">Line {i + 1}</span>
                {fields.length > 1 ? (
                  <button type="button" className="btn btn-link btn-danger-text" onClick={() => remove(i)}>
                    Remove
                  </button>
                ) : null}
              </div>
              <Field id={`l${i}-desc`} label="Description" error={le?.description?.message}>
                <div className="input-with-btn">
                  <input id={`l${i}-desc`} className="input" autoComplete="off" placeholder="What was the trip or service?" {...register(`lines.${i}.description`)} />
                  <button type="button" className="btn btn-secondary" onClick={() => setPresetFor(i)}>
                    Pick
                  </button>
                </div>
              </Field>
              <div className="row-2">
                <Field id={`l${i}-date`} label="Service date">
                  <input id={`l${i}-date`} className="input" type="date" {...register(`lines.${i}.service_date`)} />
                </Field>
                <Field id={`l${i}-veh`} label="Vehicle">
                  <select id={`l${i}-veh`} className="input" {...register(`lines.${i}.vehicle_id`)}>
                    <option value="">None</option>
                    {activeVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="row-2">
                <Field id={`l${i}-qty`} label="Quantity" error={le?.quantity?.message}>
                  <input id={`l${i}-qty`} className="input" inputMode="decimal" autoComplete="off" {...register(`lines.${i}.quantity`)} />
                </Field>
                <Field id={`l${i}-price`} label="Unit price" error={le?.unit_price?.message}>
                  <MoneyInput id={`l${i}-price`} {...register(`lines.${i}.unit_price`)} />
                </Field>
              </div>
              <div className="line-amount">
                <span className="muted">Amount</span>
                <strong className="amount">{formatZAR(liveAmount(watchedLines?.[i]))}</strong>
              </div>
            </fieldset>
          );
        })}
        {e.lines?.root?.message || e.lines?.message ? <span className="error-text">{e.lines?.root?.message ?? e.lines?.message}</span> : null}
        <button type="button" className="btn btn-secondary btn-block" onClick={() => append(blankLine(), { shouldFocus: false })}>
          <Icon name="plus" size={20} /> Add line
        </button>
      </section>

      <section className="section">
        <Field id="notes" label="Notes on the invoice" optional hint="e.g. pick-up time or trip details">
          <textarea id="notes" className="input" rows={2} {...register('notes')} />
        </Field>
      </section>

      <div className="total-row card">
        <span>Total</span>
        <strong className="amount">{formatZAR(total)}</strong>
      </div>

      {error ? (
        <p className="alert alert-error" role="alert">
          {friendlyError(error)}
        </p>
      ) : null}

      {draft ? (
        <button
          type="button"
          className="btn btn-link btn-danger-text"
          disabled={!online || busy}
          onClick={async () => {
            if (!window.confirm('Delete this draft? It has no number yet, so nothing is lost from your records.')) return;
            try {
              await del.mutateAsync(draft.id);
              navigate('/invoices', { replace: true });
            } catch {
              // the error is shown above
            }
          }}
        >
          Delete draft
        </button>
      ) : null}

      <ActionBar>
        <button type="button" className="btn btn-secondary" disabled={!online || busy} onClick={() => void onSave()}>
          {saveDraft.isPending ? 'Saving…' : 'Save draft'}
        </button>
        <button type="button" className="btn btn-primary grow" disabled={!online || busy} onClick={() => void onIssue()}>
          Issue invoice
        </button>
      </ActionBar>

      <CustomerPicker
        open={pickingCustomer}
        onClose={() => setPickingCustomer(false)}
        onPick={(c) => {
          setJustPicked(c);
          setValue('customer_id', c.id, { shouldDirty: true, shouldValidate: formState.isSubmitted });
        }}
      />

      <Sheet open={presetFor !== null} onClose={() => setPresetFor(null)} title="Choose a service">
        <ul className="list card sheet-list">
          {LINE_PRESETS.map((p) => (
            <li key={p}>
              <button
                type="button"
                className="list-row"
                onClick={() => {
                  if (presetFor !== null) setValue(`lines.${presetFor}.description`, p, { shouldDirty: true, shouldValidate: formState.isSubmitted });
                  setPresetFor(null);
                }}
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">You can edit the description after picking, e.g. add the route.</p>
      </Sheet>

      <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title={`Issue ${nextNumber}?`}>
        <p>It can't be edited after this. If something is wrong later, you void it and issue a new one.</p>
        <dl className="details">
          <div>
            <dt>Customer</dt>
            <dd>{customer?.name ?? ''}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(todayISO())}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd className="amount">{formatZAR(confirming ? confirming.lines.reduce((s, l) => s + liveAmount(l), 0) : 0)}</dd>
          </div>
        </dl>
        {settings.data && !settings.data.account_no ? (
          <p className="alert alert-warn">Your bank details aren't set yet, so the invoice will ask the customer to phone for payment details. You can add them in More → Settings.</p>
        ) : null}
        <div className="sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)} disabled={issue.isPending}>
            Not yet
          </button>
          <button type="button" className="btn btn-primary grow" onClick={() => void confirmIssue()} disabled={!online || issue.isPending}>
            {issue.isPending ? 'Issuing…' : 'Issue invoice'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
