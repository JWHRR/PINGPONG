'use client';

import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { adminApi, useAdminAction } from '@/lib/adminApi';
import { useTournament } from '@/lib/data';
import type { Participant, PlayerLevel } from '@/lib/types';
import { LEVEL_LABEL, LEVEL_RANK, PLAYER_LEVELS } from '@/lib/types';
import { EmptyState, LevelBadge, Modal, SportIcon, Spinner, useConfirm } from '../ui';

interface Form {
  id?: string;
  category_id: string;
  player1: string;
  player2: string;
  name: string;
  club: string;
  seed: string;
  level: PlayerLevel;
  notes: string;
}

const empty = (category_id: string, level: PlayerLevel = 'beginner'): Form => ({
  category_id,
  player1: '',
  player2: '',
  name: '',
  club: '',
  seed: '',
  level,
  notes: '',
});

export function ParticipantsAdmin({ initialCategory }: { initialCategory: string | null }) {
  const { participants, categories, categoriesById } = useTournament();
  const { run, busy } = useAdminAction();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<string>(initialCategory ?? 'all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const list = useMemo(
    () =>
      participants
        .filter((p) => filter === 'all' || p.category_id === filter)
        .filter((p) => !q.trim() || [p.name, p.club].some((s) => s?.toLowerCase().includes(q.trim().toLowerCase())))
        .sort((a, b) =>
          a.category_id === b.category_id
            ? (a.seed ?? 999) - (b.seed ?? 999) || LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.name.localeCompare(b.name)
            : 0,
        ),
    [participants, filter, q],
  );

  const formCategory = form ? categoriesById.get(form.category_id) : undefined;

  const save = async (e: React.FormEvent, addAnother = false) => {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    const body = {
      ...(form.id ? { id: form.id } : {}),
      category_id: form.category_id,
      player1: form.player1,
      player2: formCategory?.discipline === 'doubles' ? form.player2 : null,
      name: form.name || null,
      club: form.club || null,
      seed: form.seed ? Number(form.seed) : null,
      level: form.level,
      notes: form.notes || null,
    };
    try {
      await adminApi('participants', form.id ? 'PATCH' : 'POST', body);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save');
      return;
    }
    await run('refresh', async () => undefined, form.id ? 'Participant updated' : `${form.player1} registered`);
    setForm(addAnother ? empty(form.category_id, form.level) : null);
  };

  const remove = async (p: Participant) => {
    const ok = await confirm({
      title: 'Remove participant',
      message: (
        <>
          Remove <b>{p.name}</b> from {categoriesById.get(p.category_id)?.name}? This cannot be undone.
        </>
      ),
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) await run(`del-${p.id}`, () => adminApi('participants', 'DELETE', { id: p.id }), `${p.name} removed`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto max-w-full" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Category filter">
          <option value="all">All categories ({participants.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({participants.filter((p) => p.category_id === c.id).length})
            </option>
          ))}
        </select>
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button
          className="btn-accent"
          disabled={!categories.length}
          onClick={() => {
            setFormError(null);
            setForm(empty(filter !== 'all' ? filter : categories[0]?.id ?? ''));
          }}
        >
          <Plus className="h-4 w-4" /> Register participant
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No participants">
          {categories.length ? 'Register players or doubles pairs to build the draw.' : 'Create a category first.'}
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Tournament</th>
                <th className="px-4 py-3 font-semibold">Level</th>
                <th className="px-4 py-3 font-semibold">Club</th>
                <th className="px-4 py-3 text-center font-semibold">Seed</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((p) => {
                const c = categoriesById.get(p.category_id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-navy-900">{p.name}</div>
                      {p.player2 && <div className="text-xs text-slate-500">{p.player1} & {p.player2}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        {c && <SportIcon sport={c.sport} className="h-3.5 w-3.5" />}
                        {c?.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <LevelBadge level={p.level} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{p.club}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-navy-600">{p.seed ?? ''}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => {
                            setFormError(null);
                            setForm({
                              id: p.id,
                              category_id: p.category_id,
                              player1: p.player1,
                              player2: p.player2 ?? '',
                              name: p.name,
                              club: p.club ?? '',
                              seed: p.seed ? String(p.seed) : '',
                              level: p.level,
                              notes: p.notes ?? '',
                            });
                          }}
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => remove(p)} disabled={busy === `del-${p.id}`} aria-label={`Remove ${p.name}`}>
                          {busy === `del-${p.id}` ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit participant' : 'Register participant'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>
              Cancel
            </button>
            {!form?.id && (
              <button className="btn-secondary" onClick={(e) => save(e, true)}>
                Save & add another
              </button>
            )}
            <button className="btn-primary" onClick={(e) => save(e)}>
              Save
            </button>
          </>
        }
      >
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => save(e)}>
            <div className="sm:col-span-2">
              <label className="label">Tournament</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={formCategory?.discipline === 'doubles' ? '' : 'sm:col-span-2'}>
              <label className="label">{formCategory?.discipline === 'doubles' ? 'Player 1' : 'Player name'}</label>
              <input className="input" autoFocus required value={form.player1} onChange={(e) => setForm({ ...form, player1: e.target.value })} />
            </div>
            {formCategory?.discipline === 'doubles' && (
              <div>
                <label className="label">Player 2 (partner)</label>
                <input className="input" required value={form.player2} onChange={(e) => setForm({ ...form, player2: e.target.value })} />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label">Display name (optional)</label>
              <input
                className="input"
                placeholder={formCategory?.discipline === 'doubles' ? 'Defaults to "Player 1 / Player 2"' : 'Defaults to the player name'}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Club / school</label>
              <input className="input" value={form.club} onChange={(e) => setForm({ ...form, club: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Level (used to seed the draw)</label>
              <div className="grid grid-cols-3 gap-2">
                {PLAYER_LEVELS.map((l) => (
                  <button
                    type="button"
                    key={l}
                    onClick={() => setForm({ ...form, level: l })}
                    className={
                      form.level === l
                        ? 'rounded-xl border-2 border-navy-900 bg-navy-900 px-3 py-2 text-sm font-semibold text-white'
                        : 'rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700 hover:border-slate-300'
                    }
                  >
                    {LEVEL_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Manual seed (optional)</label>
              <input className="input" type="number" min={1} max={64} value={form.seed} onChange={(e) => setForm({ ...form, seed: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {formError && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{formError}</div>}
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>
    </div>
  );
}
