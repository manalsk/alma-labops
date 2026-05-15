import type { KBVisibility } from '@/types';

const CONFIG: Record<KBVisibility, { label: string; className: string }> = {
  all_lab_members: {
    label: 'All Members',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  researchers_only: {
    label: 'Researchers+',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  pi_only: {
    label: 'PI Only',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export function KBVisibilityBadge({ visibility }: { visibility: KBVisibility }) {
  const cfg = CONFIG[visibility] ?? CONFIG.all_lab_members;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
