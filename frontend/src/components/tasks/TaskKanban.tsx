import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '@/types';

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo',        label: 'To Do',       color: 'bg-slate-100' },
  { status: 'in_progress', label: 'In Progress',  color: 'bg-blue-50' },
  { status: 'blocked',     label: 'Blocked',      color: 'bg-red-50' },
  { status: 'completed',   label: 'Completed',    color: 'bg-emerald-50' },
];

interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function TaskKanban({ tasks, onTaskClick }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4 min-h-[400px]">
      {COLUMNS.map(({ status, label, color }) => {
        const col = tasks.filter((t) => t.status === status);
        return (
          <div key={status} className="flex flex-col gap-2">
            {/* Column header */}
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${color}`}>
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {label}
              </span>
              <span className="text-xs font-medium text-slate-500 bg-white rounded-full px-1.5 py-0.5 border border-slate-200 tabular-nums">
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {col.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-400">No tasks</p>
                </div>
              ) : (
                col.map((task) => (
                  <TaskCard key={task.id} task={task} onClick={onTaskClick} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
