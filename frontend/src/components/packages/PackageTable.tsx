'use client';

import { Package } from 'lucide-react';
import { ExtractionStatusBadge, ExtractionModeBadge } from './ExtractionStatusBadge';
import { PackageReviewBadge } from './PackageReviewBadge';
import { ConfidenceBadge } from './ConfidenceBadge';
import { Skeleton } from '@/components/ui/skeleton';
import type { IncomingPackage } from '@/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(dateStr).toLocaleDateString();
}

interface Props {
  packages: IncomingPackage[];
  loading: boolean;
  onRowClick: (pkg: IncomingPackage) => void;
}

export function PackageTable({ packages, loading, onRowClick }: Props) {
  const cols = 'grid-cols-[80px_2fr_1fr_140px_140px_100px]';

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className={`grid ${cols} gap-3 px-4 py-3 border-b border-slate-100`}>
          {['Image', 'Item', 'Uploaded by', 'Review Status', 'Extraction', 'Uploaded'].map((h) => (
            <span key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</span>
          ))}
        </div>
        <div className="divide-y divide-slate-50">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`grid ${cols} gap-3 px-4 py-3 items-center`}>
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">No packages yet</p>
        <p className="text-xs text-slate-400 mt-1">Upload a package image to begin AI-assisted intake</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className={`grid ${cols} gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50`}>
        {['Image', 'Item', 'Uploaded by', 'Review Status', 'Extraction', 'Uploaded'].map((h) => (
          <span key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-50">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => onRowClick(pkg)}
            className={`grid ${cols} gap-3 px-4 py-3 items-center w-full text-left hover:bg-slate-50 transition-colors group`}
          >
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 shrink-0">
              {pkg.image_url ? (
                <img
                  src={pkg.image_url}
                  alt={pkg.extracted_item_name ?? 'Package'}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>

            {/* Item info */}
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate group-hover:text-slate-900">
                {pkg.extracted_item_name ?? (
                  <span className="text-slate-400 italic">Not extracted</span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {pkg.extracted_vendor && (
                  <span className="text-xs text-slate-400">{pkg.extracted_vendor}</span>
                )}
                {pkg.extracted_catalog_number && (
                  <span className="text-xs text-slate-400">#{pkg.extracted_catalog_number}</span>
                )}
                {pkg.extracted_storage_condition && (
                  <span className="text-xs text-amber-600 font-medium">⚠ {pkg.extracted_storage_condition}</span>
                )}
              </div>
            </div>

            {/* Uploader */}
            <span className="text-sm text-slate-600 truncate">{pkg.uploaded_by_name}</span>

            {/* Review status */}
            <div className="flex flex-col gap-1">
              <PackageReviewBadge status={pkg.review_status} />
              {pkg.processed_at && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                  ✓ Processed
                </span>
              )}
            </div>

            {/* Extraction */}
            <div className="flex flex-col gap-1">
              <ExtractionStatusBadge status={pkg.extraction_status} />
              {pkg.extraction_mode && <ExtractionModeBadge mode={pkg.extraction_mode} />}
              {pkg.extraction_confidence && pkg.extraction_status === 'completed' && (
                <ConfidenceBadge confidence={pkg.extraction_confidence} />
              )}
            </div>

            {/* Uploaded timestamp */}
            <span className="text-xs text-slate-400">{timeAgo(pkg.created_at)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
