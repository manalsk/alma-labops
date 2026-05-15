'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Edit2, Trash2, Hash, Building2, MapPin, Tag, FileText, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusBadge } from './StatusBadge';
import type { InventoryItem, InventoryActivityLog } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  created: 'Item created',
  updated: 'Item updated',
  quantity_updated: 'Quantity updated',
  location_changed: 'Location changed',
  deleted: 'Item deleted',
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

interface InventoryDrawerProps {
  item: InventoryItem | null;
  open: boolean;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onUpdateQuantity: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  canEdit: boolean;
  canDelete: boolean;
  fetchActivity: (itemId: string) => Promise<InventoryActivityLog[]>;
}

export function InventoryDrawer({
  item,
  open,
  onClose,
  onEdit,
  onUpdateQuantity,
  onDelete,
  canEdit,
  canDelete,
  fetchActivity,
}: InventoryDrawerProps) {
  const router = useRouter();
  const [activity, setActivity] = useState<InventoryActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (!item || !open) return;
    setActivityLoading(true);
    fetchActivity(item.id)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [item?.id, open]);

  if (!item) return null;

  const stockPct = item.threshold > 0 ? Math.min((item.quantity / item.threshold) * 100, 100) : 100;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:w-[480px] flex flex-col gap-0 p-0 overflow-hidden" showCloseButton={false}>
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold text-slate-900 leading-tight">
                {item.name}
              </SheetTitle>
              <div className="mt-1.5">
                <StatusBadge status={item.status} />
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Quantity block */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">{item.quantity}</span>
              <span className="text-slate-500 text-sm">{item.unit}</span>
            </div>

            {item.threshold > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Low-stock threshold: {item.threshold} {item.unit}</span>
                  <span>{Math.round(stockPct)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.status === 'out_of_stock'
                        ? 'bg-red-400'
                        : item.status === 'low_stock'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${stockPct}%` }}
                  />
                </div>
              </div>
            )}

            {item.reorder_quantity > 0 && (
              <p className="text-xs text-slate-400">
                Reorder quantity: {item.reorder_quantity} {item.unit}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            {[
              { icon: Tag, label: 'Category', value: item.category_name },
              { icon: MapPin, label: 'Location', value: item.location_name },
              { icon: Building2, label: 'Vendor', value: item.vendor },
              { icon: Hash, label: 'Catalog #', value: item.catalog_number },
            ].map(({ icon: Icon, label, value }) =>
              value ? (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm text-slate-700 font-medium truncate">{value}</p>
                  </div>
                </div>
              ) : null
            )}
            {item.notes && (
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400">Notes</p>
                  <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{item.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Activity log */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Recent activity
            </p>
            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-slate-400">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {activity.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700 font-medium">
                        {ACTION_LABELS[log.action] ?? log.action}
                        {log.new_value?.quantity !== undefined && log.old_value?.quantity !== undefined && (
                          <span className="text-slate-400 font-normal">
                            {' '}({log.old_value.quantity as number} → {log.new_value.quantity as number})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.actor_name ?? 'Unknown'} · {timeAgo(log.created_at)}
                        {log.notes && ` · ${log.notes}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        {((item.status === 'low_stock' || item.status === 'out_of_stock') || canEdit || canDelete) && (
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 space-y-2">
            {(item.status === 'low_stock' || item.status === 'out_of_stock') && (
              <Button
                size="sm"
                onClick={() => router.push(
                  `/purchase-requests?action=new&item_name=${encodeURIComponent(item.name)}&unit=${encodeURIComponent(item.unit)}`
                )}
                className="h-9 w-full bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Reorder
              </Button>
            )}
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(item)}
                      className="h-9 gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onUpdateQuantity(item)}
                      className="h-9 bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      Update Quantity
                    </Button>
                  </>
                )}
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(item)}
                    className="h-9 ml-auto text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
