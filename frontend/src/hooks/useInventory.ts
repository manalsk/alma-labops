'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import type { InventoryItem, InventoryLocation, InventoryCategory, InventoryActivityLog } from '@/types';

export interface CreateItemPayload {
  name: string;
  category_id?: string | null;
  location_id?: string | null;
  quantity?: number;
  unit?: string;
  threshold?: number;
  reorder_quantity?: number;
  notes?: string | null;
  catalog_number?: string | null;
  vendor?: string | null;
}

export type UpdateItemPayload = Partial<Omit<CreateItemPayload, 'quantity'>>;

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [itemsRes, locationsRes, categoriesRes] = await Promise.all([
        apiClient.get<{ data: InventoryItem[] }>('/api/v1/inventory/', token),
        apiClient.get<{ data: InventoryLocation[] }>('/api/v1/inventory/locations', token),
        apiClient.get<{ data: InventoryCategory[] }>('/api/v1/inventory/categories', token),
      ]);
      setItems(itemsRes.data);
      setLocations(locationsRes.data);
      setCategories(categoriesRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createItem = async (payload: CreateItemPayload): Promise<InventoryItem> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: InventoryItem }>('/api/v1/inventory/', payload, token);
    await refresh();
    return res.data;
  };

  const updateItem = async (itemId: string, payload: UpdateItemPayload): Promise<InventoryItem> => {
    const token = await getToken();
    const res = await apiClient.patch<{ data: InventoryItem }>(`/api/v1/inventory/${itemId}`, payload, token);
    await refresh();
    return res.data;
  };

  const updateQuantity = async (itemId: string, quantity: number, notes?: string): Promise<InventoryItem> => {
    const token = await getToken();
    const res = await apiClient.patch<{ data: InventoryItem }>(
      `/api/v1/inventory/${itemId}/quantity`,
      { quantity, notes },
      token,
    );
    await refresh();
    return res.data;
  };

  const deleteItem = async (itemId: string): Promise<void> => {
    const token = await getToken();
    await apiClient.delete(`/api/v1/inventory/${itemId}`, token);
    await refresh();
  };

  const fetchActivity = async (itemId: string): Promise<InventoryActivityLog[]> => {
    const token = await getToken();
    const res = await apiClient.get<{ data: InventoryActivityLog[] }>(
      `/api/v1/inventory/${itemId}/activity`,
      token,
    );
    return res.data;
  };

  return {
    items,
    locations,
    categories,
    loading,
    error,
    refresh,
    createItem,
    updateItem,
    updateQuantity,
    deleteItem,
    fetchActivity,
  };
}
