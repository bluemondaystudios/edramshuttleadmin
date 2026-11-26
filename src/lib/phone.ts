/**
 * Converts a South African phone number, as typed, to the format wa.me links need.
 * "082 123 4567" -> "27821234567", "+27 82 123 4567" -> "27821234567".
 * Returns null when the number can't be understood.
 */
export function toWhatsAppNumber(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('00')) digits = digits.slice(2);
  if (/^0\d{9}$/.test(digits)) return `27${digits.slice(1)}`;
  if (/^27\d{9}$/.test(digits)) return digits;
  if (/^270\d{9}$/.test(digits)) return `27${digits.slice(3)}`; // "+27 (0)82 ..."
  // Other international numbers: accept if they were written with a + or 00 prefix.
  if ((trimmed.startsWith('+') || trimmed.startsWith('00')) && /^[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}
