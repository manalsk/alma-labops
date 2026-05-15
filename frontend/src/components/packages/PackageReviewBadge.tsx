import type { PackageReviewStatus } from '@/types';

const CONFIG: Record<PackageReviewStatus, { label: string; className: string }> = {
  pending:       { label: 'Awaiting Review',  className: 'bg-amber-100 text-amber-700' },
  verified:      { label: 'Verified',         className: 'bg-emerald-100 text-emerald-700' },
  rejected:      { label: 'Rejected',         className: 'bg-red-100 text-red-600' },
  manual_review: { label: 'Manual Review',    className: 'bg-orange-100 text-orange-600' },
};

export function PackageReviewBadge({ status }: { status: PackageReviewStatus }) {
  const { label, className } = CONFIG[status] ?? CONFIG.pending;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
