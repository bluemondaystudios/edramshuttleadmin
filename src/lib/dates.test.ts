import { describe, expect, it } from 'vitest';
import { addDays, dueDate, financialYear, financialYearStarting, formatDate, formatMonth, monthRange, todayISO } from './dates';

describe('formatDate', () => {
  it('shows day, short month and year', () => {
    expect(formatDate('2026-11-26')).toBe('26 Nov 2026');
    expect(formatDate('2027-01-01')).toBe('1 Jan 2027');
  });
  it('rejects non-ISO input', () => {
    expect(() => formatDate('26/11/2026')).toThrow();
  });
  it('formats months', () => {
    expect(formatMonth('2026-11')).toBe('November 2026');
    expect(formatMonth('2026-02-14')).toBe('February 2026');
  });
});

describe('dueDate / addDays', () => {
  it('adds payment terms', () => {
    expect(dueDate('2026-11-26', 7)).toBe('2026-12-03');
    expect(dueDate('2026-12-28', 7)).toBe('2027-01-04');
    expect(dueDate('2028-02-25', 7)).toBe('2028-03-03'); // 2028 is a leap year
    expect(dueDate('2027-02-25', 7)).toBe('2027-03-04');
    expect(dueDate('2026-11-26', 0)).toBe('2026-11-26');
  });
  it('can go backwards', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('todayISO', () => {
  it('uses the local calendar date', () => {
    expect(todayISO(new Date(2026, 10, 26, 23, 59))).toBe('2026-11-26');
    expect(todayISO(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
});

describe('monthRange', () => {
  it('covers the whole month', () => {
    expect(monthRange('2026-11-26')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(monthRange('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthRange('2027-02-10')).toEqual({ start: '2027-02-01', end: '2027-02-28' });
  });
});

describe('financialYear (March start, the SA default)', () => {
  it('puts November 2026 in 2026/27', () => {
    const fy = financialYear('2026-11-26');
    expect(fy).toMatchObject({ label: '2026/27', slug: '2026-27', start: '2026-03-01', end: '2027-02-28', startYear: 2026 });
    expect(fy.description).toBe('2026/27 (1 Mar 2026 – 28 Feb 2027)');
  });
  it('handles the boundaries', () => {
    expect(financialYear('2026-03-01').label).toBe('2026/27');
    expect(financialYear('2026-02-28').label).toBe('2025/26');
    expect(financialYear('2027-02-28').label).toBe('2026/27');
    expect(financialYear('2027-01-15').label).toBe('2026/27');
  });
  it('ends on 29 February in leap years', () => {
    expect(financialYear('2027-06-01').end).toBe('2028-02-29');
    expect(financialYear('2028-02-29').label).toBe('2027/28');
    expect(financialYear('2028-03-01').label).toBe('2028/29');
    expect(financialYear('2023-05-01').end).toBe('2024-02-29');
  });
  it('labels across a century', () => {
    expect(financialYearStarting(2099).label).toBe('2099/00');
  });
});

describe('financialYear with other start months', () => {
  it('January start is the calendar year', () => {
    expect(financialYear('2026-11-26', 1)).toMatchObject({ label: '2026', start: '2026-01-01', end: '2026-12-31' });
  });
  it('July start', () => {
    expect(financialYear('2026-06-30', 7)).toMatchObject({ label: '2025/26', start: '2025-07-01', end: '2026-06-30' });
    expect(financialYear('2026-07-01', 7)).toMatchObject({ label: '2026/27', start: '2026-07-01', end: '2027-06-30' });
  });
  it('rejects invalid months', () => {
    expect(() => financialYear('2026-01-01', 0)).toThrow();
    expect(() => financialYear('2026-01-01', 13)).toThrow();
  });
});
