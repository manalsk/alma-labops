'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ALLOWED_TYPES = ['text/plain', 'text/markdown', 'application/pdf'];
const ALLOWED_EXTS = ['.md', '.txt', '.pdf'];
const MAX_SIZE_MB = 5;

const CATEGORIES = [
  { value: 'sop', label: 'SOP' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'safety', label: 'Safety' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'policy', label: 'Policy' },
  { value: 'general', label: 'General' },
];

const VISIBILITY_OPTIONS = [
  { value: 'all_lab_members', label: 'All Lab Members' },
  { value: 'researchers_only', label: 'Researchers + PI' },
  { value: 'pi_only', label: 'PI Only' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, meta: { title: string; category: string; visibility: string }) => Promise<void>;
}

export function KBUploadDialog({ open, onClose, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [visibility, setVisibility] = useState('all_lab_members');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setTitle('');
    setCategory('general');
    setVisibility('all_lab_members');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const selectFile = (f: File) => {
    setError(null);
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(f.type) && !ALLOWED_EXTS.includes(ext)) {
      setError('Only .md, .txt, and .pdf files are supported.');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB} MB.`);
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }, [title]);

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onUpload(file, { title: title.trim(), category, visibility });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setLoading(false);
    }
  };

  const canSubmit = !!file && title.trim().length > 0 && !loading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload KB Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* File drop zone */}
          {!file ? (
            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors
                ${dragging ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">
                Drag & drop or <span className="text-teal-600 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">Markdown, plain text, or PDF — max {MAX_SIZE_MB} MB</p>
              <input
                ref={inputRef}
                type="file"
                accept=".md,.txt,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <FileText className="w-5 h-5 text-teal-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SOP: Biohazard Waste Disposal"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {/* Category + Visibility */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                {VISIBILITY_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              The document will be chunked and embedded automatically after upload.
              It will become searchable via the RAG assistant once indexed.
            </p>
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Upload & Index</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
