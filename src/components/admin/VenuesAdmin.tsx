'use client';

import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { adminApi, useAdminAction } from '@/lib/adminApi';
import { useTournament } from '@/lib/data';
import type { Venue } from '@/lib/types';
import { EmptyState, cx, useConfirm } from '../ui';

const SPORT_OPTS = [
  ['any', 'Any sport'],
  ['table_tennis', 'Table Tennis'],
  ['badminton', 'Badminton'],
] as const;

export function VenuesAdmin() {
  const { venues, publicMatches } = useTournament();
  const { run } = useAdminAction();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [sport, setSport] = useState<Venue['sport']>('table_tennis');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await run('add', () => adminApi('venues', 'POST', { name, sport }), `${name} added`);
    if (r) setName('');
  };
  const update = (v: Venue, patch: Partial<Venue>) => run(`u-${v.id}`, () => adminApi('venues', 'PATCH', { id: v.id, ...patch }), 'Saved');
  const remove = async (v: Venue) => {
    const ok = await confirm({ title: 'Delete court/table', message: `Delete ${v.name}?`, danger: true, confirmLabel: 'Delete' });
    if (ok) await run(`d-${v.id}`, () => adminApi('venues', 'DELETE', { id: v.id }), `${v.name} deleted`);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card flex flex-wrap items-end gap-2 p-4">
        <div className="min-w-[10rem] flex-1">
          <label className="label">Name</label>
          <input className="input" required placeholder="Table 4 / Court 3" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Sport</label>
          <select className="input" value={sport} onChange={(e) => setSport(e.target.value as Venue['sport'])}>
            {SPORT_OPTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-accent">
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {venues.length === 0 ? (
        <EmptyState icon={<MapPin className="h-6 w-6" />} title="No courts or tables" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {venues.map((v) => {
            const upcoming = publicMatches.filter((m) => m.venue_id === v.id && ['pending', 'scheduled', 'in_progress'].includes(m.status)).length;
            return (
              <div key={v.id} className={cx('card space-y-3 p-4', !v.active && 'opacity-60')}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-pitch-600" />
                  <input
                    className="input py-1.5 font-semibold"
                    defaultValue={v.name}
                    onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== v.name && update(v, { name: e.target.value.trim() })}
                    aria-label="Name"
                  />
                  <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => remove(v)} aria-label={`Delete ${v.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select className="input py-1.5" value={v.sport} onChange={(e) => update(v, { sport: e.target.value as Venue['sport'] })} aria-label="Sport">
                    {SPORT_OPTS.map(([val, l]) => (
                      <option key={val} value={val}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <label className="flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
                    <input type="checkbox" checked={v.active} onChange={(e) => update(v, { active: e.target.checked })} /> Active
                  </label>
                </div>
                <div className="text-xs text-slate-500">{upcoming} assigned match(es) not yet finished</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
