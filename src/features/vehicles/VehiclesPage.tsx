import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { STANDARD_FLEET, useAddStandardFleet, useSaveVehicle, useVehicles } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { useOnline } from '../../lib/useOnline';
import type { Vehicle } from '../../lib/types';
import { PageHeader } from '../../ui/PageHeader';
import { EmptyState } from '../../ui/EmptyState';
import { Sheet } from '../../ui/Sheet';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';

const schema = z.object({
  label: z.string().trim().min(1, 'Give the vehicle a name, e.g. "15 Seater Shuttle"').max(100),
  registration_plate: z.string().trim().max(20).transform((v) => (v === '' ? null : v.toUpperCase())),
  seats: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{1,3}$/.test(v), 'Seats must be a whole number')
    .transform((v) => (v === '' ? null : Number(v))),
  active: z.boolean(),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

function VehicleForm({ vehicle, onDone }: { vehicle?: Vehicle; onDone: () => void }) {
  const online = useOnline();
  const save = useSaveVehicle();
  const { register, handleSubmit, formState } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: vehicle?.label ?? '',
      registration_plate: vehicle?.registration_plate ?? '',
      seats: vehicle?.seats ? String(vehicle.seats) : '',
      active: vehicle?.active ?? true,
    },
  });
  const e = formState.errors;
  return (
    <form
      className="form"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        await save.mutateAsync({ id: vehicle?.id, ...v });
        onDone();
      })}
    >
      <Field id="v-label" label="Name" error={e.label?.message}>
        <input id="v-label" className="input" autoComplete="off" {...register('label')} />
      </Field>
      <Field id="v-plate" label="Registration plate" optional>
        <input id="v-plate" className="input" autoComplete="off" autoCapitalize="characters" {...register('registration_plate')} />
      </Field>
      <Field id="v-seats" label="Seats" optional error={e.seats?.message}>
        <input id="v-seats" className="input" inputMode="numeric" autoComplete="off" {...register('seats')} />
      </Field>
      <label className="check">
        <input type="checkbox" {...register('active')} /> In use (shown when choosing a vehicle)
      </label>
      {save.isError ? <p className="alert alert-error">Couldn't save. {friendlyError(save.error)}</p> : null}
      <button type="submit" className="btn btn-primary btn-block" disabled={!online || formState.isSubmitting}>
        {formState.isSubmitting ? 'Saving…' : 'Save vehicle'}
      </button>
    </form>
  );
}

export function VehiclesPage() {
  const online = useOnline();
  const q = useVehicles();
  const fleet = useAddStandardFleet();
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);

  return (
    <div className="page">
      <PageHeader title="Vehicles" back="/more">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={20} /> Add
        </button>
      </PageHeader>

      {q.isError ? <p className="alert alert-error">Couldn't load vehicles. {friendlyError(q.error)}</p> : null}

      {q.data && q.data.length === 0 ? (
        <EmptyState icon="van" title="No vehicles yet">
          <p>Vehicles can be added to invoice lines and expenses. Start with the EDRAM fleet and add registration plates later.</p>
          <button type="button" className="btn btn-primary" disabled={!online || fleet.isPending} onClick={() => fleet.mutate()}>
            Add the fleet ({STANDARD_FLEET.length} vehicles)
          </button>
          {fleet.isError ? <p className="alert alert-error">{friendlyError(fleet.error)}</p> : null}
        </EmptyState>
      ) : null}

      {q.data && q.data.length > 0 ? (
        <ul className="list card">
          {q.data.map((v) => (
            <li key={v.id}>
              <button type="button" className="list-row" onClick={() => setEditing(v)}>
                <span className="list-icon">
                  <Icon name="van" />
                </span>
                <span className="list-main">
                  <strong>{v.label}</strong>
                  <span className="muted small">{[v.registration_plate ?? 'No plate yet', v.seats ? `${v.seats} seats` : null].filter(Boolean).join(' · ')}</span>
                </span>
                {v.active ? <Icon name="chevron" className="muted" /> : <span className="pill pill-grey">Not in use</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New vehicle' : 'Edit vehicle'}>
        {editing !== null ? <VehicleForm key={editing === 'new' ? 'new' : editing.id} vehicle={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </div>
  );
}
