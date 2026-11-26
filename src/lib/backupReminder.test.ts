import { describe, expect, it } from 'vitest';
import { backupDue, daysSinceBackup } from './backupReminder';

const now = new Date('2026-11-26T12:00:00Z');

describe('backup reminder', () => {
  it('is due when there has never been a backup', () => {
    expect(daysSinceBackup(null, now)).toBeNull();
    expect(backupDue(null, now)).toBe(true);
  });
  it('is due after more than 30 days', () => {
    expect(backupDue('2026-10-27T12:00:00Z', now)).toBe(false); // exactly 30 days
    expect(backupDue('2026-10-27T11:00:00Z', now)).toBe(true); // 30 days and an hour
    expect(daysSinceBackup('2026-11-25T13:00:00Z', now)).toBe(0);
    expect(daysSinceBackup('2026-11-20T12:00:00Z', now)).toBe(6);
  });
});
