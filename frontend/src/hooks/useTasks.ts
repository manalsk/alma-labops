'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import type { Task, TaskActivityLog, LabMember } from '@/types';

export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  priority?: string;
  task_type?: string;
  assigned_to?: string | null;
  due_date?: string | null;
  related_inventory_item_id?: string | null;
  related_purchase_request_id?: string | null;
}

export type UpdateTaskPayload = Partial<CreateTaskPayload>;

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<LabMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [tasksRes, membersRes] = await Promise.all([
        apiClient.get<{ data: Task[] }>('/api/v1/tasks/', token),
        apiClient.get<{ data: LabMember[] }>('/api/v1/auth/members', token),
      ]);
      setTasks(tasksRes.data);
      setMembers(membersRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createTask = async (payload: CreateTaskPayload): Promise<Task> => {
    const token = await getToken();
    const res = await apiClient.post<{ data: Task }>('/api/v1/tasks/', payload, token);
    await refresh();
    return res.data;
  };

  const updateTask = async (id: string, payload: UpdateTaskPayload): Promise<Task> => {
    const token = await getToken();
    const res = await apiClient.patch<{ data: Task }>(`/api/v1/tasks/${id}`, payload, token);
    await refresh();
    return res.data;
  };

  const updateStatus = async (id: string, newStatus: string): Promise<Task> => {
    const token = await getToken();
    const res = await apiClient.patch<{ data: Task }>(`/api/v1/tasks/${id}/status`, { status: newStatus }, token);
    await refresh();
    return res.data;
  };

  const deleteTask = async (id: string): Promise<void> => {
    const token = await getToken();
    await apiClient.delete(`/api/v1/tasks/${id}`, token);
    await refresh();
  };

  const fetchActivity = async (id: string): Promise<TaskActivityLog[]> => {
    const token = await getToken();
    const res = await apiClient.get<{ data: TaskActivityLog[] }>(`/api/v1/tasks/${id}/activity`, token);
    return res.data;
  };

  return {
    tasks,
    members,
    loading,
    error,
    refresh,
    createTask,
    updateTask,
    updateStatus,
    deleteTask,
    fetchActivity,
  };
}
