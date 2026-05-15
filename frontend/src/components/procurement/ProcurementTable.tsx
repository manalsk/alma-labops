'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { ProcurementStatusBadge } from './StatusBadge';
import { UrgencyBadge } from './UrgencyBadge';
import type { PurchaseRequest } from '@/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(dateStr).toLocaleDateString();
}

interface Props {
  requests: PurchaseRequest[];
  loading: boolean;
  onRowClick: (req: PurchaseRequest) => void;
  canViewFinancials: boolean;
}

export function ProcurementTable({ requests, loading, onRowClick, canViewFinancials }: Props) {
  const cols = canViewFinancials
    ? 'grid-cols-[2fr_1fr_80px_140px_88px_76px]'
    : 'grid-cols-[2fr_1fr_80px_140px_76px]';

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`grid ${cols} gap-4 px-4 py-4 items-center`}>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
              {canViewFinancials && <Skeleton className="h-4 w-16" />}
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-400 text-sm">No purchase requests found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className={`grid ${cols} gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide`}>
        <span>Request</span>
        <span>Requester</span>
        <span>Urgency</span>
        <span>Status</span>
        {canViewFinancials && <span className="text-right">Est. Total</span>}
        <span className="text-right">Submitted</span>
      </div>

      <div className="divide-y divide-slate-100">
        {requests.map((req) => (
          <button
            key={req.id}
            type="button"
            onClick={() => onRowClick(req)}
            className={`w-full grid ${cols} gap-4 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors items-center`}
          >
            {/* Title + description */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{req.title}</p>
                {req.is_suggestion && (
                  <span className="shrink-0 text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-medium">
                    Suggestion
                  </span>
                )}
              </div>
              {req.description && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{req.description}</p>
              )}
              {req.vendor_name && (
                <p className="text-xs text-slate-400 mt-0.5">via {req.vendor_name}</p>
              )}
            </div>

            {/* Requester */}
            <div className="min-w-0">
              <p className="text-sm text-slate-700 truncate">{req.requester_name}</p>
              {(req.item_count ?? 0) > 0 && (
                <p className="text-xs text-slate-400">
                  {req.item_count} item{req.item_count !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Urgency */}
            <UrgencyBadge urgency={req.urgency} />

            {/* Status */}
            <ProcurementStatusBadge status={req.status} />

            {/* Estimated total */}
            {canViewFinancials && (
              <span className="text-sm text-slate-700 text-right tabular-nums">
                {req.estimated_total != null
                  ? `$${Number(req.estimated_total).toFixed(2)}`
                  : '—'}
              </span>
            )}

            {/* Time */}
            <span className="text-xs text-slate-400 text-right whitespace-nowrap">
              {timeAgo(req.created_at)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
