import { useRef, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { compressReceipt } from '../../lib/images';
import { parseZAR, centsToDecimal } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../../lib/expenseCategories';
import { useVehicles } from '../../lib/api';
import { PAYMENT_METHODS, type PaymentMethod } from '../../lib/types';
import { Field } from '../../ui/Field';
import { MoneyInput } from '../../ui/MoneyInput';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { ActionBar } from '../../ui/ActionBar';

const schema = z.object({
  amount: z.string().refine((v) => (parseZAR(v) ?? 0) > 0, 'Enter the amount on the slip'),
  category: z.string().min(1, 'Choose what it was for'),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date'),
  vehicle_id: z.string(),
  supplier: z.string().max(200),
  payment_method: z.enum(['eft', 'cash', 'card', 'other']),
  description: z.string().max(1000),
});
type FormValues = z.infer<typeof schema>;

export interface ExpenseFormResult {
  spent_on: string;
  amount_cents: number;
  category: ExpenseCategory;
  vehicle_id: string | null;
  supplier: string | null;
  description: string | null;
  payment_method: PaymentMethod;
}

export interface ExpenseFormProps {
  initial?: Partial<ExpenseFormResult>;
  /** URL of the receipt already on file, if any. */
  existingReceiptUrl?: string | null;
  submitLabel: string;
  /** Saving is possible (e.g. online, or always for new expenses that go to the queue). */
  canSave: boolean;
  /** Ask before saving without a photo (new expenses). */
  confirmWithoutPhoto?: boolean;
  onSubmit: (values: ExpenseFormResult, photo: Blob | null) => Promise<void>;
  children?: ReactNode;
}

export function ExpenseForm({ initial, existingReceiptUrl, submitLabel, canSave, confirmWithoutPhoto, onSubmit, children }: ExpenseFormProps) {
  const vehicles = useVehicles();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [askNoPhoto, setAskNoPhoto] = useState<FormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, control, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: initial?.amount_cents ? centsToDecimal(initial.amount_cents) : '',
      category: initial?.category ?? '',
      spent_on: initial?.spent_on ?? todayISO(),
      vehicle_id: initial?.vehicle_id ?? '',
      supplier: initial?.supplier ?? '',
      payment_method: initial?.payment_method ?? 'card',
      description: initial?.description ?? '',
    },
  });
  const category = useWatch({ control, name: 'category' });
  const method = useWatch({ control, name: 'payment_method' });
  const e = formState.errors;
  const amountReg = register('amount');
  const activeVehicles = (vehicles.data ?? []).filter((v) => v.active || v.id === initial?.vehicle_id);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const small = await compressReceipt(file);
      setPhoto(small);
      setPhotoUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(small);
      });
      // Next step is the amount: bring up the keypad
      setTimeout(() => amountRef.current?.focus(), 50);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhotoBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  }

  async function save(v: FormValues) {
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(
        {
          spent_on: v.spent_on,
          amount_cents: parseZAR(v.amount)!,
          category: v.category as ExpenseCategory,
          vehicle_id: v.vehicle_id || null,
          supplier: v.supplier.trim() || null,
          description: v.description.trim() || null,
          payment_method: v.payment_method,
        },
        photo,
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err));
    } finally {
      setSaving(false);
    }
  }

  const shownPhoto = photoUrl ?? existingReceiptUrl ?? null;

  return (
    <div className="form">
      {/* Receipt photo first: it's the record SARS cares about */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => void onPhoto(ev.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(ev) => void onPhoto(ev.target.files?.[0])} />
      {shownPhoto ? (
        <div className="receipt-preview card">
          <a href={shownPhoto} target="_blank" rel="noreferrer" aria-label="Open the receipt photo">
            <img src={shownPhoto} alt="Receipt" />
          </a>
          <div className="receipt-preview-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => cameraRef.current?.click()} disabled={photoBusy}>
              <Icon name="camera" size={18} /> {photoUrl ? 'Retake' : 'Replace photo'}
            </button>
            <button type="button" className="btn btn-link" onClick={() => galleryRef.current?.click()} disabled={photoBusy}>
              Choose from photos
            </button>
          </div>
        </div>
      ) : (
        <div className="snap">
          <button type="button" className="snap-btn" onClick={() => cameraRef.current?.click()} disabled={photoBusy}>
            <Icon name="camera" size={36} />
            <strong>{photoBusy ? 'Preparing photo…' : 'Snap receipt'}</strong>
          </button>
          <button type="button" className="btn btn-link" onClick={() => galleryRef.current?.click()} disabled={photoBusy}>
            Choose from photos instead
          </button>
        </div>
      )}
      {photoBusy && shownPhoto ? <p className="muted small">Preparing photo…</p> : null}
      {photoError ? <p className="alert alert-error">{photoError}</p> : null}

      <Field id="x-amount" label="Amount" error={e.amount?.message}>
        <MoneyInput
          id="x-amount"
          {...amountReg}
          ref={(el) => {
            amountReg.ref(el);
            amountRef.current = el;
          }}
        />
      </Field>

      <div className="field">
        <span className="label" id="x-cat-label">
          What was it for?
        </span>
        <div className="cat-grid" role="radiogroup" aria-labelledby="x-cat-label">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={category === c.value}
              className={`cat${category === c.value ? ' is-active' : ''}`}
              onClick={() => setValue('category', c.value, { shouldValidate: formState.isSubmitted, shouldDirty: true })}
            >
              <Icon name={c.icon} size={26} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        {e.category ? <span className="error-text">{e.category.message}</span> : null}
      </div>

      <div className="row-2">
        <Field id="x-date" label="Date" error={e.spent_on?.message}>
          <input id="x-date" className="input" type="date" max={todayISO()} {...register('spent_on')} />
        </Field>
        <Field id="x-veh" label="Vehicle">
          <select id="x-veh" className="input" {...register('vehicle_id')}>
            <option value="">None</option>
            {activeVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="x-supplier" label="Where" optional hint="e.g. Engen Gezina, SANRAL">
        <input id="x-supplier" className="input" autoComplete="off" {...register('supplier')} />
      </Field>

      <div className="field">
        <span className="label" id="x-method-label">
          Paid by
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="x-method-label">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={method === m.value}
              className={`seg${method === m.value ? ' is-active' : ''}`}
              onClick={() => setValue('payment_method', m.value, { shouldDirty: true })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <Field id="x-desc" label="Note" optional>
        <input id="x-desc" className="input" autoComplete="off" {...register('description')} />
      </Field>

      {saveError ? (
        <p className="alert alert-error" role="alert">
          Couldn't save. {saveError}
        </p>
      ) : null}

      {children}

      <ActionBar>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!canSave || saving || photoBusy}
          onClick={() =>
            void handleSubmit((v) => {
              if (confirmWithoutPhoto && !photo && !existingReceiptUrl) setAskNoPhoto(v);
              else void save(v);
            })()
          }
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      </ActionBar>

      <Sheet open={askNoPhoto !== null} onClose={() => setAskNoPhoto(null)} title="Save without a receipt photo?">
        <p>A photo of the slip is your proof for SARS. You can add one later from the expense.</p>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setAskNoPhoto(null);
              cameraRef.current?.click();
            }}
          >
            Add photo
          </button>
          <button
            type="button"
            className="btn btn-primary grow"
            onClick={() => {
              const v = askNoPhoto;
              setAskNoPhoto(null);
              if (v) void save(v);
            }}
          >
            Save anyway
          </button>
        </div>
      </Sheet>
    </div>
  );
}
