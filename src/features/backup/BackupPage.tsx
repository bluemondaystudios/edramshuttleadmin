import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { formatDate } from '../../lib/dates';
import { daysSinceBackup, backupDue } from '../../lib/backupReminder';
import type { ExportOutcome } from '../../lib/export/run';
import type { ZipProgress } from '../../lib/export/zip';
import { useOnline } from '../../lib/useOnline';
import { PageHeader } from '../../ui/PageHeader';
import { Icon } from '../../ui/Icon';
import { ExportProgress, formatBytes } from '../../ui/ExportProgress';

export function BackupPage() {
  const online = useOnline();
  const qc = useQueryClient();
  const settings = useSettings();
  const last = settings.data?.last_backup_at ?? null;
  const days = daysSinceBackup(last);
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function backup() {
    setRunning(true);
    setProgress(null);
    setOutcome(null);
    setError(null);
    try {
      const { runBackup } = await import('../../lib/export/run');
      setOutcome(await runBackup(__APP_VERSION__, setProgress));
      await qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Backup" back="/more" />

      <div className={`card backup-status${settings.data && backupDue(last) ? ' is-due' : ''}`}>
        <span className="tile-label">Last backup</span>
        <strong className="backup-when">{!settings.data ? '—' : last ? formatDate(last.slice(0, 10)) : 'Never'}</strong>
        {days !== null ? <span className="muted small">{days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`}</span> : null}
      </div>

      <section className="section card export-card">
        <h2>Download everything</h2>
        <p className="muted">
          One ZIP with all your records (every invoice, payment, expense and change), every receipt photo and every invoice as a PDF.
        </p>
        {running ? <ExportProgress progress={progress} preparing={!progress} /> : null}
        {outcome ? (
          <p className="alert alert-info" role="status">
            Saved <strong>{outcome.fileName}</strong> ({formatBytes(outcome.sizeBytes)}) to your downloads. Now save it to Google Drive or a computer.
          </p>
        ) : null}
        {error ? <p className="alert alert-error">The backup didn't finish. {error}</p> : null}
        <button type="button" className="btn btn-primary btn-block" disabled={!online || running} onClick={() => void backup()}>
          <Icon name="download" size={20} /> {running ? 'Backing up…' : 'Download everything'}
        </button>
      </section>

      <section className="section">
        <h2>Why this matters</h2>
        <ul className="plain-list muted">
          <li>The free Supabase plan doesn't keep backups you can download. This file is your own copy.</li>
          <li>SARS can ask for records going back 5 years. Keep a backup somewhere other than this phone, such as Google Drive or a computer.</li>
          <li>Do it once a month. Home reminds you when it's been more than 30 days.</li>
        </ul>
      </section>
    </div>
  );
}
