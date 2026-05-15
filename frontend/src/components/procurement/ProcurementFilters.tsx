'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Vendor } from '@/types';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  urgencyFilter: string;
  onUrgencyChange: (v: string) => void;
  vendorFilter: string;
  onVendorChange: (v: string) => void;
  vendors: Vendor[];
}

export function ProcurementFilters({
  search, onSearchChange,
  statusFilter, onStatusChange,
  urgencyFilter, onUrgencyChange,
  vendorFilter, onVendorChange,
  vendors,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-48 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search requests..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-white text-sm"
        />
      </div>

      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-44 text-sm bg-white">
          <span className={statusFilter === 'all' ? 'text-slate-400' : ''}>
            {statusFilter === 'all' ? 'All statuses' : STATUS_LABELS[statusFilter] ?? statusFilter}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="pending_approval">Pending Approval</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="ordered">Ordered</SelectItem>
          <SelectItem value="received">Received</SelectItem>
        </SelectContent>
      </Select>

      <Select value={urgencyFilter} onValueChange={(v) => onUrgencyChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-36 text-sm bg-white">
          <span className={urgencyFilter === 'all' ? 'text-slate-400' : ''}>
            {urgencyFilter === 'all' ? 'All urgency' : URGENCY_LABELS[urgencyFilter] ?? urgencyFilter}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All urgency</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>

      {vendors.length > 0 && (
        <Select value={vendorFilter} onValueChange={(v) => onVendorChange(v ?? 'all')}>
          <SelectTrigger className="h-9 w-48 text-sm bg-white">
            <span className={vendorFilter === 'all' ? 'text-slate-400' : ''}>
              {vendorFilter === 'all'
                ? 'All vendors'
                : (vendors.find((v) => v.id === vendorFilter)?.name ?? 'All vendors')}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  ordered: 'Ordered',
  received: 'Received',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical',
};
