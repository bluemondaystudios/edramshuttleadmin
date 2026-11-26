import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import vanLogo from '../../assets/van-green.png?inline';
import { useDeletePayment, useDuplicateInvoice, useInvoice, useVehicles } from '../../lib/api';
import { friendlyError } from '../../lib/supabase';
import { formatZAR } from '../../lib/money';
import { formatDate, todayISO } from '../../lib/dates';
import { formatQuantity } from '../../lib/invoiceMath';
import { displayStatus } from '../../lib/invoiceStatus';
import { invoicePdfFile, invoiceTotals } from '../../lib/pdf/invoicePdf';
import { invoiceFileName, invoiceShareText, whatsAppLink } from '../../lib/share';
import { downloadFile, shareOrDownload } from '../../lib/sharePdf';
import { useOnline } from '../../lib/useOnline';
import { paymentMethodLabel } from '../../lib/types';
import { PageHeader } from '../../ui/PageHeader';
import { ActionBar } from '../../ui/ActionBar';
import { StatusPill } from '../../ui/StatusPill';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { RecordPaymentSheet } from '../payments/RecordPaymentSheet';
import { VoidSheet } from './VoidSheet';

export default function InvoiceDetail() {
  const { id } = useParams();
  const q = useInvoice(id);
  if (q.isError) return <p className="alert alert-error">Couldn't load this invoice. {friendlyError(q.error)}</p>;
  if (!q.data) return <div className="page" aria-busy="true" />;
  if (q.data.status === 'draft') return <Navigate to={`/invoices/${q.data.id}/edit`} replace />;
  return <Detail inv={q.data} />;
}

