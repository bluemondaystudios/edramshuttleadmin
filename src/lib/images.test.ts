import { describe, expect, it } from 'vitest';
import { ATTEMPTS, fitWithin } from './images';

describe('fitWithin', () => {
  it('shrinks the longest side to 1400', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1050, height: 1400 });
    expect(fitWithin(4032, 3024)).toEqual({ width: 1400, height: 1050 });
  });
  it('never enlarges small images', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('starts at the agreed quality', () => {
    expect(ATTEMPTS[0]).toEqual({ scale: 1, quality: 0.65 });
  });
});
