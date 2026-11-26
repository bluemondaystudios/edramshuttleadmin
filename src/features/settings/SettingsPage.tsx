import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useIssuedCount, useSaveSettings, useSettings } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { useOnline } from '../../lib/useOnline';
import { PageHeader } from '../../ui/PageHeader';
import { Field } from '../../ui/Field';
import { ActionBar } from '../../ui/ActionBar';

const text = (max = 200) => z.string().trim().max(max).transform((v) => (v === '' ? null : v));
const required = (msg: string, max = 200) => z.string().trim().min(1, msg).max(max);

const schema = z.object({
  trading_name: required('Enter the trading name'),
  legal_name: text(),
  entity_type: z.enum(['', 'sole_proprietor', 'pty_ltd', 'other']).transform((v) => (v === '' ? null : v)),
  registration_no: text(50),
  income_tax_no: text(50),
  address: required('Enter the business address', 300),
  phone: required('Enter a phone number', 50),
  email: required('Enter an email address').refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'That email address looks incomplete'),
  bank_name: text(100),
  account_name: text(100),
  account_no: text(30),
  branch_code: text(20),
  account_type: text(50),
  invoice_prefix: required('Enter a prefix, e.g. EDR-', 10),
  payment_terms_days: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}$/.test(v), 'Enter a number of days, e.g. 7')
    .transform(Number),
  invoice_footer: text(200),
  financial_year_start_month: z.string().transform(Number),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function SettingsPage() {
  const online = useOnline();
  const q = useSettings();
  const issued = useIssuedCount();
  const save = useSaveSettings();
  const { register, handleSubmit, reset, formState } = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema) });
  const e = formState.errors;
  const prefixLocked = (issued.data ?? 0) > 0;

  useEffect(() => {
    const s = q.data;
    if (!s) return;
    reset({
      trading_name: s.trading_name,
      legal_name: s.legal_name ?? '',
      entity_type: s.entity_type ?? '',
      registration_no: s.registration_no ?? '',
      income_tax_no: s.income_tax_no ?? '',
      address: s.address,
      phone: s.phone,
      email: s.email,
      bank_name: s.bank_name ?? '',
      account_name: s.account_name ?? '',
      account_no: s.account_no ?? '',
      branch_code: s.branch_code ?? '',
      account_type: s.account_type ?? '',
      invoice_prefix: s.invoice_prefix,
      payment_terms_days: String(s.payment_terms_days),
      invoice_footer: s.invoice_footer ?? '',
      financial_year_start_month: String(s.financial_year_start_month),
    });
  }, [q.data, reset]);

  if (q.isError) return <p className="alert alert-error">Couldn't load settings. {friendlyError(q.error)}</p>;
  if (!q.data) return <div className="page" aria-busy="true" />;

  return (
    <form
      className="page has-action-bar"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        const patch = prefixLocked ? { ...v, invoice_prefix: q.data.invoice_prefix } : v;
        await save.mutateAsync(patch);
      })}
    >
      <PageHeader title="Settings" back="/more" sub="These details appear on new invoices." />
      <p className="alert alert-info">
        Changes apply to invoices issued from now on. Invoices already issued keep the details they were issued with.
      </p>

      <fieldset className="card fieldset">
        <legend>Business</legend>
        <Field id="s-trading" label="Trading name" error={e.trading_name?.message}>
          <input id="s-trading" className="input" {...register('trading_name')} />
        </Field>
        <Field id="s-entity" label="Business type">
          <select id="s-entity" className="input" {...register('entity_type')}>
            <option value="">Not set</option>
            <option value="sole_proprietor">Sole proprietor</option>
            <option value="pty_ltd">(Pty) Ltd company</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field id="s-legal" label="Legal name" optional hint="If different from the trading name">
          <input id="s-legal" className="input" {...register('legal_name')} />
        </Field>
        <Field id="s-reg" label="CIPC registration number" optional>
          <input id="s-reg" className="input" {...register('registration_no')} />
        </Field>
        <Field id="s-tax" label="Income tax number" optional hint="Kept for your records; not printed on invoices">
          <input id="s-tax" className="input" inputMode="numeric" {...register('income_tax_no')} />
        </Field>
        <Field id="s-address" label="Address" error={e.address?.message}>
          <textarea id="s-address" className="input" rows={2} {...register('address')} />
        </Field>
        <Field id="s-phone" label="Phone" error={e.phone?.message}>
          <input id="s-phone" className="input" type="tel" inputMode="tel" {...register('phone')} />
        </Field>
        <Field id="s-email" label="Email" error={e.email?.message}>
          <input id="s-email" className="input" type="email" inputMode="email" autoCapitalize="none" {...register('email')} />
        </Field>
      </fieldset>

      <fieldset className="card fieldset">
        <legend>Bank details (printed on invoices)</legend>
        {!q.data.account_no ? <p className="alert alert-warn">Not set yet. Until they are, invoices ask customers to phone for payment details.</p> : null}
        <Field id="s-bank" label="Bank">
          <input id="s-bank" className="input" {...register('bank_name')} />
        </Field>
        <Field id="s-accname" label="Account name">
          <input id="s-accname" className="input" {...register('account_name')} />
        </Field>
        <Field id="s-accno" label="Account number">
          <input id="s-accno" className="input" inputMode="numeric" {...register('account_no')} />
        </Field>
        <Field id="s-branch" label="Branch code">
          <input id="s-branch" className="input" inputMode="numeric" {...register('branch_code')} />
        </Field>
        <Field id="s-acctype" label="Account type" hint="e.g. Business cheque">
          <input id="s-acctype" className="input" {...register('account_type')} />
        </Field>
      </fieldset>

      <fieldset className="card fieldset">
        <legend>Invoices</legend>
        <Field
          id="s-prefix"
          label="Invoice number prefix"
          error={e.invoice_prefix?.message}
          hint={prefixLocked ? 'Locked: invoices have already been issued with this prefix.' : 'Numbers will look like EDR-0001. This locks after the first invoice.'}
        >
          <input id="s-prefix" className="input" disabled={prefixLocked} autoCapitalize="characters" {...register('invoice_prefix')} />
        </Field>
        <Field id="s-terms" label="Payment terms (days)" error={e.payment_terms_days?.message} hint="The due date is the invoice date plus this many days">
          <input id="s-terms" className="input" inputMode="numeric" {...register('payment_terms_days')} />
        </Field>
        <Field id="s-footer" label="Invoice footer" optional>
          <input id="s-footer" className="input" {...register('invoice_footer')} />
        </Field>
        <Field id="s-fy" label="Financial year starts in" hint="South African tax years start in March">
          <select id="s-fy" className="input" {...register('financial_year_start_month')}>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      {save.isError ? <p className="alert alert-error">Couldn't save. {friendlyError(save.error)}</p> : null}
      {save.isSuccess && !formState.isDirty ? (
        <p className="alert alert-info" role="status">
          Settings saved.
        </p>
      ) : null}

      <ActionBar>
        <button type="submit" className="btn btn-primary btn-block" disabled={!online || formState.isSubmitting}>
          {formState.isSubmitting ? 'Saving…' : 'Save settings'}
        </button>
      </ActionBar>
    </form>
  );
}
