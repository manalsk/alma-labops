'use client';

import { useEffect, useState } from 'react';
import {
  X, Loader2, CheckCircle, XCircle, Sparkles, ClipboardList,
  Package, ShieldCheck, FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ExtractionStatusBadge, ExtractionModeBadge } from './ExtractionStatusBadge';
import { PackageReviewBadge } from './PackageReviewBadge';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { IncomingPackage, PackageActivityLog, LabMember } from '@/types';
import type { VerifyExtractionPayload, CreateInventoryPayload, CreateTaskPayload } from '@/hooks/usePackages';

const ACTION_LABELS: Record<string, string> = {
  uploaded: 'Image uploaded',
  mocked_extraction: 'Mocked extraction run',
  ai_extraction: 'Live AI extraction run',
  extraction_failed: 'Extraction failed',
  extraction_verified: 'Extraction verified',
  extraction_rejected: 'Extraction rejected',
  inventory_created: 'Inventory item created',
  task_created: 'Unpacking task created',
  processed: 'Marked as processed',
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

type ActivePanel = null | 'review' | 'inventory' | 'task';

interface Props {
  pkg: IncomingPackage | null;
  open: boolean;
  onClose: () => void;
  onRunExtraction: (id: string, mode: 'mocked' | 'live') => Promise<void>;
  onVerify: (id: string, payload: VerifyExtractionPayload) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onCreateInventory: (id: string, payload: CreateInventoryPayload) => Promise<void>;
  onCreateTask: (id: string, payload: CreateTaskPayload) => Promise<void>;
  onMarkProcessed: (id: string) => Promise<void>;
  fetchActivity: (id: string) => Promise<PackageActivityLog[]>;
  members: LabMember[];
  canVerify: boolean;
  canCreateInventory: boolean;
  canCreateTask: boolean;
  canMarkProcessed: boolean;
}

export function PackageDrawer({
  pkg, open, onClose,
  onRunExtraction, onVerify, onReject, onCreateInventory, onCreateTask, onMarkProcessed,
  fetchActivity, members, canVerify, canCreateInventory, canCreateTask, canMarkProcessed,
}: Props) {
  const [activity, setActivity] = useState<PackageActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Review form state
  const [editName, setEditName] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCatalog, setEditCatalog] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editStorage, setEditStorage] = useState('');

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');

  // Inventory form state
  const [invName, setInvName] = useState('');
  const [invQty, setInvQty] = useState('');
  const [invUnit, setInvUnit] = useState('');
  const [invVendor, setInvVendor] = useState('');
  const [invCatalog, setInvCatalog] = useState('');
  const [invThreshold, setInvThreshold] = useState('0');
  const [invReorderQty, setInvReorderQty] = useState('0');
  const [invNotes, setInvNotes] = useState('');

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!pkg || !open) { setActivePanel(null); return; }
    setActivityLoading(true);
    fetchActivity(pkg.id)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));

    // Pre-fill review form
    setEditName(pkg.extracted_item_name ?? '');
    setEditVendor(pkg.extracted_vendor ?? '');
    setEditQty(pkg.extracted_quantity?.toString() ?? '');
    setEditUnit(pkg.extracted_unit ?? '');
    setEditCatalog(pkg.extracted_catalog_number ?? '');
    setEditCategory(pkg.extracted_category ?? '');
    setEditStorage(pkg.extracted_storage_condition ?? '');

    // Pre-fill inventory form
    setInvName(pkg.extracted_item_name ?? '');
    setInvQty(pkg.extracted_quantity?.toString() ?? '');
    setInvUnit(pkg.extracted_unit ?? '');
    setInvVendor(pkg.extracted_vendor ?? '');
    setInvCatalog(pkg.extracted_catalog_number ?? '');

    // Pre-fill task title
    setTaskTitle(pkg.extracted_item_name ? `Unpack and store: ${pkg.extracted_item_name}` : '');
  }, [pkg?.id, open, pkg?.extraction_status]);

  if (!pkg) return null;

  const hasExtraction = pkg.extraction_status === 'completed';
  const isVerified = pkg.review_status === 'verified';
  const isProcessed = !!pkg.processed_at;
  const isExtracting = pkg.extraction_status === 'processing';

  const handleVerify = async () => {
    await run(async () => {
      await onVerify(pkg.id, {
        extracted_item_name: editName || undefined,
        extracted_vendor: editVendor || undefined,
        extracted_quantity: editQty ? parseFloat(editQty) : undefined,
        extracted_unit: editUnit || undefined,
        extracted_catalog_number: editCatalog || undefined,
        extracted_category: editCategory || undefined,
        extracted_storage_condition: editStorage || undefined,
      });
      setActivePanel(null);
    });
  };

  const handleCreateInventory = async () => {
    await run(async () => {
      await onCreateInventory(pkg.id, {
        item_name: invName || null,
        quantity: invQty ? parseFloat(invQty) : null,
        unit: invUnit || null,
        vendor: invVendor || null,
        catalog_number: invCatalog || null,
        threshold: parseInt(invThreshold) || 0,
        reorder_quantity: parseInt(invReorderQty) || 0,
        notes: invNotes || null,
      });
      setActivePanel(null);
    });
  };

  const handleCreateTask = async () => {
    await run(async () => {
      await onCreateTask(pkg.id, {
        title: taskTitle || undefined,
        assigned_to: taskAssignee || null,
        priority: taskPriority,
      });
      setActivePanel(null);
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[500px] sm:w-[560px] flex flex-col gap-0 p-0 overflow-hidden" showCloseButton={false}>

        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold text-slate-900 leading-tight">
                {pkg.extracted_item_name ?? 'Unreviewed Package'}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <PackageReviewBadge status={pkg.review_status} />
                <ExtractionStatusBadge status={pkg.extraction_status} />
                {pkg.extraction_mode && <ExtractionModeBadge mode={pkg.extraction_mode} />}
              </div>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Image preview */}
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            <img
              src={pkg.image_url}
              alt={pkg.extracted_item_name ?? 'Package'}
              className="w-full max-h-52 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Storage condition warning */}
          {pkg.extracted_storage_condition && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Special Handling Required</p>
              <p className="text-sm text-amber-800">{pkg.extracted_storage_condition}</p>
            </div>
          )}

          {/* Extraction data */}
          {hasExtraction ? (
            activePanel === 'review' ? (
              /* ── Editable review form ── */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Review Extraction</p>
                  <button type="button" onClick={() => setActivePanel(null)} className="text-xs text-slate-400 hover:text-slate-600">
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Review and correct any AI-extracted fields before confirming. All changes are saved on verification.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-slate-500">Item Name</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Vendor</Label>
                    <Input value={editVendor} onChange={(e) => setEditVendor(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Catalog #</Label>
                    <Input value={editCatalog} onChange={(e) => setEditCatalog(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Quantity</Label>
                    <Input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Unit</Label>
                    <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Category</Label>
                    <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Storage Condition</Label>
                    <Input value={editStorage} onChange={(e) => setEditStorage(e.target.value)} className="h-8 text-sm" placeholder="e.g. Keep Frozen" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" disabled={busy || !editName.trim() || !editQty || !editUnit.trim()} onClick={handleVerify} className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Confirm Extraction
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => run(() => onReject(pkg.id))}
                    className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            ) : activePanel === 'inventory' ? (
              /* ── Create inventory panel ── */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Create Inventory Item</p>
                  <button type="button" onClick={() => setActivePanel(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-slate-500">Item name <span className="text-red-400">*</span></Label>
                    <Input value={invName} onChange={(e) => setInvName(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Quantity</Label>
                    <Input type="number" value={invQty} onChange={(e) => setInvQty(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Unit</Label>
                    <Input value={invUnit} onChange={(e) => setInvUnit(e.target.value)} className="h-8 text-sm" placeholder="e.g. boxes" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Vendor</Label>
                    <Input value={invVendor} onChange={(e) => setInvVendor(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Catalog #</Label>
                    <Input value={invCatalog} onChange={(e) => setInvCatalog(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1 col-span-2 border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Stock settings</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Low-stock threshold</Label>
                    <Input type="number" value={invThreshold} onChange={(e) => setInvThreshold(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Reorder quantity</Label>
                    <Input type="number" value={invReorderQty} onChange={(e) => setInvReorderQty(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-slate-500">Notes (optional)</Label>
                    <Input value={invNotes} onChange={(e) => setInvNotes(e.target.value)} placeholder="Any additional notes…" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                  <p className="text-xs text-blue-700">Location and category can be assigned later in Inventory.</p>
                </div>
                <Button size="sm" disabled={busy || !invName.trim()} onClick={handleCreateInventory} className="w-full gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                  Create Inventory Item
                </Button>
              </div>
            ) : activePanel === 'task' ? (
              /* ── Create task panel ── */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Create Unpacking Task</p>
                  <button type="button" onClick={() => setActivePanel(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Task title</Label>
                    <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Assign to</Label>
                      <select
                        value={taskAssignee}
                        onChange={(e) => setTaskAssignee(e.target.value)}
                        className="w-full h-8 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Priority</Label>
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                        className="w-full h-8 rounded-md border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
                <Button size="sm" disabled={busy} onClick={handleCreateTask} className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                  Create Task
                </Button>
              </div>
            ) : (
              /* ── Extracted metadata summary ── */
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Extracted Fields</p>
                  <ConfidenceBadge confidence={pkg.extraction_confidence} />
                </div>
                <MetaRow label="Item" value={pkg.extracted_item_name} />
                <MetaRow label="Vendor" value={pkg.extracted_vendor} />
                <MetaRow label="Catalog #" value={pkg.extracted_catalog_number} />
                <MetaRow label="Quantity" value={pkg.extracted_quantity !== null ? `${pkg.extracted_quantity} ${pkg.extracted_unit ?? ''}` : null} />
                <MetaRow label="Category" value={pkg.extracted_category} />
                {pkg.extraction_notes && (
                  <div className="pt-1 border-t border-slate-200">
                    <p className="text-xs text-slate-400">{pkg.extraction_notes}</p>
                  </div>
                )}
              </div>
            )
          ) : isExtracting ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-700 font-medium">Extraction in progress…</p>
              <p className="text-xs text-blue-500">If this is stuck, use the buttons below to retry.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">No extraction yet</p>
              <p className="text-xs text-slate-400 mt-1">Use "Run Extraction" below to extract metadata from this image</p>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-slate-400 space-y-1">
            <p>Uploaded by <span className="text-slate-600 font-medium">{pkg.uploaded_by_name}</span> · {timeAgo(pkg.created_at)}</p>
            {pkg.linked_inventory_item_id && (
              <p className="text-emerald-600 font-medium">✓ Inventory item created</p>
            )}
            {pkg.linked_task_id && (
              <p className="text-blue-600 font-medium">✓ Unpacking task created</p>
            )}
            {isProcessed && (
              <p className="text-slate-500 font-medium">✓ Processed {timeAgo(pkg.processed_at!)}</p>
            )}
          </div>

          {/* Activity */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Activity</p>
            {activityLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-slate-400">No activity recorded.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700 font-medium">{ACTION_LABELS[log.action] ?? log.action}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.actor_name} · {timeAgo(log.created_at)}
                        {log.notes && ` · ${log.notes}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 space-y-2">
          {/* Run extraction */}
          {activePanel === null && (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => onRunExtraction(pkg.id, 'mocked'))}
                variant="outline"
                className="flex-1 gap-1.5 text-violet-700 border-violet-200 hover:bg-violet-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {hasExtraction ? 'Re-run Mocked' : 'Run Extraction'}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => onRunExtraction(pkg.id, 'live'))}
                variant="outline"
                className="gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50"
                title="Calls OpenAI Vision API"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Live AI
              </Button>
            </div>
          )}

          {/* Review actions */}
          {activePanel === null && hasExtraction && canVerify && !isVerified && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setActivePanel('review')}
              className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Verify Extraction
            </Button>
          )}

          {/* Post-verify actions */}
          {activePanel === null && isVerified && !isProcessed && (
            <div className="flex gap-2">
              {canCreateInventory && !pkg.linked_inventory_item_id && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setActivePanel('inventory')}
                  variant="outline"
                  className="flex-1 gap-1.5"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Add to Inventory
                </Button>
              )}
              {canCreateTask && !pkg.linked_task_id && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setActivePanel('task')}
                  variant="outline"
                  className="flex-1 gap-1.5"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Create Task
                </Button>
              )}
            </div>
          )}

          {/* Mark processed */}
          {activePanel === null && canMarkProcessed && isVerified && !isProcessed && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(() => onMarkProcessed(pkg.id))}
              variant="outline"
              className="w-full gap-1.5 text-slate-600"
            >
              <Package className="w-3.5 h-3.5" />
              Mark as Processed
            </Button>
          )}
        </div>

      </SheetContent>
    </Sheet>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 text-slate-400 text-xs pt-0.5">{label}</span>
      <span className="text-slate-700 text-sm">{value ?? <span className="text-slate-300 italic">—</span>}</span>
    </div>
  );
}
