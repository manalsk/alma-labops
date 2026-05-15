'use client';

import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api/client';
import type { CopilotResponse } from '@/types';

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export function useCopilot() {
  const askQuestion = async (question: string): Promise<CopilotResponse> => {
    const token = await getToken();
    return apiClient.post<CopilotResponse>(
      '/api/v1/copilot/ask',
      { question },
      token,
    );
  };

  return { askQuestion };
}
