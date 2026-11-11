import { randomUUID } from 'node:crypto';
import { ServiceError, type Repo, type Table } from '@/lib/service';

/** In-memory Repo used to test the service layer exactly as the API uses it. */
export function memoryRepo() {
  const db: Record<Table, Record<string, any>[]> = {
    settings: [{ id: 1, tournament_name: 'Test Cup', table_tennis_title: 'TT', badminton_title: 'BD', start_date: null, end_date: null }],
    categories: [],
    participants: [],
    venues: [],
    draws: [],
    matches: [],
    audit_log: [],
  };
  let auditId = 0;
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  // Mirrors the database trigger + check constraints on public.matches
  const checkMatch = (row: Record<string, any>) => {
    if (row.participant_a && row.participant_a === row.participant_b) throw new ServiceError(400, 'same participant twice');
    for (const m of db.matches) {
      if (m.id === row.id || m.draw_id !== row.draw_id || m.round !== row.round) continue;
      for (const p of [row.participant_a, row.participant_b]) {
        if (p && (p === m.participant_a || p === m.participant_b)) {
          throw new ServiceError(400, `Duplicate participant in round ${row.round}`);
        }
      }
    }
    if (row.winner_id && row.winner_id !== row.participant_a && row.winner_id !== row.participant_b) {
      throw new ServiceError(400, 'winner must be a participant');
    }
  };
  const repo: Repo = {
    async list(table, filter) {
      return clone(db[table].filter((r) => Object.entries(filter ?? {}).every(([k, v]) => (r[k] ?? null) === v))) as any;
    },
    async get(table, id) {
      const r = db[table].find((x) => x.id === id);
      return r ? clone(r) : (null as any);
    },
    async insert(table, rows) {
      const out = rows.map((r) => ({
        id: table === 'audit_log' ? ++auditId : randomUUID(),
        created_at: new Date().toISOString(),
        ...clone(r),
      }));
      for (const r of out) {
        if (table === 'matches') checkMatch(r);
        db[table].push(r);
      }
      return clone(out) as any;
    },
    async update(table, id, patch) {
      const r = db[table].find((x) => x.id === id);
      if (!r) throw new ServiceError(403, 'not found');
      const next = { ...r, ...clone(patch) };
      if (table === 'matches') checkMatch(next);
      Object.assign(r, next);
      return clone(r) as any;
    },
    async remove(table, id) {
      const i = db[table].findIndex((x) => x.id === id);
      if (i < 0) throw new ServiceError(403, 'not found');
      db[table].splice(i, 1);
    },
  };
  return { repo, db };
}
