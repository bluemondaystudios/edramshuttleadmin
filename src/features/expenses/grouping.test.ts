import { describe, expect, it } from 'vitest';
import { groupByMonth } from './grouping';

describe('groupByMonth', () => {
  it('groups newest first with monthly totals', () => {
    const g = groupByMonth([
      { id: 'a', spent_on: '2026-10-31', amount_cents: 100 },
      { id: 'b', spent_on: '2026-11-02', amount_cents: 120050 },
      { id: 'c', spent_on: '2026-11-26', amount_cents: 9900 },
      { id: 'd', spent_on: '2025-11-26', amount_cents: 1 },
    ]);
    expect(g.map((x) => [x.month, x.totalCents, x.items.map((i) => i.id)])).toEqual([
      ['2026-11', 129950, ['c', 'b']],
      ['2026-10', 100, ['a']],
      ['2025-11', 1, ['d']],
    ]);
  });
  it('handles nothing', () => expect(groupByMonth([])).toEqual([]));
});
