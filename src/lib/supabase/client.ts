'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './env';

let client: SupabaseClient | null = null;

/** Browser Supabase client (anon key; RLS decides what each visitor can read/write). */
export function getBrowserClient(): SupabaseClient | null {
  if (!isConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}
