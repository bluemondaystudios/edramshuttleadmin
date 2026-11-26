import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPENSE_CATEGORIES, categoryLabel } from './expenseCategories';

describe('expense categories', () => {
  it('match the database enum exactly', () => {
    const sql = readFileSync('supabase/migrations/0001_init.sql', 'utf8');
    const enumBody = /create type public\.expense_category as enum \(([^)]*)\)/.exec(sql)?.[1] ?? '';
    const dbValues = [...enumBody.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(EXPENSE_CATEGORIES.map((c) => c.value).sort()).toEqual(dbValues);
  });
  it('have friendly labels', () => {
    expect(categoryLabel('maintenance_repairs')).toBe('Repairs & service');
    expect(new Set(EXPENSE_CATEGORIES.map((c) => c.label)).size).toBe(EXPENSE_CATEGORIES.length);
  });
});
