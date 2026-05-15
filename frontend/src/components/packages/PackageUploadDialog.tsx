'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}

export function PackageUploadDialog({ open, onClose, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const selectFile = (f: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Only JPEG, PNG, or WebP images are supported.');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_SIZE_MB} MB.`);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      await onUpload(file);
      handleClose();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Package Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {!preview ? (
            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors
                ${dragging ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">
                Drag & drop or <span className="text-teal-600 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">JPEG, PNG, WebP — max {MAX_SIZE_MB} MB</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f); }}
              />
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <img
                src={preview}
                alt="Package preview"
                className="w-full max-h-64 object-contain bg-slate-50"
              />
              <button
                type="button"
                onClick={reset}
                className="absolute top-2 right-2 p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <div className="px-3 py-2 border-t border-slate-100 bg-white">
                <p className="text-xs text-slate-500 truncate">{file?.name}</p>
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-600 font-medium mb-1">What happens next?</p>
            <ol className="text-xs text-slate-500 space-y-0.5 list-decimal list-inside">
              <li>Image is uploaded and a package record is created</li>
              <li>Click "Run AI Extraction" in the drawer to extract metadata</li>
              <li>Review and confirm the extracted fields</li>
              <li>Create an inventory item or unpacking task</li>
            </ol>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || !file}
            className="gap-1.5"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Upload Image</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
