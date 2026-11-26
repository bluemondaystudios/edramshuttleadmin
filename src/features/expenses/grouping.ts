export interface Dated {
  spent_on: string;
  amount_cents: number;
}

export interface MonthGroup<T extends Dated> {
  /** "2026-11" */
  month: string;
  totalCents: number;
  items: T[];
}

/** Newest month first; within a month, newest first (stable for equal dates). */
export function groupByMonth<T extends Dated>(items: T[]): MonthGroup<T>[] {
  const sorted = items.map((item, i) => ({ item, i })).sort((a, b) => b.item.spent_on.localeCompare(a.item.spent_on) || a.i - b.i);
  const groups: MonthGroup<T>[] = [];
  for (const { item } of sorted) {
    const month = item.spent_on.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.month !== month) {
      g = { month, totalCents: 0, items: [] };
      groups.push(g);
    }
    g.items.push(item);
    g.totalCents += Number(item.amount_cents);
  }
  return groups;
}
