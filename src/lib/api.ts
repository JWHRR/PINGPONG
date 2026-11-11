import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { ServiceError, type Ctx } from './service';
import { supabaseRepo } from './supabase/repo';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './supabase/env';

export function jsonError(status: number, error: string, code?: string) {
  return NextResponse.json({ error, code }, { status });
}

/**
 * Wrap an admin API handler: verifies the Supabase access token, checks the caller
 * is in `public.admins`, and executes all DB work with the caller's JWT so Row
 * Level Security is enforced by the database as a second line of defence.
 */
export function adminHandler(fn: (ctx: Ctx, body: Record<string, any>, req: NextRequest) => Promise<unknown>) {
  return async (req: NextRequest) => {
    if (!isConfigured) return jsonError(500, 'Server is not configured: missing Supabase environment variables.');
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return jsonError(401, 'Sign in as an administrator first.', 'UNAUTHENTICATED');

    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData.user) return jsonError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED');
    const { data: admin, error: adminErr } = await sb
      .from('admins')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (adminErr) return jsonError(500, `Could not verify administrator: ${adminErr.message}`);
    if (!admin) return jsonError(403, 'This account is not an administrator.', 'FORBIDDEN');

    let body: Record<string, any> = {};
    if (req.method !== 'GET') {
      try {
        body = (await req.json()) ?? {};
      } catch {
        return jsonError(400, 'Request body must be valid JSON.');
      }
      if (typeof body !== 'object' || Array.isArray(body)) return jsonError(400, 'Request body must be a JSON object.');
    }

    try {
      const result = await fn({ repo: supabaseRepo(sb), userId: userData.user.id }, body, req);
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof ServiceError) return jsonError(e.status, e.message, e.code);
      console.error('[admin api]', e);
      return jsonError(500, e instanceof Error ? e.message : 'Unexpected server error');
    }
  };
}

export function requireId(body: Record<string, any>, field = 'id'): string {
  const v = body[field];
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v)) throw new ServiceError(400, `${field} must be a valid id`);
  return v;
}
