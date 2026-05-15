import type { TaskStatus } from '@/types';

const CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  todo:        { label: 'To Do',       className: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  blocked:     { label: 'Blocked',     className: 'bg-red-100 text-red-700' },
  completed:   { label: 'Completed',   className: 'bg-emerald-100 text-emerald-700' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, className } = CONFIG[status] ?? CONFIG.todo;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
