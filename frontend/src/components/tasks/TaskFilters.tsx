'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import type { LabMember } from '@/types';

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
  search: string;
  onSearchChange: (v: string) => void;
  priorityFilter: string;
  onPriorityChange: (v: string) => void;
  typeFilter: string;
  onTypeChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (v: string) => void;
  members: LabMember[];
}

export function TaskFilters({
  search, onSearchChange,
  priorityFilter, onPriorityChange,
  typeFilter, onTypeChange,
  assigneeFilter, onAssigneeChange,
  members,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-48 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-white text-sm"
        />
      </div>

      <Select value={priorityFilter} onValueChange={(v) => onPriorityChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-36 text-sm bg-white">
          <span className={priorityFilter === 'all' ? 'text-slate-400' : ''}>
            {priorityFilter === 'all' ? 'All priorities' : (PRIORITY_LABELS[priorityFilter] ?? priorityFilter)}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>

      <Select value={typeFilter} onValueChange={(v) => onTypeChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-44 text-sm bg-white">
          <span className={typeFilter === 'all' ? 'text-slate-400' : ''}>
            {typeFilter === 'all' ? 'All types' : (TYPE_LABELS[typeFilter] ?? typeFilter)}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="operational">Operational</SelectItem>
          <SelectItem value="lab_maintenance">Lab Maintenance</SelectItem>
          <SelectItem value="procurement">Procurement</SelectItem>
          <SelectItem value="onboarding">Onboarding</SelectItem>
          <SelectItem value="package_intake">Package Intake</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>

      {members.length > 0 && (
        <Select value={assigneeFilter} onValueChange={(v) => onAssigneeChange(v ?? 'all')}>
          <SelectTrigger className="h-9 w-44 text-sm bg-white">
            <span className={assigneeFilter === 'all' ? 'text-slate-400' : ''}>
              {assigneeFilter === 'all'
                ? 'All assignees'
                : (members.find((m) => m.id === assigneeFilter)?.full_name ?? 'All assignees')}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
