'use client';

import { useState } from 'react';
import { Upload, BookOpen, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasPermission } from '@/lib/rbac';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { KBDocumentTable } from '@/components/knowledge-base/KBDocumentTable';
import { KBUploadDialog } from '@/components/knowledge-base/KBUploadDialog';
import { RAGPanel } from '@/components/knowledge-base/RAGPanel';
import type { KBDocument } from '@/types';

export default function KnowledgeBasePage() {
  const profile = useUserProfile();
  const {
    documents, loading, error, refresh,
    uploadDocument, deleteDocument, reingestDocument, askQuestion,
  } = useKnowledgeBase();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<KBDocument | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reingestingId, setReingestingId] = useState<string | null>(null);

  const canUpload = hasPermission(profile.role, 'upload_kb_docs', profile.permissions) || profile.role === 'pi';
  const canDelete = profile.role === 'pi';
  const canReingest = canUpload;

  const handleUpload = async (file: File, meta: { title: string; category: string; visibility: string }) => {
    setActionError(null);
    await uploadDocument(file, meta);
  };

  const handleDelete = async (doc: KBDocument) => {
    setDeletingDoc(doc);
  };

  const confirmDelete = async () => {
    if (!deletingDoc) return;
    setActionError(null);
    try {
      await deleteDocument(deletingDoc.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingDoc(null);
    }
  };

  const handleReingest = async (doc: KBDocument) => {
    setReingestingId(doc.id);
    setActionError(null);
    try {
      await reingestDocument(doc.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Re-ingestion failed');
    } finally {
      setReingestingId(null);
    }
  };

  const indexedCount = documents.filter((d) => d.is_indexed).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-slate-500 text-sm mt-1">
            SOPs, onboarding guides, and policies — searchable via AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {canUpload && (
            <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Documents', value: documents.length },
          { label: 'Indexed', value: indexedCount },
          { label: 'Pending Index', value: documents.length - indexedCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left: document list */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <RefreshCw className="w-6 h-6 text-slate-300 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-slate-400">Loading documents…</p>
            </div>
          ) : (
            <KBDocumentTable
              documents={documents}
              canDelete={canDelete}
              canReingest={canReingest}
              onDelete={handleDelete}
              onReingest={handleReingest}
            />
          )}
        </div>

        {/* Right: RAG assistant panel */}
        <div className="w-105 shrink-0 rounded-xl border border-slate-200 bg-white flex flex-col min-h-150">
          <RAGPanel onAsk={askQuestion} />
        </div>
      </div>

      {/* Upload dialog */}
      <KBUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
      />

      {/* Delete confirmation */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete Document</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  This will permanently delete &ldquo;{deletingDoc.title}&rdquo; and all its indexed chunks.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeletingDoc(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
