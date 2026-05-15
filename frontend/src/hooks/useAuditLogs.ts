'use client';

import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import type { AuditLog, AIAuditLog } from '@/types';

export interface AuditLogFilters {
  event_type?: string;
  actor_role?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AILogFilters {
  tool_called?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function useAuditLogs() {
  async function fetchLogs(filters: AuditLogFilters = {}): Promise<{ data: AuditLog[]; total: number }> {
    const token = await getToken();
    const qs = buildQuery(filters as Record<string, string | number | undefined>);
    return apiClient.get(`/api/v1/audit-logs/${qs}`, token);
  }

  async function fetchAILogs(filters: AILogFilters = {}): Promise<{ data: AIAuditLog[]; total: number }> {
    const token = await getToken();
    const qs = buildQuery(filters as Record<string, string | number | undefined>);
    return apiClient.get(`/api/v1/audit-logs/ai${qs}`, token);
  }

  return { fetchLogs, fetchAILogs };
}
