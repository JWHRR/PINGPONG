'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui';
import { useTournament } from './data';
import { getBrowserClient } from './supabase/client';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function adminApi<T = any>(resource: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<T> {
  const sb = getBrowserClient();
  if (!sb) throw new ApiError('Supabase is not configured', 500);
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401);
  let res: Response;
  try {
    res = await fetch(`/api/admin/${resource}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError('Network error — check your connection and try again.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status, json.code);
  return json as T;
}

/** Runs an admin action with busy state, toasts and an immediate data refresh. */
export function useAdminAction() {
  const toast = useToast();
  const { refresh } = useTournament();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(key);
      try {
        const r = await fn();
        if (success) toast('success', success);
        await refresh();
        return r;
      } catch (e) {
        if (e instanceof ApiError && (e.code === 'CONFIRM_REQUIRED' || e.code === 'DOWNSTREAM_PLAYED')) throw e;
        toast('error', e instanceof Error ? e.message : 'Something went wrong');
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast, refresh],
  );
  return { run, busy };
}
