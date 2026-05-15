import type { TaskPriority } from '@/types';

const CONFIG: Record<TaskPriority, { label: string; className: string; borderColor: string }> = {
  low:    { label: 'Low',    className: 'bg-slate-100 text-slate-500',   borderColor: 'border-slate-300' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700',   borderColor: 'border-amber-400' },
  high:   { label: 'High',   className: 'bg-orange-100 text-orange-700', borderColor: 'border-orange-500' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700',       borderColor: 'border-red-500' },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, className } = CONFIG[priority] ?? CONFIG.medium;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export function priorityBorderColor(priority: TaskPriority): string {
  return CONFIG[priority]?.borderColor ?? 'border-slate-300';
}
