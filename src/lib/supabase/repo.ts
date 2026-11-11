import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError, type Repo, type Table } from '../service';

function fail(error: { message: string; code?: string; details?: string | null }): never {
  // Map common Postgres errors to friendly messages.
  if (error.code === '23505') throw new ServiceError(400, 'This entry already exists (duplicate).', 'DUPLICATE');
  if (error.code === '23503') throw new ServiceError(400, 'This record is still referenced by other data.', 'IN_USE');
  if (error.code === '42501') throw new ServiceError(403, 'You do not have permission to change this data.', 'FORBIDDEN');
  if (error.code === 'P0001') throw new ServiceError(400, error.message, 'RULE');
  throw new ServiceError(500, `Database error: ${error.message}`);
}

/** Repo implementation backed by Supabase, executed with the caller's JWT so RLS applies. */
export function supabaseRepo(sb: SupabaseClient): Repo {
  return {
    async list<T>(table: Table, filter?: Record<string, string | number | boolean | null>) {
      let q = sb.from(table).select('*');
      for (const [k, v] of Object.entries(filter ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v);
      const { data, error } = await q.limit(5000);
      if (error) fail(error);
      return (data ?? []) as T[];
    },
    async get<T>(table: Table, id: string | number) {
      const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
      if (error) fail(error);
      return (data ?? null) as T | null;
    },
    async insert<T>(table: Table, rows: Record<string, unknown>[]) {
      if (!rows.length) return [];
      const { data, error } = await sb.from(table).insert(rows).select('*');
      if (error) fail(error);
      if (table !== 'audit_log' && (data?.length ?? 0) !== rows.length) {
        throw new ServiceError(403, 'Insert was not permitted.', 'FORBIDDEN');
      }
      return (data ?? []) as T[];
    },
    async update<T>(table: Table, id: string | number, patch: Record<string, unknown>) {
      const { data, error } = await sb.from(table).update(patch).eq('id', id).select('*');
      if (error) fail(error);
      if (!data || data.length === 0) throw new ServiceError(403, 'Update was not permitted or the record no longer exists.', 'FORBIDDEN');
      return data[0] as T;
    },
    async remove(table: Table, id: string | number) {
      const { data, error } = await sb.from(table).delete().eq('id', id).select('id');
      if (error) fail(error);
      if (!data || data.length === 0) throw new ServiceError(403, 'Delete was not permitted or the record no longer exists.', 'FORBIDDEN');
    },
  };
}
