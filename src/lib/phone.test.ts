import { describe, expect, it } from 'vitest';
import { toWhatsAppNumber } from './phone';

describe('toWhatsAppNumber', () => {
  it.each([
    ['0821234567', '27821234567'],
    ['082 123 4567', '27821234567'],
    ['081 215 3162', '27812153162'],
    ['(012) 345-6789', '27123456789'],
    ['+27 82 123 4567', '27821234567'],
    ['27821234567', '27821234567'],
    ['+27 (0)82 123 4567', '27821234567'],
    ['0027 82 123 4567', '27821234567'],
    ['+44 7700 900123', '447700900123'],
  ])('%j -> %s', (input, expected) => {
    expect(toWhatsAppNumber(input)).toBe(expected);
  });

  it.each(['', '123', '082 123 456', 'not a number', '4477009001'])('rejects %j', (input) => {
    expect(toWhatsAppNumber(input)).toBeNull();
  });
});