function Detail({ inv }: { inv: NonNullable<ReturnType<typeof useInvoice>['data']> }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const online = useOnline();
  const vehicles = useVehicles();
  const duplicate = useDuplicateInvoice();
  const deletePayment = useDeletePayment();
  const [paying, setPaying] = useState(params.get('pay') === '1');
  const [voiding, setVoiding] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const justIssued = (location.state as { justIssued?: boolean } | null)?.justIssued === true;

  useEffect(() => {
    if (params.get('pay')) {
      const next = new URLSearchParams(params);
      next.delete('pay');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const number = inv.number!;
  const totals = invoiceTotals(inv);
  const status = displayStatus({ status: inv.status, total_cents: totals.totalCents, paid_cents: totals.paidCents, balance_cents: totals.balanceCents, is_overdue: inv.status === 'issued' && totals.balanceCents > 0 && !!inv.due_date && inv.due_date < todayISO() });
  const customer = inv.customer_snapshot;
  const vehicleLabels = useMemo(() => Object.fromEntries((vehicles.data ?? []).map((v) => [v.id, v.label])), [vehicles.data]);
  const shareText = invoiceShareText({ customerName: customer?.name ?? '', contactPerson: customer?.contact_person, number, amountCents: totals.totalCents });

  const makeFile = () => invoicePdfFile({ invoice: inv, vehicleLabels, logoDataUrl: vanLogo }, invoiceFileName(number));

  const onShare = async () => {
    setPdfError(null);
    try {
      const outcome = await shareOrDownload(makeFile(), `Invoice ${number}`, shareText);
      if (outcome === 'downloaded') setFallback(true);
    } catch (err) {
      setPdfError(`Couldn't create the PDF. ${friendlyError(err)}`);
    }
  };

  const onDownload = () => {
    setPdfError(null);
    try {
      downloadFile(makeFile());
    } catch (err) {
      setPdfError(`Couldn't create the PDF. ${friendlyError(err)}`);
    }
  };

  return (
    <div className="page has-action-bar">
      <PageHeader
        title={<span className={inv.status === 'void' ? 'struck' : undefined}>{number}</span>}
        back="/invoices"
        sub={customer?.name}
      >
        <StatusPill status={status} />
      </PageHeader>

      {justIssued ? (
        <p className="alert alert-info" role="status">
          {number} is issued. Tap <strong>Share</strong> to send it to {customer?.name ?? 'the customer'}.
        </p>
      ) : null}

      {inv.status === 'void' ? (
        <div className="alert alert-error">
          <strong>Void.</strong> {inv.void_reason}
          {inv.voided_at ? <span className="muted small block">Voided {formatDate(inv.voided_at.slice(0, 10))}. Nothing is owed on it.</span> : null}
        </div>
      ) : null}

      <dl className="summary card">
        <div>
          <dt>Issued</dt>
          <dd>{formatDate(inv.issue_date!)}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd className={status === 'overdue' ? 'text-red' : undefined}>{inv.due_date ? formatDate(inv.due_date) : '—'}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd className="amount">{formatZAR(totals.totalCents)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd className="amount">{formatZAR(totals.paidCents)}</dd>
        </div>
        <div className="summary-balance">
          <dt>Balance due</dt>
          <dd className="amount">{formatZAR(inv.status === 'void' ? 0 : Math.max(totals.balanceCents, 0))}</dd>
        </div>
      </dl>

      <section className="section">
        <h2>Lines</h2>
        <ul className="list card">
          {inv.invoice_lines.map((l) => (
            <li key={l.id} className="list-row static">
              <span className="list-main">
                <strong className="wrap">{l.description}</strong>
                <span className="muted small wrap">
                  {[l.service_date ? formatDate(l.service_date) : null, l.vehicle_id ? vehicleLabels[l.vehicle_id] : null, `${formatQuantity(Number(l.quantity))} × ${formatZAR(Number(l.unit_price_cents))}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="amount">{formatZAR(Number(l.amount_cents))}</span>
            </li>
          ))}
        </ul>
        {inv.notes ? <p className="muted pre">{inv.notes}</p> : null}
      </section>

      <section className="section">
        <h2>Payments</h2>
        {inv.payments.length === 0 ? (
          <p className="muted">{inv.status === 'void' ? 'None.' : 'No payments recorded yet.'}</p>
        ) : (
          <ul className="list card">
            {inv.payments.map((p) => (
              <li key={p.id} className="list-row static">
                <span className="list-main">
                  <strong>{formatZAR(Number(p.amount_cents))}</strong>
                  <span className="muted small">{[formatDate(p.paid_on), paymentMethodLabel(p.method), p.reference].filter(Boolean).join(' · ')}</span>
                </span>
                {inv.status === 'issued' ? (
                  <button
                    type="button"
                    className="btn btn-link btn-danger-text"
                    disabled={!online || deletePayment.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove the payment of ${formatZAR(Number(p.amount_cents))} on ${formatDate(p.paid_on)}? Only do this if it was recorded by mistake. It stays in the audit log.`)) {
                        deletePayment.mutate(p.id);
                      }
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {deletePayment.isError ? <p className="alert alert-error">{friendlyError(deletePayment.error)}</p> : null}
      </section>

      <section className="section">
        <h2>More</h2>
        <ul className="list card">
          <li>
            <button type="button" className="list-row" onClick={onDownload}>
              <span className="list-icon">
                <Icon name="download" />
              </span>
              <span className="list-main">
                <strong>Download PDF</strong>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="list-row"
              disabled={!online || duplicate.isPending}
              onClick={async () => {
                try {
                  const newId = await duplicate.mutateAsync(inv);
                  navigate(`/invoices/${newId}/edit`);
                } catch {
                  // shown below
                }
              }}
            >
              <span className="list-icon">
                <Icon name="invoice" />
              </span>
              <span className="list-main">
                <strong>{duplicate.isPending ? 'Copying…' : 'Duplicate as new draft'}</strong>
                <span className="muted small">Same customer and lines, new dates</span>
              </span>
            </button>
          </li>
          {inv.status === 'issued' ? (
            <li>
              <button type="button" className="list-row" onClick={() => setVoiding(true)}>
                <span className="list-icon text-red">
                  <Icon name="close" />
                </span>
                <span className="list-main">
                  <strong>Void invoice</strong>
                  <span className="muted small">Cancel it but keep it on record</span>
                </span>
              </button>
            </li>
          ) : null}
        </ul>
        {duplicate.isError ? <p className="alert alert-error">{friendlyError(duplicate.error)}</p> : null}
      </section>

      {pdfError ? <p className="alert alert-error">{pdfError}</p> : null}

      <ActionBar>
        {inv.status === 'issued' && totals.balanceCents > 0 ? (
          <button type="button" className="btn btn-secondary" disabled={!online} onClick={() => setPaying(true)}>
            Record payment
          </button>
        ) : null}
        <button type="button" className={`btn grow ${inv.status === 'void' ? 'btn-secondary' : 'btn-primary'}`} onClick={() => void onShare()}>
          Share
        </button>
      </ActionBar>

      {inv.status === 'issued' ? (
        <RecordPaymentSheet open={paying} onClose={() => setPaying(false)} invoice={{ id: inv.id, number, balanceCents: totals.balanceCents }} />
      ) : null}
      <VoidSheet open={voiding} onClose={() => setVoiding(false)} invoice={{ id: inv.id, number, paymentCount: inv.payments.length }} />

      <Sheet open={fallback} onClose={() => setFallback(false)} title="PDF downloaded">
        <p>This browser can't attach files to WhatsApp directly. The PDF ({invoiceFileName(number)}) is in your downloads: attach it to the message.</p>
        <a className="btn btn-primary btn-block" href={whatsAppLink(customer?.phone, shareText)} target="_blank" rel="noreferrer">
          Open WhatsApp
        </a>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareText);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy message'}
        </button>
        <p className="muted small">{shareText}</p>
      </Sheet>
    </div>
  );
}
