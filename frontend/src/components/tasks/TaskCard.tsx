import { CalendarDays, User } from 'lucide-react';
import { PriorityBadge, priorityBorderColor } from './PriorityBadge';
import type { Task } from '@/types';

function formatDue(dateStr: string | null): { label: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = due < today;
  return {
    label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overdue,
  };
}

interface Props {
  task: Task;
  onClick: (task: Task) => void;
}

export function TaskCard({ task, onClick }: Props) {
  const due = formatDue(task.due_date);
  const border = priorityBorderColor(task.priority);

  return (
    <button
      type="button"
      onClick={() => onClick(task)}
      className={`w-full text-left rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow border-l-4 ${border} group`}
    >
      <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-slate-900 line-clamp-2">
        {task.title}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <PriorityBadge priority={task.priority} />

        <div className="flex items-center gap-2 ml-auto">
          {due && (
            <span className={`flex items-center gap-1 text-xs ${due.overdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
              <CalendarDays className="w-3 h-3" />
              {due.label}
            </span>
          )}
          {task.assigned_to_name && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <User className="w-3 h-3" />
              {task.assigned_to_name.split(' ')[0]}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
