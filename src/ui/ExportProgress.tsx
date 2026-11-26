import type { ZipProgress } from '../lib/export/zip';

function stage(current: string): string {
  if (current.includes('/receipts/')) return 'Adding receipt photos';
  if (current.endsWith('.pdf')) return 'Making invoice PDFs';
  if (current.endsWith('data.json')) return 'Copying your records';
  return 'Writing the files';
}

/** Progress for long exports: a bar plus plain words. */
export function ExportProgress({ progress, preparing }: { progress: ZipProgress | null; preparing: boolean }) {
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${preparing ? 4 : pct}%` }} />
      </div>
      <span className="small muted">
        {preparing || !progress ? 'Fetching your records…' : `${stage(progress.current)}: ${progress.done} of ${progress.total}`}
      </span>
      <span className="small muted">Keep this screen open until it's done.</span>
    </div>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
