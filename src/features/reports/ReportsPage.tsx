import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettings, useVehicles } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { formatZAR } from '../../lib/money';
import { financialYear, financialYearStarting, formatDate, todayISO } from '../../lib/dates';
import { categoryIcon, categoryLabel } from '../../lib/expenseCategories';
import { fetchYearData } from '../../lib/export/yearData';
import { computeYearReport } from '../../lib/export/yearReport';
import type { ExportOutcome } from '../../lib/export/run';
import type { ZipProgress } from '../../lib/export/zip';
import { useOnline } from '../../lib/useOnline';
import { PageHeader } from '../../ui/PageHeader';
import { Icon } from '../../ui/Icon';
import { ExportProgress, formatBytes } from '../../ui/ExportProgress';

export function ReportsPage() {
  const online = useOnline();
  const settings = useSettings();
  const vehicles = useVehicles();
  const startMonth = settings.data?.financial_year_start_month ?? 3;
  const current = financialYear(todayISO(), startMonth);
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => financialYearStarting(current.startYear - i, startMonth)), [current.startYear, startMonth]);
  const [startYear, setStartYear] = useState(current.startYear);
  const fy = years.find((y) => y.startYear === startYear) ?? current;

  const q = useQuery({
    queryKey: ['year-report', fy.slug, startMonth],
    enabled: !!settings.data,
    queryFn: () => fetchYearData(fy),
  });
  const r = useMemo(() => (q.data ? computeYearReport(fy, q.data.invoices, q.data.expenses) : null), [q.data, fy]);
  const labels = Object.fromEntries((vehicles.data ?? []).map((v) => [v.id, v.label]));
  const maxCat = Math.max(1, ...(r?.byCategory.map((c) => c.cents) ?? []));

  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [exporting, setExporting] = useState(false);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportPack() {
    setExporting(true);
    setProgress(null);
    setOutcome(null);
    setError(null);
    try {
      const { runExportPack } = await import('../../lib/export/run');
      setOutcome(await runExportPack(fy, setProgress));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Reports" back="/more" />

      <label className="field">
        <span className="label">Tax year</span>
        <select className="input" value={startYear} onChange={(e) => { setStartYear(Number(e.target.value)); setOutcome(null); }}>
          {years.map((y) => (
            <option key={y.startYear} value={y.startYear}>
              {y.description}
            </option>
          ))}
        </select>
      </label>

      {q.isError ? <p className="alert alert-error">Couldn't load the figures. {friendlyError(q.error)}</p> : null}

      <div className="tiles" aria-busy={q.isPending}>
        <div className="tile card">
          <span className="tile-label">Money received</span>
          <span className="tile-value">{r ? formatZAR(r.receivedCents) : '—'}</span>
          {r ? <span className="tile-sub">{r.paymentCount} payments</span> : null}
        </div>
        <div className="tile card tile-amber">
          <span className="tile-label">Expenses</span>
          <span className="tile-value">{r ? formatZAR(r.expensesCents) : '—'}</span>
          {r ? <span className="tile-sub">{r.expenseCount} expenses</span> : null}
        </div>
        <div className={`tile card${r && r.netCents < 0 ? ' tile-red' : ''}`}>
          <span className="tile-label">Received minus expenses</span>
          <span className="tile-value">{r ? formatZAR(r.netCents) : '—'}</span>
        </div>
        <div className="tile card">
          <span className="tile-label">Invoiced</span>
          <span className="tile-value">{r ? formatZAR(r.invoicedCents) : '—'}</span>
          {r ? <span className="tile-sub">{r.invoiceCount} invoices{r.voidCount ? `, ${r.voidCount} void` : ''}</span> : null}
        </div>
      </div>
      {r ? (
        <p className="muted small">
          Still owed at year end ({formatDate(fy.end)}): <strong>{formatZAR(r.outstandingAtYearEndCents)}</strong>. Income is counted when it's received; your accountant decides which basis to use.
        </p>
      ) : null}

      <section className="section">
        <h2>Expenses by category</h2>
        {r && r.byCategory.length === 0 ? <p className="muted">No expenses in this tax year.</p> : null}
        {r && r.byCategory.length > 0 ? (
          <ul className="list card">
            {r.byCategory.map((c) => (
              <li key={c.category} className="list-row static bar-row">
                <span className="list-icon">
                  <Icon name={categoryIcon(c.category)} />
                </span>
                <span className="list-main">
                  <strong>{categoryLabel(c.category)}</strong>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(2, (c.cents / maxCat) * 100)}%` }} />
                  </span>
                </span>
                <span className="list-side">
                  <span className="amount">{formatZAR(c.cents)}</span>
                  <span className="muted small">{c.count}×</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {r && r.byVehicle.length > 0 ? (
        <section className="section">
          <h2>Expenses by vehicle</h2>
          <ul className="list card">
            {r.byVehicle.map((v) => (
              <li key={v.vehicleId ?? 'none'} className="list-row static">
                <span className="list-main">
                  <strong>{v.vehicleId ? (labels[v.vehicleId] ?? 'Unknown vehicle') : 'Not linked to a vehicle'}</strong>
                </span>
                <span className="list-side">
                  <span className="amount">{formatZAR(v.cents)}</span>
                  <span className="muted small">{v.count}×</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section card export-card">
        <h2>Export pack for SARS or your accountant</h2>
        <p className="muted">
          One ZIP file for {fy.label}: a summary, lists of invoices, payments and expenses that open in Excel, every invoice as a PDF and every receipt photo.
        </p>
        {exporting ? <ExportProgress progress={progress} preparing={!progress} /> : null}
        {outcome ? (
          <p className="alert alert-info" role="status">
            Saved <strong>{outcome.fileName}</strong> ({formatBytes(outcome.sizeBytes)}) to your downloads. Email it or save it to Google Drive from there.
          </p>
        ) : null}
        {error ? <p className="alert alert-error">Couldn't make the export. {error}</p> : null}
        <button type="button" className="btn btn-primary btn-block" disabled={!online || exporting || !q.data} onClick={() => void exportPack()}>
          <Icon name="download" size={20} /> {exporting ? 'Exporting…' : `Export ${fy.label} pack`}
        </button>
      </section>
    </div>
  );
}
