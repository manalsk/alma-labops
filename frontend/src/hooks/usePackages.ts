'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import type { IncomingPackage, PackageActivityLog } from '@/types';

export interface VerifyExtractionPayload {
  extracted_item_name?: string | null;
  extracted_vendor?: string | null;
  extracted_quantity?: number | null;
  extracted_unit?: string | null;
  extracted_catalog_number?: string | null;
  extracted_category?: string | null;
  extracted_storage_condition?: string | null;
  extraction_notes?: string | null;
}

export interface CreateInventoryPayload {
  location_id?: string | null;
  category_id?: string | null;
  threshold?: number;
  reorder_quantity?: number;
  notes?: string | null;
  item_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  catalog_number?: string | null;
  vendor?: string | null;
}

export interface CreateTaskPayload {
  title?: string | null;
  description?: string | null;
  assigned_to?: string | null;
  priority?: string;
  due_date?: string | null;
}

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export function usePackages() {
  const [packages, setPackages] = useState<IncomingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await apiClient.get<{ data: IncomingPackage[] }>('/api/v1/incoming-packages/', token);
      setPackages(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const uploadPackage = async (file: File): Promise<IncomingPackage> => {
    const token = await getToken();
    const form = new FormData();
    form.append('image', file);
    const res = await apiClient.postFile<{ data: IncomingPackage }>('/api/v1/incoming-packages/', form, token);
    await refresh();
    return res.data;
  };

  const runExtraction = async (id: string, mode: 'mocked' | 'live'): Promise<IncomingPackage> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: IncomingPackage }>(
      `/api/v1/incoming-packages/${id}/extract?mode=${mode}`,
      {},
      token,
    );
    await refresh();
    return res.data;
  };

  const verifyExtraction = async (id: string, payload: VerifyExtractionPayload): Promise<IncomingPackage> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: IncomingPackage }>(
      `/api/v1/incoming-packages/${id}/verify`,
      payload,
      token,
    );
    await refresh();
    return res.data;
  };

  const rejectExtraction = async (id: string, notes?: string): Promise<IncomingPackage> => {
    const token = await getToken();
    const params = notes ? `?notes=${encodeURIComponent(notes)}` : '';
    const res = await apiClient.post<{ data: IncomingPackage }>(
      `/api/v1/incoming-packages/${id}/reject${params}`,
      {},
      token,
    );
    await refresh();
    return res.data;
  };

  const createInventory = async (id: string, payload: CreateInventoryPayload): Promise<IncomingPackage> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: IncomingPackage }>(
      `/api/v1/incoming-packages/${id}/create-inventory`,
      payload,
      token,
    );
    await refresh();
    return res.data;
  };

  const createTask = async (id: string, payload: CreateTaskPayload): Promise<IncomingPackage> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: IncomingPackage }>(
      `/api/v1/incoming-packages/${id}/create-task`,
      payload,
      token,
    );
    await refresh();
    return res.data;
  };

  const markProcessed = async (id: string): Promise<IncomingPackage> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: IncomingPackage }>(
      `/api/v1/incoming-packages/${id}/process`,
      {},
      token,
    );
    await refresh();
    return res.data;
  };

  const fetchActivity = async (id: string): Promise<PackageActivityLog[]> => {
    const token = await getToken();
    const res = await apiClient.get<{ data: PackageActivityLog[] }>(
      `/api/v1/incoming-packages/${id}/activity`,
      token,
    );
    return res.data;
  };

  return {
    packages,
    loading,
    error,
    refresh,
    uploadPackage,
    runExtraction,
    verifyExtraction,
    rejectExtraction,
    createInventory,
    createTask,
    markProcessed,
    fetchActivity,
  };
}
