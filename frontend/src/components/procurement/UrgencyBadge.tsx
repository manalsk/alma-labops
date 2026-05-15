import type { PurchaseRequestUrgency } from '@/types';

const CONFIG: Record<PurchaseRequestUrgency, { label: string; className: string }> = {
  low:      { label: 'Low',      className: 'bg-slate-100 text-slate-500' },
  normal:   { label: 'Normal',   className: 'bg-sky-100 text-sky-700' },
  high:     { label: 'High',     className: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 font-semibold' },
};

export function UrgencyBadge({ urgency }: { urgency: PurchaseRequestUrgency }) {
  const { label, className } = CONFIG[urgency] ?? CONFIG.normal;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${className}`}>
      {label}
    </span>
  );
}
