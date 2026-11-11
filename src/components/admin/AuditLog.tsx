'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTournament } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { getBrowserClient } from '@/lib/supabase/client';
import type { AuditEntry } from '@/lib/types';
import { Spinner } from '../ui';

const LABELS: Record<string, string> = {
  'draw.generate': 'Draw generated',
  'draw.publish': 'Draw published',
  'draw.discard': 'Preview discarded',
  'match.confirm': 'Result validated',
  'match.correct': 'Result corrected',
  'match.walkover': 'Walkover',
  'match.reset': 'Match reset',
  'match.live': 'Live score',
  'match.schedule': 'Match scheduled',
  'champion.declare': 'Champion declared',
  'champion.revoke': 'Category re-opened',
};

export function AuditLog() {
  const { categoriesById, participantsById, lastUpdated } = useTournament();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [hideLive, setHideLive] = useState(true);

  const load = useCallback(async () => {
    const { data } = (await getBrowserClient()?.from('audit_log').select('*').order('id', { ascending: false }).limit(300)) ?? {};
    setRows((data as AuditEntry[]) ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load, lastUpdated]);

  const describe = (r: AuditEntry) => {
    const d = r.details as Record<string, any>;
    const parts: string[] = [];
    if (d.match) parts.push(`M${d.match}`);
    if (d.name) parts.push(String(d.name));
    if (d.winner_id) parts.push(`winner: ${participantsById.get(d.winner_id)?.name ?? d.winner_id}`);
    if (d.champion_id) parts.push(participantsById.get(d.champion_id)?.name ?? d.champion_id);
    if (Array.isArray(d.games) && d.games.length) parts.push(d.games.map((g: any) => `${g.a}-${g.b}`).join(', '));
    if (d.version) parts.push(`v${d.version}`);
    if (d.rng_seed) parts.push(`seed ${String(d.rng_seed).slice(0, 8)}…`);
    if (Array.isArray(d.affected_matches) && d.affected_matches.length > 1) parts.push(`affected: ${d.affected_matches.map((n: number) => `M${n}`).join(', ')}`);
    if (d.reason) parts.push(String(d.reason));
    return parts.join(' · ');
  };

  const list = (rows ?? []).filter((r) => !hideLive || r.action !== 'match.live');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={hideLive} onChange={(e) => setHideLive(e.target.checked)} /> Hide live score updates
        </label>
        <button className="btn-secondary btn-sm" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
      <div className="card overflow-x-auto">
        {!rows ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDateTime(r.at)}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-navy-800">{LABELS[r.action] ?? r.action}</td>
                  <td className="px-4 py-2 text-slate-600">{r.category_id ? categoriesById.get(r.category_id)?.name ?? '—' : '—'}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{describe(r)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
