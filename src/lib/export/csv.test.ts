import { describe, expect, it } from 'vitest';
import { BOM, csvCell, toCsv } from './csv';

describe('csv', () => {
  it('quotes only when needed', () => {
    expect(csvCell('Engen Gezina')).toBe('Engen Gezina');
    expect(csvCell('Midas, Pretoria')).toBe('"Midas, Pretoria"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('1200.50')).toBe('1200.50');
    expect(csvCell(' padded')).toBe('" padded"');
  });
  it('neutralises spreadsheet formulas typed into the app', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+27 82 123 4567')).toBe("'+27 82 123 4567");
    expect(csvCell('-99.00')).toBe('-99.00'); // plain negative numbers are left alone
  });
  it('builds a file Excel opens cleanly', () => {
    const out = toCsv(['date', 'amount'], [['2026-11-26', '1200.50']]);
    expect(out.startsWith(BOM)).toBe(true);
    expect(out).toBe(`${BOM}date,amount\r\n2026-11-26,1200.50\r\n`);
  });
});
