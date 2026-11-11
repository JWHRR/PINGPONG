'use client';

import { Download, Eye, GitBranch, RefreshCw, Send, Shuffle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdminTab } from '@/app/admin/page';
import { ApiError, adminApi, useAdminAction } from '@/lib/adminApi';
import { useTournament } from '@/lib/data';
import { nextPowerOfTwo } from '@/lib/draw';
import { formatDateTime } from '@/lib/format';
import { getBrowserClient } from '@/lib/supabase/client';
import type { Draw } from '@/lib/types';
import { CATEGORY_STATUS_LABEL } from '@/lib/types';
import { Bracket } from '../bracket/Bracket';
import { MatchDetail } from '../bracket/MatchDetail';
import { CategoryPicker } from '../CategoryPicker';
import { EmptyState, Spinner, useConfirm, useToast } from '../ui';

export function DrawsAdmin({
  initialCategory,
  onCategory,
  go,
}: {
  initialCategory: string | null;
  onCategory: (id: string) => void;
  go: (t: AdminTab, id?: string) => void;
}) {
  const { categories, participants, matches, participantsById, venuesById, publishedDrawByCategory, previewDrawByCategory } = useTournament();
  const { run, busy } = useAdminAction();
  const confirm = useConfirm();
  const toast = useToast();
  const [categoryId, setCategoryId] = useState<string | null>(initialCategory ?? categories[0]?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<Draw[]>([]);

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const category = categories.find((c) => c.id === categoryId);
  const published = categoryId ? publishedDrawByCategory.get(categoryId) : undefined;
  const preview = categoryId ? previewDrawByCategory.get(categoryId) : undefined;
  const entrants = participants.filter((p) => p.category_id === categoryId);
  const shown = preview ?? published;
  const shownMatches = shown ? matches.filter((m) => m.draw_id === shown.id) : [];
  const size = entrants.length >= 2 ? nextPowerOfTwo(entrants.length) : 0;

  // Full draw history (including superseded) for the audit section
  useEffect(() => {
    if (!categoryId) return;
    getBrowserClient()
      ?.from('draws')
      .select('*')
      .eq('category_id', categoryId)
      .order('version', { ascending: false })
      .then(({ data }) => setHistory((data as Draw[]) ?? []));
  }, [categoryId, published?.id, preview?.id]);

  const pick = (id: string) => {
    setCategoryId(id);
    onCategory(id);
  };

  const generate = async () => {
    if (!category) return;
    let confirmText: string | undefined;
    if (published) {
      const ok = await confirm({
        title: 'Regenerate a published draw?',
        message: (
          <>
            <b>{category.name}</b> already has a published draw
            {published && matches.some((m) => m.draw_id === published.id && ['completed', 'walkover', 'in_progress'].includes(m.status))
              ? ' with results entered'
              : ''}
            . A new <b>preview</b> will be created; the published draw stays live until you publish the new one. The old draw is kept in the
            audit history.
          </>
        ),
        danger: true,
        confirmLabel: 'Create new preview',
        typeToConfirm: category.name,
      });
      if (!ok) return;
      confirmText = category.name;
    } else if (preview) {
      const ok = await confirm({
        title: 'Re-shuffle preview?',
        message: 'The current unpublished preview will be replaced by a new random draw.',
        confirmLabel: 'Re-shuffle',
      });
      if (!ok) return;
    }
    try {
      await run('gen', () => adminApi('draws', 'POST', { action: 'generate', categoryId: category.id, confirmText }), 'Draw preview generated — review it below');
    } catch (e) {
      if (e instanceof ApiError) toast('error', e.message);
    }
  };

  const publish = async () => {
    if (!preview || !category) return;
    const ok = await confirm({
      title: published ? 'Replace the published draw?' : 'Publish draw',
      message: published ? (
        <>
          Publishing will <b>replace</b> the current draw (v{published.version}) and discard its results from the live bracket. The old
          draw remains in the audit history.
        </>
      ) : (
        <>
          Publish the draw for <b>{category.name}</b>? It becomes visible to everyone and results can be entered. A published draw can only be
          replaced with explicit confirmation.
        </>
      ),
      confirmLabel: published ? 'Replace & publish' : 'Publish',
      danger: !!published,
      typeToConfirm: published ? category.name : undefined,
    });
    if (!ok) return;
    try {
      await run('pub', () => adminApi('draws', 'POST', { action: 'publish', drawId: preview.id, confirmReplace: !!published }), 'Draw published');
    } catch (e) {
      if (e instanceof ApiError) toast('error', e.message);
    }
  };

  const discard = async () => {
    if (!preview) return;
    const ok = await confirm({ title: 'Discard preview', message: 'Delete this unpublished preview?', confirmLabel: 'Discard', danger: true });
    if (ok) await run('dis', () => adminApi('draws', 'POST', { action: 'discard', drawId: preview.id }), 'Preview discarded');
  };

  const download = (d: Draw) => {
    const blob = new Blob([JSON.stringify({ draw: d }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `draw-${category?.name.replace(/\W+/g, '-').toLowerCase()}-v${d.version}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!categories.length) {
    return (
      <EmptyState icon={<GitBranch className="h-6 w-6" />} title="No categories">
        Create categories and register participants first.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <CategoryPicker categories={categories} value={categoryId} onChange={pick} />
      </div>

      {category && (
        <div className="card flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-bold uppercase text-navy-900">{category.name}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>
                <b className="text-navy-900">{entrants.length}</b> entries
              </span>
              {size > 0 && (
                <span>
                  {size}-draw · <b className="text-navy-900">{size - entrants.length}</b> BYE{size - entrants.length === 1 ? '' : 's'}
                </span>
              )}
              <span>{CATEGORY_STATUS_LABEL[category.status]}</span>
              {published && <span>Published v{published.version} · {formatDateTime(published.published_at)}</span>}
            </div>
            {entrants.length < 2 && (
              <button className="mt-2 text-sm font-semibold text-pitch-700" onClick={() => go('participants', category.id)}>
                Register at least 2 participants →
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={published ? 'btn-secondary' : 'btn-primary'} onClick={generate} disabled={entrants.length < 2 || !!busy}>
              {busy === 'gen' ? <Spinner className="h-4 w-4" /> : preview ? <RefreshCw className="h-4 w-4" /> : <Shuffle className="h-4 w-4" />}
              {published ? 'Regenerate draw' : preview ? 'Re-shuffle preview' : 'Generate random draw'}
            </button>
            {preview && (
              <>
                <button className="btn-secondary text-red-600" onClick={discard} disabled={!!busy}>
                  <Trash2 className="h-4 w-4" /> Discard
                </button>
                <button className="btn-accent" onClick={publish} disabled={!!busy}>
                  {busy === 'pub' ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Publish draw
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <Eye className="h-4 w-4 shrink-0" />
          You are viewing an <b>unpublished preview</b> (v{preview.version}). Only administrators can see it. Seeds are placed by standard
          seeding; everyone else is drawn randomly. BYEs go to the top-placed positions.
        </div>
      )}

      {shown && category ? (
        <Bracket
          draw={shown}
          matches={shownMatches}
          category={category}
          participantsById={participantsById}
          venuesById={venuesById}
          preview={shown.status === 'preview'}
          onSelect={(m) => setSelected(m.id)}
        />
      ) : (
        category && (
          <EmptyState icon={<Shuffle className="h-6 w-6" />} title="No draw yet">
            Generate a random draw to preview the bracket before publishing it.
          </EmptyState>
        )
      )}

      {history.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy-900">Draw history (audit)</div>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Version</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Generated</th>
                <th className="px-4 py-2">Entries</th>
                <th className="px-4 py-2">Seed</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 font-semibold">v{d.version}</td>
                  <td className="px-4 py-2 capitalize">{d.status}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDateTime(d.created_at)}</td>
                  <td className="px-4 py-2">
                    {d.participant_count} / {d.bracket_size}
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-2 font-mono text-xs text-slate-500">{d.rng_seed}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="btn-ghost btn-sm" onClick={() => download(d)}>
                      <Download className="h-4 w-4" /> JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MatchDetail match={shownMatches.find((m) => m.id === selected) ?? null} onClose={() => setSelected(null)} />
    </div>
  );
}
