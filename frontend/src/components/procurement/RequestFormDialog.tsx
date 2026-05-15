'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import type { PurchaseRequest, Vendor } from '@/types';
import type { CreateRequestPayload, UpdateRequestPayload, CreateRequestItemPayload } from '@/hooks/useProcurement';

const UNITS = ['units', 'boxes', 'bags', 'vials', 'tubes', 'plates', 'bottles', 'mL', 'L', 'mg', 'g', 'kg'];

interface ItemRow extends CreateRequestItemPayload {
  _key: string;
}

function emptyItem(): ItemRow {
  return { _key: crypto.randomUUID(), item_name: '', quantity: 1, unit: 'units', catalog_number: '', estimated_unit_price: undefined };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRequestPayload | UpdateRequestPayload, submitNow: boolean) => Promise<void>;
  vendors: Vendor[];
  request?: PurchaseRequest | null;
  isStudent?: boolean;
  prefillItemName?: string;
  prefillUnit?: string;
}

export function RequestFormDialog({
  open, onClose, onSubmit, vendors, request, isStudent, prefillItemName, prefillUnit,
}: Props) {
  const isEdit = !!request;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [vendorId, setVendorId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (request) {
      setTitle(request.title);
      setDescription(request.description ?? '');
      setUrgency(request.urgency);
      setVendorId(request.vendor_id ?? '');
      setNotes(request.notes ?? '');
      setItems(
        request.items && request.items.length > 0
          ? request.items.map((i) => ({ ...i, _key: i.id }))
          : [emptyItem()]
      );
    } else {
      setTitle('');
      setDescription('');
      setUrgency('normal');
      setVendorId('');
      setNotes('');
      setItems([
        prefillItemName
          ? { ...emptyItem(), item_name: prefillItemName, unit: prefillUnit ?? 'units' }
          : emptyItem()
      ]);
    }
  }, [open, request, prefillItemName, prefillUnit]);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i._key !== key));
  const updateItem = (key: string, field: keyof ItemRow, value: unknown) =>
    setItems((prev) => prev.map((i) => i._key === key ? { ...i, [field]: value } : i));

  const buildPayload = () => ({
    title: title.trim(),
    description: description.trim() || null,
    urgency,
    vendor_id: vendorId || null,
    notes: notes.trim() || null,
    items: items
      .filter((i) => i.item_name.trim())
      .map(({ _key, ...rest }) => ({
        ...rest,
        item_name: rest.item_name.trim(),
        catalog_number: rest.catalog_number?.trim() || null,
        vendor: rest.vendor?.trim() || null,
        estimated_unit_price: rest.estimated_unit_price ?? null,
      })),
  });

  const handleSaveDraft = async () => {
    setLoading(true);
    try { await onSubmit(buildPayload(), false); onClose(); }
    finally { setLoading(false); }
  };

  const handleSubmitNow = async () => {
    setLoading(true);
    try { await onSubmit(buildPayload(), true); onClose(); }
    finally { setLoading(false); }
  };

  const estimatedTotal = items.reduce((sum, i) => {
    const price = Number(i.estimated_unit_price) || 0;
    return price > 0 ? sum + i.quantity * price : sum;
  }, 0);

  const selectedVendorName = vendors.find((v) => v.id === vendorId)?.name;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Request' : 'New Purchase Request'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">
              Request title <span className="text-red-400">*</span>
            </Label>
            <Input
              placeholder="e.g. Pipette Tips 1000μL — Monthly Reorder"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">
              Description <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              placeholder="Brief justification or context for this request"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Urgency + Vendor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Urgency</Label>
              <Select value={urgency} onValueChange={(v) => setUrgency(v ?? 'normal')}>
                <SelectTrigger className="h-9 text-sm">
                  <span>{URGENCY_LABELS[urgency] ?? urgency}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Vendor</Label>
              <Select value={vendorId} onValueChange={(v) => setVendorId(v ?? '')}>
                <SelectTrigger className="h-9 text-sm">
                  <span className={!vendorId ? 'text-slate-400' : ''}>
                    {vendorId ? (selectedVendorName ?? 'Select vendor') : 'Select vendor'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No vendor</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600">Items</Label>
              {estimatedTotal > 0 && (
                <span className="text-xs text-slate-500">Est. total: <strong className="text-slate-700">${estimatedTotal.toFixed(2)}</strong></span>
              )}
            </div>

            {items.map((item, idx) => (
              <div key={item._key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item._key)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <Input
                  placeholder="Item name *"
                  value={item.item_name}
                  onChange={(e) => updateItem(item._key, 'item_name', e.target.value)}
                  className="h-8 text-sm bg-white"
                />

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(item._key, 'quantity', parseFloat(e.target.value) || 1)}
                    className="h-8 text-sm bg-white"
                  />
                  <Select value={item.unit} onValueChange={(v) => updateItem(item._key, 'unit', v ?? 'units')}>
                    <SelectTrigger className="h-8 text-sm bg-white">
                      <span>{item.unit}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit price $"
                    value={item.estimated_unit_price ?? ''}
                    onChange={(e) => updateItem(item._key, 'estimated_unit_price', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="h-8 text-sm bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Catalog # (optional)"
                    value={item.catalog_number ?? ''}
                    onChange={(e) => updateItem(item._key, 'catalog_number', e.target.value)}
                    className="h-8 text-sm bg-white"
                  />
                  <Input
                    placeholder="Vendor override (optional)"
                    value={item.vendor ?? ''}
                    onChange={(e) => updateItem(item._key, 'vendor', e.target.value)}
                    className="h-8 text-sm bg-white"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="h-8 gap-1.5 text-xs w-full border-dashed"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another item
            </Button>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">
              Notes <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              placeholder="Additional context, preferred vendors, budget notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="h-9">
            Cancel
          </Button>
          {!isEdit && !isStudent && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={loading || !title.trim()}
              className="h-9"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save as Draft
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmitNow}
            disabled={loading || !title.trim()}
            className="h-9 bg-teal-600 hover:bg-teal-700 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Save changes' : isStudent ? 'Submit Suggestion' : 'Submit for Approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const URGENCY_LABELS: Record<string, string> = {
  low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical',
};
