'use client';

import { useEffect, useState } from 'react';
import { X, Edit2, Trash2, Package, Building2, MessageSquare, CheckCircle, XCircle, ShoppingCart, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ProcurementStatusBadge } from './StatusBadge';
import { UrgencyBadge } from './UrgencyBadge';
import type { PurchaseRequest, ProcurementActivityLog } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  created: 'Request created',
  submitted: 'Submitted for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  clarification_requested: 'Clarification requested',
  ordered: 'Marked as ordered',
  received: 'Marked as received',
  edited: 'Request edited',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  request: PurchaseRequest | null;
  open: boolean;
  onClose: () => void;
  onEdit: (req: PurchaseRequest) => void;
  onDelete: (req: PurchaseRequest) => void;
  onApprove: (req: PurchaseRequest) => void;
  onReject: (req: PurchaseRequest) => void;
  onClarification: (req: PurchaseRequest) => void;
  onSubmit: (req: PurchaseRequest) => void;
  onMarkOrdered: (req: PurchaseRequest) => void;
  onMarkReceived: (req: PurchaseRequest) => void;
  canApprove: boolean;
  canViewFinancials: boolean;
  currentUserId: string;
  currentUserRole: string;
  fetchActivity: (id: string) => Promise<unknown[]>;
}

export function ProcurementDrawer({
  request, open, onClose,
  onEdit, onDelete, onApprove, onReject, onClarification, onSubmit, onMarkOrdered, onMarkReceived,
  canApprove, canViewFinancials, currentUserId, currentUserRole, fetchActivity,
}: Props) {
  const [activity, setActivity] = useState<ProcurementActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!request || !open) return;
    setActivityLoading(true);
    fetchActivity(request.id)
      .then((data) => setActivity(data as ProcurementActivityLog[]))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [request?.id, open]);

  if (!request) return null;

  const isOwnRequest = request.requester_id === currentUserId;
  const canEdit = (isOwnRequest && ['draft', 'pending_approval'].includes(request.status)) || currentUserRole === 'pi';
  const canDelete = currentUserRole === 'pi' || (isOwnRequest && request.status === 'draft');
  const canSubmit = isOwnRequest && request.status === 'draft';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[460px] sm:w-[520px] flex flex-col gap-0 p-0 overflow-hidden" showCloseButton={false}>
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-base font-semibold text-slate-900 leading-tight">
                  {request.title}
                </SheetTitle>
                {request.is_suggestion && (
                  <span className="text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-medium shrink-0">
                    Suggestion
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <ProcurementStatusBadge status={request.status} />
                <UrgencyBadge urgency={request.urgency} />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Clarification banner */}
          {request.clarification_note && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Clarification Requested</p>
              <p className="text-sm text-amber-800">{request.clarification_note}</p>
              <p className="text-xs text-amber-500 mt-1">{formatDate(request.clarification_requested_at)}</p>
            </div>
          )}

          {/* Rejection reason */}
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Rejection Reason</p>
              <p className="text-sm text-red-800">{request.rejection_reason}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm">
            <MetaRow label="Requester" value={request.requester_name} />
            {request.vendor_name && <MetaRow label="Vendor" value={request.vendor_name} icon={<Building2 className="w-3.5 h-3.5" />} />}
            <MetaRow label="Submitted" value={formatDate(request.created_at)} />
            {request.approved_at && <MetaRow label="Approved by" value={`${request.approver_name} · ${formatDate(request.approved_at)}`} />}
            {request.ordered_at && <MetaRow label="Ordered" value={formatDate(request.ordered_at)} />}
            {request.received_at && <MetaRow label="Received" value={formatDate(request.received_at)} />}
            {canViewFinancials && request.estimated_total != null && (
              <MetaRow label="Est. Total" value={`$${Number(request.estimated_total).toFixed(2)}`} />
            )}
          </div>

          {/* Description + notes */}
          {request.description && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{request.description}</p>
            </div>
          )}
          {request.notes && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Notes</p>
              <p className="text-sm text-slate-600 leading-relaxed">{request.notes}</p>
            </div>
          )}

          {/* Items */}
          {request.items && request.items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Items ({request.items.length})
              </p>
              <div className="space-y-2">
                {request.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <Package className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{item.item_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.quantity} {item.unit}
                        {item.catalog_number && ` · #${item.catalog_number}`}
                        {item.vendor && ` · ${item.vendor}`}
                      </p>
                    </div>
                    {canViewFinancials && item.estimated_unit_price != null && (
                      <span className="text-xs text-slate-600 tabular-nums shrink-0">
                        ${(item.quantity * item.estimated_unit_price).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity timeline */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Activity</p>
            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-slate-400">No activity recorded.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700 font-medium">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.actor_name ?? 'Unknown'} · {timeAgo(log.created_at)}
                        {log.notes && ` · "${log.notes}"`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 space-y-2">
          {/* Approval actions — PI only */}
          {canApprove && request.status === 'pending_approval' && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => onApprove(request))}
                className="h-9 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => onReject(request))}
                className="h-9 flex-1 text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => onClarification(request))}
                className="h-9 gap-1.5"
                title="Request clarification"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Order / Receive */}
          {canApprove && request.status === 'approved' && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(() => onMarkOrdered(request))}
              className="h-9 w-full bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Mark as Ordered
            </Button>
          )}
          {request.status === 'ordered' && (currentUserRole === 'pi' || currentUserRole === 'researcher') && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(() => onMarkReceived(request))}
              className="h-9 w-full bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
            >
              <Inbox className="w-3.5 h-3.5" />
              Mark as Received
            </Button>
          )}

          {/* Submit draft */}
          {canSubmit && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(() => onSubmit(request))}
              className="h-9 w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              Submit for Approval
            </Button>
          )}

          {/* Edit / Delete */}
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-2 pt-1">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onEdit(request)}
                  className="h-9 gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => run(() => onDelete(request))}
                  className="h-9 ml-auto text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MetaRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-28 shrink-0 text-slate-400 text-xs pt-0.5">{label}</span>
      <span className="text-slate-700 flex items-center gap-1.5">
        {icon}
        {value}
      </span>
    </div>
  );
}
