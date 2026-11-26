// Invoice arithmetic, mirroring the database so the live total in the editor
// matches what Postgres stores (amount_cents = round(quantity * unit_price_cents)).

/**
 * Parses a quantity as typed ("1", "1.5", "1,5", "2.25"). The database column is numeric(10,2),
 * so at most two decimals and less than 100 000 000. Returns null when invalid or not above zero.
 */
export function parseQuantity(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return null;
  const q = Number(s);
  return q > 0 ? q : null;
}

/** round(quantity × unit price) to whole cents, halves away from zero like Postgres numeric round(). */
export function lineAmountCents(quantity: number, unitPriceCents: number): number {
  // Quantity has at most 2 decimals: work in hundredths to stay exact.
  const qHundredths = Math.round(quantity * 100);
  const product = qHundredths * unitPriceCents; // = amount × 100
  const whole = Math.floor(product / 100);
  const rest = product - whole * 100;
  return rest >= 50 ? whole + 1 : whole;
}

export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Quantity for display: "1", "1.5", "2.25". */
export function formatQuantity(q: number): string {
  return String(Math.round(q * 100) / 100);
}

/**
 * Display-only preview of a number, mirroring issue_invoice(): prefix + seq padded to 4 digits.
 * The real number always comes from the database.
 */
export function formatInvoiceNumber(prefix: string, seq: number): string {
  return prefix + String(seq).padStart(4, '0');
}
