import { STATUS_LABEL, STATUS_TONE, type DisplayStatus } from '../lib/invoiceStatus';

export function StatusPill({ status }: { status: DisplayStatus }) {
  return <span className={`pill pill-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
