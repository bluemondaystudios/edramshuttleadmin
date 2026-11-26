import type { IconName } from '../ui/Icon';

export type ExpenseCategory =
  | 'fuel' | 'maintenance_repairs' | 'tyres' | 'tolls' | 'insurance' | 'vehicle_finance'
  | 'licensing' | 'driver_wages' | 'cleaning' | 'parking' | 'phone_data' | 'office_admin' | 'other';

/** In the order shown on the Log expense grid: most common first. Matches the database enum. */
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: IconName }[] = [
  { value: 'fuel', label: 'Fuel', icon: 'fuel' },
  { value: 'tolls', label: 'Tolls', icon: 'toll' },
  { value: 'maintenance_repairs', label: 'Repairs & service', icon: 'wrench' },
  { value: 'tyres', label: 'Tyres', icon: 'tyre' },
  { value: 'cleaning', label: 'Cleaning', icon: 'droplet' },
  { value: 'parking', label: 'Parking', icon: 'parking' },
  { value: 'driver_wages', label: 'Driver wages', icon: 'person' },
  { value: 'insurance', label: 'Insurance', icon: 'shield' },
  { value: 'vehicle_finance', label: 'Vehicle finance', icon: 'bank' },
  { value: 'licensing', label: 'Licensing', icon: 'idCard' },
  { value: 'phone_data', label: 'Phone & data', icon: 'phone' },
  { value: 'office_admin', label: 'Office & admin', icon: 'briefcase' },
  { value: 'other', label: 'Other', icon: 'dots' },
];

const BY_VALUE = new Map(EXPENSE_CATEGORIES.map((c) => [c.value, c]));

export function categoryLabel(c: ExpenseCategory): string {
  return BY_VALUE.get(c)?.label ?? c;
}

export function categoryIcon(c: ExpenseCategory): IconName {
  return BY_VALUE.get(c)?.icon ?? 'dots';
}
