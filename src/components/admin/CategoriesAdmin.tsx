'use client';

import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { AdminTab } from '@/app/admin/page';
import { adminApi, useAdminAction } from '@/lib/adminApi';
import { useTournament } from '@/lib/data';
import type { Category, Discipline, Sport } from '@/lib/types';
import { CATEGORY_STATUS_LABEL, DISCIPLINE_LABEL, SPORT_LABEL } from '@/lib/types';
import { EmptyState, Modal, SportIcon, useConfirm } from '../ui';

interface Form {
  id?: string;
  sport: Sport;
  discipline: Discipline;
  level: string;
  name: string;
  sort_order: string;
}

export function CategoriesAdmin({ go }: { go: (t: AdminTab, id?: string) => void }) {
  const { categories, participants } = useTournament();
  const { run } = useAdminAction();
  const confirm = useConfirm();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    try {
      await adminApi('categories', form.id ? 'PATCH' : 'POST', {
        ...(form.id ? { id: form.id } : {}),
        sport: form.sport,
        discipline: form.discipline,
        level: form.level,
        name: form.name || (form.id ? undefined : null),
        sort_order: Number(form.sort_order) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      return;
    }
    await run('r', async () => undefined, form.id ? 'Category updated' : 'Category created');
    setForm(null);
  };

  const remove = async (c: Category) => {
    const ok = await confirm({
      title: 'Delete category',
      message: (
        <>
          Delete <b>{c.name}</b>? Its draws and results history will be permanently deleted.
        </>
      ),
      danger: true,
      confirmLabel: 'Delete',
      typeToConfirm: c.name,
    });
    if (ok) await run('d', () => adminApi('categories', 'DELETE', { id: c.id }), 'Category deleted');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Each tournament has its own knockout bracket. Player levels (Beginner / Intermediate / Advanced) are set per player and used to seed the draw.
        </p>
        <button
          className="btn-accent shrink-0"
          onClick={() => {
            setError(null);
            setForm({ sport: 'table_tennis', discipline: 'singles', level: 'Open', name: '', sort_order: String((categories.length + 1) * 10) });
          }}
        >
          <Plus className="h-4 w-4" /> New category
        </button>
      </div>
      {categories.length === 0 ? (
        <EmptyState icon={<Layers className="h-6 w-6" />} title="No categories">
          Create e.g. “Table Tennis Singles — Beginner”, “Badminton Singles — Advanced”, “Badminton Doubles — Open”.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {categories.map((c) => {
            const n = participants.filter((p) => p.category_id === c.id).length;
            return (
              <div key={c.id} className="card flex items-start gap-3 p-4">
                <span className="rounded-xl bg-navy-50 p-2.5 text-navy-700">
                  <SportIcon sport={c.sport} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-navy-900">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {SPORT_LABEL[c.sport]} · {DISCIPLINE_LABEL[c.discipline]} · Level: {c.level}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-200" onClick={() => go('participants', c.id)}>
                      {n} entries
                    </button>
                    <button className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-200" onClick={() => go('draws', c.id)}>
                      {CATEGORY_STATUS_LABEL[c.status]}
                    </button>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    className="btn-ghost btn-sm"
                    aria-label="Edit"
                    onClick={() => {
                      setError(null);
                      setForm({ id: c.id, sport: c.sport, discipline: c.discipline, level: c.level, name: c.name, sort_order: String(c.sort_order) });
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" aria-label="Delete" onClick={() => remove(c)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit category' : 'New category'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              Save
            </button>
          </>
        }
      >
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
            <div>
              <label className="label">Sport</label>
              <select className="input" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value as Sport })}>
                <option value="table_tennis">Table Tennis</option>
                <option value="badminton">Badminton</option>
              </select>
            </div>
            <div>
              <label className="label">Discipline</label>
              <select className="input" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value as Discipline })}>
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </div>
            <div>
              <label className="label">Edition / division</label>
              <input className="input" required placeholder="Open" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
            </div>
            <div>
              <label className="label">Display order</label>
              <input className="input" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Name (optional)</label>
              <input className="input" placeholder="Generated automatically if empty" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>
    </div>
  );
}
