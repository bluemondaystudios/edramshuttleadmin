import { describe, expect, it } from 'vitest';
import { greetingName, invoiceFileName, invoiceShareText, whatsAppLink } from './share';

describe('invoiceShareText', () => {
  it('matches the agreed wording', () => {
    expect(invoiceShareText({ customerName: 'Thabo Nkosi', number: 'EDR-0001', amountCents: 222500 })).toBe(
      'Hi Thabo, please find invoice EDR-0001 for R 2 225,00 attached. Thank you, EDRAM Shuttle and Tours.',
    );
  });
  it('greets the contact person of an organisation', () => {
    expect(invoiceShareText({ customerName: 'Pretoria Girls High', contactPerson: 'Mrs Dlamini', number: 'EDR-0002', amountCents: 100 })).toMatch(/^Hi Mrs Dlamini,/);
    expect(greetingName('Pretoria Girls High', 'Lerato Dlamini')).toBe('Lerato');
    expect(greetingName('Dr Mokoena')).toBe('Dr Mokoena');
  });
  it('keeps organisation names whole', () => {
    expect(greetingName('Mokoena Family')).toBe('Mokoena Family');
    expect(greetingName('Dignity Funeral Services')).toBe('Dignity Funeral Services');
  });
  it('uses plain spaces in the amount', () => {
    expect(invoiceShareText({ customerName: 'A', number: 'X', amountCents: 123456700 })).toContain('R 1 234 567,00');
  });
});

describe('whatsAppLink', () => {
  it('converts the number and encodes the text', () => {
    expect(whatsAppLink('082 123 4567', 'Hi there & thanks')).toBe('https://wa.me/27821234567?text=Hi%20there%20%26%20thanks');
  });
  it('works without a number', () => {
    expect(whatsAppLink(null, 'x')).toBe('https://wa.me/?text=x');
    expect(whatsAppLink('nonsense', 'x')).toBe('https://wa.me/?text=x');
  });
});

describe('invoiceFileName', () => {
  it('names the PDF after the invoice', () => {
    expect(invoiceFileName('EDR-0001')).toBe('EDR-0001.pdf');
    expect(invoiceFileName('EDR/2026 01')).toBe('EDR_2026_01.pdf');
  });
});
