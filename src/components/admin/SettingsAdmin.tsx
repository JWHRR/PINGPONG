'use client';

import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminApi, useAdminAction } from '@/lib/adminApi';
import { useTournament } from '@/lib/data';
import type { Settings } from '@/lib/types';
import { Spinner } from '../ui';

const FIELDS: { key: keyof Settings; label: string; type?: string; wide?: boolean; area?: boolean }[] = [
  { key: 'tournament_name', label: 'Tournament name', wide: true },
  { key: 'tagline', label: 'Tagline', wide: true },
  { key: 'table_tennis_title', label: 'Table Tennis tournament title' },
  { key: 'badminton_title', label: 'Badminton tournament title' },
  { key: 'start_date', label: 'Start date', type: 'date' },
  { key: 'end_date', label: 'End date', type: 'date' },
  { key: 'location', label: 'Location / venue' },
  { key: 'organizer', label: 'Organiser' },
  { key: 'description', label: 'Description (shown on the home page)', wide: true, area: true },
];

export function SettingsAdmin() {
  const { settings } = useTournament();
  const { run, busy } = useAdminAction();
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (settings) setForm(Object.fromEntries(FIELDS.map((f) => [f.key, (settings[f.key] as string | null) ?? ''])));
  }, [settings]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run('save', () => adminApi('settings', 'PATCH', form), 'Tournament info saved');
  };

  return (
    <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
          <label className="label" htmlFor={f.key}>
            {f.label}
          </label>
          {f.area ? (
            <textarea id={f.key} className="input min-h-[96px]" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          ) : (
            <input id={f.key} className="input" type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <div className="sm:col-span-2">
        <button className="btn-primary" disabled={!!busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Save
        </button>
      </div>
    </form>
  );
}
