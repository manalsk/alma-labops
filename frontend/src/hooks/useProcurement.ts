'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import type { PurchaseRequest, Vendor } from '@/types';

export interface CreateRequestPayload {
  title: string;
  description?: string | null;
  urgency?: string;
  vendor_id?: string | null;
  notes?: string | null;
  submit?: boolean;
  items: CreateRequestItemPayload[];
}

export interface CreateRequestItemPayload {
  item_name: string;
  quantity: number;
  unit: string;
  catalog_number?: string | null;
  vendor?: string | null;
  estimated_unit_price?: number | null;
  inventory_item_id?: string | null;
  notes?: string | null;
}

export type UpdateRequestPayload = Partial<Omit<CreateRequestPayload, 'submit'>>;

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export function useProcurement() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [reqRes, vendorRes] = await Promise.all([
        apiClient.get<{ data: PurchaseRequest[] }>('/api/v1/purchase-requests/', token),
        apiClient.get<{ data: Vendor[] }>('/api/v1/purchase-requests/vendors', token),
      ]);
      setRequests(reqRes.data);
      setVendors(vendorRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load procurement data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createRequest = async (payload: CreateRequestPayload): Promise<PurchaseRequest> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: PurchaseRequest }>('/api/v1/purchase-requests/', payload, token);
    await refresh();
    return res.data;
  };

  const updateRequest = async (id: string, payload: UpdateRequestPayload): Promise<PurchaseRequest> => {
    const token = await getToken();
    const res = await apiClient.patch<{ data: PurchaseRequest }>(`/api/v1/purchase-requests/${id}`, payload, token);
    await refresh();
    return res.data;
  };

  const submitRequest = async (id: string): Promise<PurchaseRequest> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: PurchaseRequest }>(`/api/v1/purchase-requests/${id}/submit`, {}, token);
    await refresh();
    return res.data;
  };

  const approveRequest = async (id: string, notes?: string): Promise<PurchaseRequest> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: PurchaseRequest }>(`/api/v1/purchase-requests/${id}/approve`, { notes: notes ?? null }, token);
    await refresh();
    return res.data;
  };

  const rejectRequest = async (id: string, notes?: string): Promise<PurchaseRequest> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: PurchaseRequest }>(`/api/v1/purchase-requests/${id}/reject`, { notes: notes ?? null }, token);
    await refresh();
    return res.data;
  };

  const requestClarification = async (id: string, note: string): Promise<PurchaseRequest> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: PurchaseRequest }>(`/api/v1/purchase-requests/${id}/clarification`, { note }, token);
    await refresh();
    return res.data;
  };

  const markOrdered = async (id: string): Promise<PurchaseRequest> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: PurchaseRequest }>(`/api/v1/purchase-requests/${id}/order`, {}, token);
    await refresh();
    return res.data;
  };

  const markReceived = async (id: string): Promise<PurchaseRequest> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: PurchaseRequest }>(`/api/v1/purchase-requests/${id}/receive`, {}, token);
    await refresh();
    return res.data;
  };

  const deleteRequest = async (id: string): Promise<void> => {
    const token = await getToken();
    await apiClient.delete(`/api/v1/purchase-requests/${id}`, token);
    await refresh();
  };

  const fetchActivity = async (id: string) => {
    const token = await getToken();
    const res = await apiClient.get<{ data: unknown[] }>(`/api/v1/purchase-requests/${id}/activity`, token);
    return res.data;
  };

  return {
    requests,
    vendors,
    loading,
    error,
    refresh,
    createRequest,
    updateRequest,
    submitRequest,
    approveRequest,
    rejectRequest,
    requestClarification,
    markOrdered,
    markReceived,
    deleteRequest,
    fetchActivity,
  };
}
