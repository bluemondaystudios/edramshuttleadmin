import { formatZAR, plainSpaces } from './money';
import { toWhatsAppNumber } from './phone';

/** "EDR-0001.pdf" (characters that are unsafe in file names are replaced). */
export function invoiceFileName(number: string): string {
  return `${number.replace(/[^\w.-]+/g, '_')}.pdf`;
}

/** First name for a friendly greeting: "Mokoena Family" stays whole, "Thabo Nkosi" -> "Thabo". */
export function greetingName(customerName: string, contactPerson?: string | null): string {
  const name = (contactPerson || customerName).trim();
  if (!contactPerson && /\b(family|school|high|primary|college|services|funeral|parlour|ltd|pty|cc|inc|church|trust|club)\b/i.test(name)) {
    return name;
  }
  const words = name.split(/\s+/);
  // "Mrs Dlamini", "Dr Mokoena": keep the title with the surname.
  if (words.length > 1 && /^(mr|mrs|ms|miss|dr|prof|pastor|rev|sir|madam)\.?$/i.test(words[0] ?? '')) {
    return `${words[0]} ${words[words.length - 1]}`;
  }
  return words[0] ?? name;
}

/** The message sent with an invoice (CLAUDE.md section 11). */
export function invoiceShareText(opts: { customerName: string; contactPerson?: string | null; number: string; amountCents: number }): string {
  const amount = plainSpaces(formatZAR(opts.amountCents));
  return `Hi ${greetingName(opts.customerName, opts.contactPerson)}, please find invoice ${opts.number} for ${amount} attached. Thank you, EDRAM Shuttle and Tours.`;
}

/** wa.me link with the message pre-filled. Without a usable number, WhatsApp asks who to send to. */
export function whatsAppLink(phone: string | null | undefined, text: string): string {
  const number = phone ? toWhatsAppNumber(phone) : null;
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`;
}
