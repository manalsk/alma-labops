'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  reviewFilter: string;
  onReviewChange: (v: string) => void;
  extractionFilter: string;
  onExtractionChange: (v: string) => void;
}

const REVIEW_LABELS: Record<string, string> = {
  pending: 'Awaiting Review',
  verified: 'Verified',
  rejected: 'Rejected',
  manual_review: 'Manual Review',
};

const EXTRACTION_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

export function PackageFilters({
  search, onSearchChange,
  reviewFilter, onReviewChange,
  extractionFilter, onExtractionChange,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-48 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search packages..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-white text-sm"
        />
      </div>

      <Select value={reviewFilter} onValueChange={(v) => onReviewChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-44 text-sm bg-white">
          <span className={reviewFilter === 'all' ? 'text-slate-400' : ''}>
            {reviewFilter === 'all' ? 'All statuses' : (REVIEW_LABELS[reviewFilter] ?? reviewFilter)}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Awaiting Review</SelectItem>
          <SelectItem value="verified">Verified</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="manual_review">Manual Review</SelectItem>
        </SelectContent>
      </Select>

      <Select value={extractionFilter} onValueChange={(v) => onExtractionChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-44 text-sm bg-white">
          <span className={extractionFilter === 'all' ? 'text-slate-400' : ''}>
            {extractionFilter === 'all' ? 'All extractions' : (EXTRACTION_LABELS[extractionFilter] ?? extractionFilter)}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All extractions</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
