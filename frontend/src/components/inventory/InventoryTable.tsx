'use client';

import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const COL = 'grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_40px]';

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  onRowClick: (item: InventoryItem) => void;
}

export function InventoryTable({ items, loading, onRowClick }: InventoryTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-4">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-24 ml-4" />
              <Skeleton className="h-4 w-16 ml-4" />
              <Skeleton className="h-4 w-28 ml-4" />
              <Skeleton className="h-5 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
        <p className="text-slate-500 text-sm font-medium">No items found</p>
        <p className="text-slate-400 text-xs mt-1">
          Try adjusting your filters or add a new inventory item.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className={`grid ${COL} gap-4 px-4 py-2.5 border-b border-slate-100 bg-slate-50`}>
        {['Item', 'Category', 'Quantity', 'Location', 'Status', 'Updated', ''].map((h) => (
          <span key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const needsAttention = item.status === 'low_stock' || item.status === 'out_of_stock';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onRowClick(item)}
              className={cn(
                `w-full grid ${COL} gap-4 px-4 py-3.5 text-left hover:bg-slate-50/80 transition-colors items-center`,
                needsAttention && 'border-l-2 border-amber-400'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {needsAttention && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span className="text-sm font-medium text-slate-800 truncate">{item.name}</span>
              </div>
              <span className="text-sm text-slate-500 truncate">{item.category_name ?? '—'}</span>
              <span className="text-sm text-slate-700 font-medium tabular-nums">
                {item.quantity} {item.unit}
              </span>
              <span className="text-sm text-slate-500 truncate">{item.location_name ?? '—'}</span>
              <StatusBadge status={item.status} />
              <span className="text-xs text-slate-400">{timeAgo(item.updated_at)}</span>
              <ChevronRight className="w-4 h-4 text-slate-300 justify-self-end" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
