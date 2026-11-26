import { describe, expect, it } from 'vitest';
import { friendlyError } from './supabase';

describe('friendlyError', () => {
  it('translates common failures', () => {
    expect(friendlyError(new Error('Invalid login credentials'))).toMatch(/don't match/);
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/Couldn't reach/);
    expect(friendlyError({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' })).toMatch(/wasn't found/);
    expect(friendlyError({ message: 'new row violates row-level security policy for table "customers"' })).toMatch(/isn't allowed/);
  });
  it('passes database rule messages through', () => {
    expect(friendlyError({ message: 'This invoice has payments recorded. Remove them before voiding.' })).toBe(
      'This invoice has payments recorded. Remove them before voiding.',
    );
  });
});
