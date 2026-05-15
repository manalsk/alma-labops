'use client';

import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useTasks } from '@/hooks/useTasks';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { TaskKanban } from '@/components/tasks/TaskKanban';
import { TaskDrawer } from '@/components/tasks/TaskDrawer';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import type { Task, TaskStatus } from '@/types';
import type { CreateTaskPayload } from '@/hooks/useTasks';

export default function TasksPage() {
  const profile = useUserProfile();
  const { tasks, members, loading, error, createTask, updateTask, updateStatus, deleteTask, fetchActivity } = useTasks();

  const canCreate = profile.role === 'pi' || profile.role === 'researcher';

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  // UI state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !task.title.toLowerCase().includes(q) &&
          !(task.description ?? '').toLowerCase().includes(q) &&
          !(task.assigned_to_name ?? '').toLowerCase().includes(q)
        ) return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && task.task_type !== typeFilter) return false;
      if (assigneeFilter === 'unassigned') {
        if (task.assigned_to !== null) return false;
      } else if (assigneeFilter !== 'all' && task.assigned_to !== assigneeFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, search, priorityFilter, typeFilter, assigneeFilter]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  const handleEdit = (task: Task) => {
    setDrawerOpen(false);
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleDelete = async (task: Task) => {
    try {
      await deleteTask(task.id);
      setDrawerOpen(false);
      setSelectedTask(null);
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      const updated = await updateStatus(task.id, status);
      setSelectedTask(updated);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleFormSubmit = async (data: CreateTaskPayload) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data);
        toast.success('Task updated');
      } else {
        await createTask(data);
        toast.success('Task created');
      }
    } catch {
      toast.error(editingTask ? 'Failed to update task' : 'Failed to create task');
      throw new Error('submit failed');
    }
  };

  const overdueCount = tasks.filter(
    (t) => t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date(),
  ).length;

  const canEditTask = (_task: Task) =>
    profile.role === 'pi' || profile.role === 'researcher';

  const canDeleteTask = () => profile.role === 'pi';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 text-sm mt-1">
            Coordinate operational lab tasks across the team
          </p>
        </div>
        {canCreate && (
          <Button
            size="sm"
            onClick={() => { setEditingTask(null); setFormOpen(true); }}
            className="gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        )}
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-700 font-medium">
            {overdueCount} task{overdueCount > 1 ? 's are' : ' is'} overdue
          </p>
        </div>
      )}

      {/* Filters */}
      <TaskFilters
        search={search}
        onSearchChange={setSearch}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
        members={members}
      />

      {/* Board */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <TaskKanban tasks={filtered} onTaskClick={handleTaskClick} />
      )}

      {/* Drawer */}
      <TaskDrawer
        task={selectedTask}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedTask(null); }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        canEdit={selectedTask ? canEditTask(selectedTask) : false}
        canDelete={canDeleteTask()}
        currentUserId={profile.id}
        currentUserRole={profile.role}
        fetchActivity={fetchActivity}
      />

      {/* Form dialog */}
      <TaskFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTask(null); }}
        onSubmit={handleFormSubmit}
        members={members}
        task={editingTask}
      />
    </div>
  );
}
