import type { ExtractionStatus, ExtractionMode } from '@/types';

const STATUS_CONFIG: Record<ExtractionStatus, { label: string; className: string }> = {
  pending:    { label: 'Pending Extraction', className: 'bg-slate-100 text-slate-500' },
  processing: { label: 'Processing…',        className: 'bg-blue-100 text-blue-600' },
  completed:  { label: 'Extracted',          className: 'bg-emerald-100 text-emerald-700' },
  failed:     { label: 'Extraction Failed',  className: 'bg-red-100 text-red-600' },
};

const MODE_CONFIG: Record<ExtractionMode, { label: string; className: string }> = {
  mocked:  { label: 'Mocked Extraction', className: 'bg-violet-100 text-violet-600' },
  live_ai: { label: 'Live AI Extraction', className: 'bg-teal-100 text-teal-700' },
};

export function ExtractionStatusBadge({ status }: { status: ExtractionStatus }) {
  const { label, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export function ExtractionModeBadge({ mode }: { mode: ExtractionMode | null }) {
  if (!mode) return null;
  const { label, className } = MODE_CONFIG[mode];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
