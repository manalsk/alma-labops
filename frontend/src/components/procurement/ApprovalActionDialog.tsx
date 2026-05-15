'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

type ActionType = 'approve' | 'reject' | 'clarification';

interface Props {
  open: boolean;
  action: ActionType | null;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
}

const CONFIG: Record<ActionType, { title: string; label: string; placeholder: string; required: boolean; buttonLabel: string; buttonClass: string }> = {
  approve: {
    title: 'Approve Request',
    label: 'Approval notes (optional)',
    placeholder: 'Any notes for the requester...',
    required: false,
    buttonLabel: 'Approve',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  reject: {
    title: 'Reject Request',
    label: 'Rejection reason',
    placeholder: 'Explain why this request is being rejected...',
    required: true,
    buttonLabel: 'Reject',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  clarification: {
    title: 'Request Clarification',
    label: 'Clarification needed',
    placeholder: 'What information do you need from the requester?',
    required: true,
    buttonLabel: 'Send',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
};

export function ApprovalActionDialog({ open, action, onClose, onConfirm }: Props) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const cfg = action ? CONFIG[action] : null;

  useEffect(() => {
    if (open) setNotes('');
  }, [open, action]);

  const handleConfirm = async () => {
    if (!cfg) return;
    if (cfg.required && !notes.trim()) return;
    setLoading(true);
    try {
      await onConfirm(notes.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setNotes(''); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        {cfg && (
          <>
            <DialogHeader>
              <DialogTitle>{cfg.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">
                  {cfg.label}
                  {cfg.required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                <Input
                  placeholder={cfg.placeholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={loading} className="h-9">
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading || (cfg.required && !notes.trim())}
                className={`h-9 ${cfg.buttonClass}`}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {cfg.buttonLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
