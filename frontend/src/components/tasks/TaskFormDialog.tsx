'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import type { Task, LabMember } from '@/types';
import type { CreateTaskPayload } from '@/hooks/useTasks';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
};

const TYPE_LABELS: Record<string, string> = {
  operational: 'Operational',
  lab_maintenance: 'Lab Maintenance',
  procurement: 'Procurement',
  onboarding: 'Onboarding',
  package_intake: 'Package Intake',
  other: 'Other',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskPayload) => Promise<void>;
  members: LabMember[];
  task?: Task | null;
}

export function TaskFormDialog({ open, onClose, onSubmit, members, task }: Props) {
  const isEdit = !!task;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [taskType, setTaskType] = useState('operational');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPriority(task.priority);
      setTaskType(task.task_type);
      setAssignedTo(task.assigned_to ?? '');
      setDueDate(task.due_date ?? '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setTaskType('operational');
      setAssignedTo('');
      setDueDate('');
    }
  }, [open, task]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        task_type: taskType,
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const assignedMemberName = members.find((m) => m.id === assignedTo)?.full_name;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              placeholder="e.g. Restock pipette tips"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">
              Description <span className="text-slate-400">(optional)</span>
            </Label>
            <textarea
              placeholder="Additional context or steps..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            />
          </div>

          {/* Priority + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? 'medium')}>
                <SelectTrigger className="h-9 text-sm">
                  <span>{PRIORITY_LABELS[priority] ?? priority}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Type</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v ?? 'operational')}>
                <SelectTrigger className="h-9 text-sm">
                  <span>{TYPE_LABELS[taskType] ?? taskType}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="lab_maintenance">Lab Maintenance</SelectItem>
                  <SelectItem value="procurement">Procurement</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="package_intake">Package Intake</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Assign to</Label>
              <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? '')}>
                <SelectTrigger className="h-9 text-sm">
                  <span className={!assignedTo ? 'text-slate-400' : ''}>
                    {assignedTo ? (assignedMemberName ?? 'Select member') : 'Unassigned'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="gap-1.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
