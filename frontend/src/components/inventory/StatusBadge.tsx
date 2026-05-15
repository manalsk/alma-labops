import type { InventoryStatus } from '@/types';

const STATUS_CONFIG: Record<InventoryStatus, { label: string; className: string }> = {
  in_stock: {
    label: 'In Stock',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  low_stock: {
    label: 'Low Stock',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  out_of_stock: {
    label: 'Out of Stock',
    className: 'bg-red-50 text-red-600 border-red-200',
  },
};

export function StatusBadge({ status }: { status: InventoryStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.in_stock;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
