// Money is always integer cents. Never use floats for stored amounts.

const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });

/** 222500 -> "R 2 225,00" (contains U+00A0 spaces, as Intl produces them). */
export function formatZAR(cents: number): string {
  return zar.format(cents / 100);
}

/**
 * Replaces the special spaces Intl uses (U+00A0, U+202F, U+2009) with normal spaces.
 * jsPDF's built-in fonts can't draw them, so use this before writing to a PDF.
 */
export function plainSpaces(text: string): string {
  return text.replace(/[   ]/g, ' ');
}

/** 120050 -> "1200.50" (for CSV exports: plain decimal, no currency, no grouping). */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Parses what a person types into an amount field and returns cents, or null if it isn't a valid amount.
 * Accepts "2225", "2225.5", "2 225,50", "R2,225.50", "R 2 225,00". Negative amounts are rejected.
 */
export function parseZAR(input: string): number | null {
  let s = input.trim().replace(/^R/i, '').replace(/[\s   ]/g, '');
  if (s === '' || !/^[\d.,]+$/.test(s)) return null;

  // The decimal separator is the last '.' or ',' when it is followed by one or two digits.
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let intPart = s;
  let fracPart = '';
  if (lastSep !== -1) {
    const after = s.slice(lastSep + 1);
    if (after.length >= 1 && after.length <= 2) {
      intPart = s.slice(0, lastSep);
      // The same mark can't be both the thousands and the decimal separator ("12.345.6").
      if (intPart.includes(s.charAt(lastSep))) return null;
      fracPart = after;
    }
  }
  // Whatever separators remain must be thousands separators in groups of three.
  if (/[.,]/.test(intPart)) {
    if (!/^\d{1,3}([.,]\d{3})+$/.test(intPart)) return null;
    intPart = intPart.replace(/[.,]/g, '');
  }
  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;

  s = intPart.replace(/^0+(?=\d)/, '');
  const cents = Number(s) * 100 + Number(fracPart.padEnd(2, '0') || '0');
  return Number.isSafeInteger(cents) ? cents : null;
}
