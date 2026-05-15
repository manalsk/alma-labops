'use client';

import { useEffect, useState } from 'react';
import { X, Edit2, Trash2, CheckCircle, RotateCcw, Ban, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskStatusBadge } from './TaskStatusBadge';
import { PriorityBadge } from './PriorityBadge';
import type { Task, TaskActivityLog, TaskStatus } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  created: 'Task created',
  assigned: 'Assigned',
  status_changed: 'Status changed',
  completed: 'Marked complete',
  edited: 'Task edited',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  operational: 'Operational',
  lab_maintenance: 'Lab Maintenance',
  procurement: 'Procurement',
  onboarding: 'Onboarding',
  package_intake: 'Package Intake',
  other: 'Other',
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
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => Promise<void>;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string;
  currentUserRole: string;
  fetchActivity: (id: string) => Promise<TaskActivityLog[]>;
}

export function TaskDrawer({
  task, open, onClose,
  onEdit, onDelete, onStatusChange,
  canEdit, canDelete, currentUserId, currentUserRole, fetchActivity,
}: Props) {
  const [activity, setActivity] = useState<TaskActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!task || !open) return;
    setActivityLoading(true);
    fetchActivity(task.id)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [task?.id, open]);

  if (!task) return null;

  const isStudent = currentUserRole === 'student';
  const isAssignedToMe = task.assigned_to === currentUserId;
  const canChangeStatus = !isStudent || isAssignedToMe;

  const isDue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[460px] sm:w-[520px] flex flex-col gap-0 p-0 overflow-hidden" showCloseButton={false}>
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold text-slate-900 leading-tight">
                {task.title}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <TaskStatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                {task.ai_generated && (
                  <span className="text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-medium">
                    AI Generated
                  </span>
                )}
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
          {/* Overdue banner */}
          {isDue && task.status !== 'completed' && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-semibold text-red-700">Overdue — was due {formatDate(task.due_date)}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm">
            <MetaRow label="Type" value={TASK_TYPE_LABELS[task.task_type] ?? task.task_type} />
            <MetaRow label="Created by" value={task.created_by_name} />
            <MetaRow label="Assigned to" value={task.assigned_to_name ?? '—'} />
            <MetaRow label="Due date" value={formatDate(task.due_date)} />
            {task.completed_at && <MetaRow label="Completed" value={formatDate(task.completed_at)} />}
            <MetaRow label="Created" value={formatDate(task.created_at)} />
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Activity */}
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
                        {log.new_value && log.action === 'assigned' && ` → ${log.new_value}`}
                        {log.old_value && log.new_value && log.action === 'status_changed' && ` → ${log.new_value}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.actor_name} · {timeAgo(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 space-y-2">
          {/* Status actions */}
          {canChangeStatus && task.status !== 'completed' && (
            <div className="flex items-center gap-2">
              {task.status === 'todo' && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => run(() => onStatusChange(task, 'in_progress'))}
                  className="h-9 flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Task
                </Button>
              )}
              {task.status === 'in_progress' && (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => onStatusChange(task, 'completed'))}
                    className="h-9 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Complete
                  </Button>
                  {!isStudent && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(() => onStatusChange(task, 'blocked'))}
                      className="h-9 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Block
                    </Button>
                  )}
                </>
              )}
              {task.status === 'blocked' && !isStudent && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => run(() => onStatusChange(task, 'in_progress'))}
                  className="h-9 flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Unblock
                </Button>
              )}
            </div>
          )}

          {/* Reopen completed */}
          {task.status === 'completed' && !isStudent && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(() => onStatusChange(task, 'todo'))}
              className="h-9 w-full gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reopen
            </Button>
          )}

          {/* Edit / Delete */}
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-2 pt-1">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(task)}
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
                  onClick={() => run(() => { onDelete(task); return Promise.resolve(); })}
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-28 shrink-0 text-slate-400 text-xs pt-0.5">{label}</span>
      <span className="text-slate-700 text-sm">{value}</span>
    </div>
  );
}
