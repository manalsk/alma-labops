'use client';

import { useState } from 'react';
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
import type { InventoryItem } from '@/types';

interface QuantityDialogProps {
  item: InventoryItem;
  open: boolean;
  onClose: () => void;
  onSubmit: (quantity: number, notes: string) => Promise<void>;
}

export function QuantityDialog({ item, open, onClose, onSubmit }: QuantityDialogProps) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(quantity);
    if (isNaN(val) || val < 0) return;
    setLoading(true);
    try {
      await onSubmit(val, notes);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Quantity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500 mb-0.5">Item</p>
            <p className="text-sm font-medium text-slate-800">{item.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Current: {item.quantity} {item.unit}
              {item.threshold > 0 && ` · Threshold: ${item.threshold}`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qty" className="text-xs font-medium text-slate-600">
              New quantity ({item.unit})
            </Label>
            <Input
              id="qty"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qty-notes" className="text-xs font-medium text-slate-600">
              Notes <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="qty-notes"
              placeholder="Reason for update..."
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
              Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
