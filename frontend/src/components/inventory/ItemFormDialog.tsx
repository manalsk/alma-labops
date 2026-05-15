'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InventoryItem, InventoryCategory, InventoryLocation } from '@/types';
import type { CreateItemPayload, UpdateItemPayload } from '@/hooks/useInventory';

const UNITS = ['units', 'boxes', 'bags', 'vials', 'tubes', 'plates', 'bottles', 'mL', 'L', 'mg', 'g', 'kg'];

interface ItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateItemPayload | UpdateItemPayload) => Promise<void>;
  categories: InventoryCategory[];
  locations: InventoryLocation[];
  item?: InventoryItem | null;
}

export function ItemFormDialog({
  open,
  onClose,
  onSubmit,
  categories,
  locations,
  item,
}: ItemFormDialogProps) {
  const isEdit = !!item;

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState('units');
  const [threshold, setThreshold] = useState('0');
  const [reorderQty, setReorderQty] = useState('0');
  const [vendor, setVendor] = useState('');
  const [catalogNumber, setCatalogNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategoryId(item.category_id ?? '');
      setLocationId(item.location_id ?? '');
      setQuantity(String(item.quantity));
      setUnit(item.unit);
      setThreshold(String(item.threshold));
      setReorderQty(String(item.reorder_quantity));
      setVendor(item.vendor ?? '');
      setCatalogNumber(item.catalog_number ?? '');
      setNotes(item.notes ?? '');
    } else {
      setName(''); setCategoryId(''); setLocationId('');
      setQuantity('0'); setUnit('units');
      setThreshold('0'); setReorderQty('0');
      setVendor(''); setCatalogNumber(''); setNotes('');
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        category_id: categoryId || null,
        location_id: locationId || null,
        unit,
        threshold: parseFloat(threshold) || 0,
        reorder_quantity: parseFloat(reorderQty) || 0,
        vendor: vendor.trim() || null,
        catalog_number: catalogNumber.trim() || null,
        notes: notes.trim() || null,
        ...(!isEdit && { quantity: parseFloat(quantity) || 0 }),
      };
      await onSubmit(payload);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="item-name" className="text-xs font-medium text-slate-600">
              Item name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="item-name"
              placeholder="e.g. Pipette Tips 1000μL"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          {/* Category + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Category</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
                <SelectTrigger className="h-9 text-sm">
                  <span className={categoryId ? 'text-sm' : 'text-sm text-slate-400'}>
                    {categoryId
                      ? (categories.find((c) => c.id === categoryId)?.name ?? 'Select category')
                      : 'Select category'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Location</Label>
              <Select value={locationId} onValueChange={(v) => setLocationId(v ?? '')}>
                <SelectTrigger className="h-9 text-sm">
                  <span className={locationId ? 'text-sm' : 'text-sm text-slate-400'}>
                    {locationId
                      ? (locations.find((l) => l.id === locationId)?.name ?? 'Select location')
                      : 'Select location'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No location</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantity + Unit (create only) */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-qty" className="text-xs font-medium text-slate-600">
                  Initial quantity
                </Label>
                <Input
                  id="item-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Unit</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v ?? 'units')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Edit: unit only */}
          {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v ?? 'units')}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Threshold + Reorder */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-threshold" className="text-xs font-medium text-slate-600">
                Low-stock threshold
              </Label>
              <Input
                id="item-threshold"
                type="number"
                min="0"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-reorder" className="text-xs font-medium text-slate-600">
                Reorder quantity
              </Label>
              <Input
                id="item-reorder"
                type="number"
                min="0"
                step="any"
                value={reorderQty}
                onChange={(e) => setReorderQty(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Vendor + Catalog */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-vendor" className="text-xs font-medium text-slate-600">
                Vendor
              </Label>
              <Input
                id="item-vendor"
                placeholder="e.g. Thermo Fisher"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-catalog" className="text-xs font-medium text-slate-600">
                Catalog number
              </Label>
              <Input
                id="item-catalog"
                placeholder="e.g. 02-707-404"
                value={catalogNumber}
                onChange={(e) => setCatalogNumber(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="item-notes" className="text-xs font-medium text-slate-600">
              Notes <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="item-notes"
              placeholder="Storage conditions, handling instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="h-9 bg-teal-600 hover:bg-teal-700 text-white">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save changes' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
