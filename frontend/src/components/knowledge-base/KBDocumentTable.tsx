'use client';

import { FileText, CheckCircle2, Clock, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { KBVisibilityBadge } from './KBVisibilityBadge';
import { Button } from '@/components/ui/button';
import type { KBDocument } from '@/types';

interface Props {
  documents: KBDocument[];
  canDelete: boolean;
  canReingest: boolean;
  onDelete: (doc: KBDocument) => void;
  onReingest: (doc: KBDocument) => void;
}

function IndexStatus({ doc }: { doc: KBDocument }) {
  if (doc.is_indexed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {doc.chunk_count} chunk{doc.chunk_count !== 1 ? 's' : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
      <Clock className="w-3.5 h-3.5" />
      Not indexed
    </span>
  );
}

export function KBDocumentTable({ documents, canDelete, canReingest, onDelete, onReingest }: Props) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">No documents yet</p>
        <p className="text-xs text-slate-400 mt-1">Upload SOPs, guides, and policies to populate the knowledge base.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Document</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Visibility</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Index</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Uploaded</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-800 leading-tight">{doc.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{doc.file_type}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="capitalize text-slate-600 text-xs">{doc.category}</span>
              </td>
              <td className="px-4 py-3">
                <KBVisibilityBadge visibility={doc.visibility} />
              </td>
              <td className="px-4 py-3">
                <IndexStatus doc={doc} />
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                <p>{doc.uploaded_by_name ?? '—'}</p>
                <p className="text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="View document"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {canReingest && (
                    <button
                      onClick={() => onReingest(doc)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Re-index"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDelete(doc)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
