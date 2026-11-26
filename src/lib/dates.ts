// Dates are ISO strings (YYYY-MM-DD) everywhere, matching Postgres `date`.
// Calculations are done on calendar fields in UTC so time zones can't shift a day.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

function parts(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function iso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fromUTC(date: Date): string {
  return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Today on this device, as YYYY-MM-DD (local time). */
export function todayISO(now: Date = new Date()): string {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** "2026-11-26" -> "26 Nov 2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = parts(isoDate);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-11" or "2026-11-26" -> "November 2026" */
export function formatMonth(isoDate: string): string {
  const [y, m] = parts(isoDate.length === 7 ? `${isoDate}-01` : isoDate);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = parts(isoDate);
  return fromUTC(new Date(Date.UTC(y, m - 1, d + days)));
}

/** Due date = issue date + payment terms (days). Mirrors issue_invoice() in the database. */
export function dueDate(issueDate: string, termsDays: number): string {
  return addDays(issueDate, termsDays);
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First and last day of the month containing the date. */
export function monthRange(isoDate: string): { start: string; end: string } {
  const [y, m] = parts(isoDate);
  return { start: iso(y, m, 1), end: iso(y, m, lastDayOfMonth(y, m)) };
}

export interface FinancialYear {
  /** Calendar year in which the financial year starts. */
  startYear: number;
  /** First day, e.g. "2026-03-01". */
  start: string;
  /** Last day, e.g. "2027-02-28". */
  end: string;
  /** "2026/27" (or "2026" when the year starts in January). */
  label: string;
  /** "2026-27" (safe for file names). */
  slug: string;
  /** "2026/27 (1 Mar 2026 – 28 Feb 2027)" */
  description: string;
}

/** The financial year starting in the given calendar year. */
export function financialYearStarting(startYear: number, startMonth = 3): FinancialYear {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new Error(`startMonth must be 1–12, got ${startMonth}`);
  }
  const start = iso(startYear, startMonth, 1);
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const end = iso(endYear, endMonth, lastDayOfMonth(endYear, endMonth));
  const label = startMonth === 1 ? String(startYear) : `${startYear}/${String(endYear % 100).padStart(2, '0')}`;
  return {
    startYear,
    start,
    end,
    label,
    slug: label.replace('/', '-'),
    description: `${label} (${formatDate(start)} – ${formatDate(end)})`,
  };
}

/** The financial year a date falls in. South African tax years start in March (the default). */
export function financialYear(isoDate: string, startMonth = 3): FinancialYear {
  const [y, m] = parts(isoDate);
  return financialYearStarting(m >= startMonth ? y : y - 1, startMonth);
}
