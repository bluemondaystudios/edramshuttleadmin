/** Days since the last backup (whole days), or null if there has never been one. */
export function daysSinceBackup(lastBackupAt: string | null, now: Date = new Date()): number | null {
  if (!lastBackupAt) return null;
  const ms = now.getTime() - new Date(lastBackupAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Home shows a reminder when the last backup is more than 30 days old, or there's never been one. */
export function backupDue(lastBackupAt: string | null, now: Date = new Date()): boolean {
  if (!lastBackupAt) return true;
  return now.getTime() - new Date(lastBackupAt).getTime() > 30 * 86_400_000;
}
