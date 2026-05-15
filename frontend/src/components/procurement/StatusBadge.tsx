import type { PurchaseRequestStatus } from '@/types';

const CONFIG: Record<PurchaseRequestStatus, { label: string; className: string }> = {
  draft:            { label: 'Draft',            className: 'bg-slate-100 text-slate-600' },
  pending_approval: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700' },
  approved:         { label: 'Approved',         className: 'bg-emerald-100 text-emerald-700' },
  rejected:         { label: 'Rejected',         className: 'bg-red-100 text-red-700' },
  ordered:          { label: 'Ordered',          className: 'bg-blue-100 text-blue-700' },
  received:         { label: 'Received',         className: 'bg-teal-100 text-teal-700' },
};

export function ProcurementStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const { label, className } = CONFIG[status] ?? CONFIG.draft;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
