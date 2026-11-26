import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSaveCustomer } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { useOnline } from '../../lib/useOnline';
import type { Customer } from '../../lib/types';
import { Field } from '../../ui/Field';

const optional = z.string().trim().max(500).transform((v) => (v === '' ? null : v));

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the customer or organisation name').max(200),
  contact_person: optional,
  phone: optional,
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'That email address looks incomplete')
    .transform((v) => (v === '' ? null : v)),
  address: optional,
  notes: optional,
});

type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export function CustomerForm({ customer, onSaved, submitLabel = 'Save customer' }: { customer?: Customer; onSaved: (c: Customer) => void; submitLabel?: string }) {
  const online = useOnline();
  const save = useSaveCustomer();
  const { register, handleSubmit, formState } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? '',
      contact_person: customer?.contact_person ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      address: customer?.address ?? '',
      notes: customer?.notes ?? '',
    },
  });
  const e = formState.errors;

  return (
    <form
      className="form"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        const saved = await save.mutateAsync({ id: customer?.id, ...values });
        onSaved(saved);
      })}
    >
      <Field id="c-name" label="Name" error={e.name?.message} hint="A person, family, school, funeral parlour or company">
        <input id="c-name" className="input" autoComplete="off" autoFocus={!customer} {...register('name')} />
      </Field>
      <Field id="c-contact" label="Contact person" optional>
        <input id="c-contact" className="input" autoComplete="off" {...register('contact_person')} />
      </Field>
      <Field id="c-phone" label="Phone" optional hint="Used for WhatsApp">
        <input id="c-phone" className="input" type="tel" inputMode="tel" autoComplete="off" {...register('phone')} />
      </Field>
      <Field id="c-email" label="Email" optional error={e.email?.message}>
        <input id="c-email" className="input" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" {...register('email')} />
      </Field>
      <Field id="c-address" label="Address" optional hint="Shown on invoices">
        <textarea id="c-address" className="input" rows={2} {...register('address')} />
      </Field>
      <Field id="c-notes" label="Notes" optional hint="Only you see these">
        <textarea id="c-notes" className="input" rows={2} {...register('notes')} />
      </Field>
      {save.isError ? (
        <p className="alert alert-error" role="alert">
          Couldn't save. {friendlyError(save.error)}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-block" disabled={!online || formState.isSubmitting}>
        {formState.isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
