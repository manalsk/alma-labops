'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import type { KBDocument, RAGQuery, RAGResponse } from '@/types';

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export function useKnowledgeBase() {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await apiClient.get<{ data: KBDocument[] }>('/api/v1/knowledge-base/', token);
      setDocuments(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const uploadDocument = async (
    file: File,
    meta: { title: string; category: string; visibility: string },
  ): Promise<KBDocument> => {
    const token = await getToken();
    const params = new URLSearchParams({
      title: meta.title,
      category: meta.category,
      visibility: meta.visibility,
    });
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.postFile<{ data: KBDocument }>(
      `/api/v1/knowledge-base/?${params}`,
      form,
      token,
    );
    await refresh();
    return res.data;
  };

  const deleteDocument = async (id: string): Promise<void> => {
    const token = await getToken();
    await apiClient.delete(`/api/v1/knowledge-base/${id}`, token);
    await refresh();
  };

  const reingestDocument = async (id: string): Promise<KBDocument> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: KBDocument }>(
      `/api/v1/knowledge-base/${id}/ingest`,
      {},
      token,
    );
    await refresh();
    return res.data;
  };

  const askQuestion = async (question: string, topK = 5): Promise<RAGResponse> => {
    const token = await getToken();
    const res = await apiClient.post<RAGResponse>(
      '/api/v1/knowledge-base/ask',
      { question, top_k: topK },
      token,
    );
    return res;
  };

  const fetchQueries = async (limit = 20): Promise<RAGQuery[]> => {
    const token = await getToken();
    const res = await apiClient.get<{ data: RAGQuery[] }>(
      `/api/v1/knowledge-base/queries?limit=${limit}`,
      token,
    );
    return res.data;
  };

  return {
    documents,
    loading,
    error,
    refresh,
    uploadDocument,
    deleteDocument,
    reingestDocument,
    askQuestion,
    fetchQueries,
  };
}
