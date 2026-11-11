'use client';

import { CalendarCheck, GitBranch, Hash, Shuffle, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Bracket, ChampionCard } from '@/components/bracket/Bracket';
import { MatchDetail } from '@/components/bracket/MatchDetail';
import { CategoryPicker } from '@/components/CategoryPicker';
import { SetupNotice } from '@/components/SetupNotice';
import { EmptyState, LiveDot, SkeletonBlock, SportIcon } from '@/components/ui';
import { useTournament } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { SCORING_RULES } from '@/lib/scoring';
import type { Match } from '@/lib/types';
import { CATEGORY_STATUS_LABEL } from '@/lib/types';

export default function DrawPage() {
  return (
    <Suspense fallback={<div className="container-page py-10"><SkeletonBlock className="h-96" /></div>}>
      <DrawView />
    </Suspense>
  );
}

function DrawView() {
  const { categories, publishedDrawByCategory, publicMatches, participantsById, venuesById, participants, loading } = useTournament();
  const params = useSearchParams();
  const router = useRouter();
  const [selected, setSelected] = useState<Match | null>(null);

  const requested = params.get('category');
  const categoryId =
    (requested && categories.some((c) => c.id === requested) ? requested : null) ??
    categories.find((c) => publishedDrawByCategory.has(c.id))?.id ??
    categories[0]?.id ??
    null;
  const category = categories.find((c) => c.id === categoryId);
  const draw = categoryId ? publishedDrawByCategory.get(categoryId) : undefined;
  const matches = useMemo(() => (draw ? publicMatches.filter((m) => m.draw_id === draw.id) : []), [draw, publicMatches]);
  const entrants = participants.filter((p) => p.category_id === categoryId);
  const liveCount = matches.filter((m) => m.status === 'in_progress').length;
  const finalMatch = draw ? matches.find((m) => m.round === draw.rounds) : undefined;
  const champion =
    (category?.champion_id && participantsById.get(category.champion_id)) ||
    (finalMatch?.winner_id ? participantsById.get(finalMatch.winner_id) : undefined);

  // keep selected match fresh with realtime data
  useEffect(() => {
    if (selected) {
      const fresh = matches.find((m) => m.id === selected.id);
      if (fresh && fresh !== selected) setSelected(fresh);
    }
  }, [matches, selected]);

  const select = (id: string) => router.replace(`/draw?category=${id}`, { scroll: false });

  return (
    <div className="pb-6">
      <div className="border-b border-slate-200 bg-white">
        <div className="container-page py-8">
          <div className="eyebrow text-pitch-700">Tournament draw</div>
          <h1 className="mt-1 font-display text-4xl font-bold uppercase tracking-tight text-navy-900 sm:text-5xl">Knockout brackets</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Single elimination · best of 3 games · winners advance automatically as results are validated.
          </p>
          <div className="mt-6">
            {loading && !categories.length ? (
              <SkeletonBlock className="h-20 w-full max-w-xl" />
            ) : (
              <CategoryPicker
                categories={categories}
                value={categoryId}
                onChange={select}
                badge={(c) =>
                  publicMatches.some((m) => m.category_id === c.id && m.status === 'in_progress') ? <LiveDot className="h-2 w-2" /> : null
                }
              />
            )}
          </div>
        </div>
      </div>

      <SetupNotice />

      {category && (
        <div className="container-page mt-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-white">
                <SportIcon sport={category.sport} className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold uppercase text-navy-900">{category.name}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {entrants.length} {category.discipline === 'doubles' ? 'pairs' : 'players'}
                  </span>
                  {draw && (
                    <>
                      <span className="flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" /> {draw.bracket_size}-draw · {draw.original_draw.byes} BYE
                        {draw.original_draw.byes === 1 ? '' : 's'}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarCheck className="h-3.5 w-3.5" /> Published {formatDate(draw.published_at)} · v{draw.version}
                      </span>
                    </>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{CATEGORY_STATUS_LABEL[category.status]}</span>
                  {liveCount > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-red-600">
                      <LiveDot className="h-2 w-2" /> {liveCount} live
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500">{SCORING_RULES[category.sport].text}</div>
          </div>

          {draw ? (
            <>
              {champion && (
                <div className="mx-auto max-w-md lg:hidden">
                  <ChampionCard champion={champion} declared={category.status === 'completed'} declaredAt={category.champion_declared_at} />
                </div>
              )}
              <Bracket
                draw={draw}
                matches={matches}
                category={category}
                participantsById={participantsById}
                venuesById={venuesById}
                onSelect={setSelected}
              />
              <details className="card group p-4 text-sm">
                <summary className="flex cursor-pointer items-center gap-2 font-semibold text-navy-800">
                  <Shuffle className="h-4 w-4 text-pitch-600" /> Original draw record (audit)
                </summary>
                <div className="mt-3 text-xs text-slate-500">
                  Generated {new Date(draw.original_draw.generated_at).toLocaleString()} · algorithm{' '}
                  <code>{draw.original_draw.algorithm}</code> · random seed <code className="break-all">{draw.rng_seed}</code>
                </div>
                <ol className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
                  {draw.original_draw.slots.map((s) => (
                    <li key={s.position} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs">
                      <span className="w-6 text-right font-mono text-slate-400">{s.position + 1}</span>
                      <span className={s.name ? 'font-medium text-navy-800' : 'italic text-slate-400'}>{s.name ?? 'BYE'}</span>
                      {s.seed ? <span className="ml-auto text-[10px] font-bold text-navy-400">seed {s.seed}</span> : null}
                    </li>
                  ))}
                </ol>
              </details>
            </>
          ) : (
            <EmptyState icon={<GitBranch className="h-6 w-6" />} title="Draw not published yet">
              {entrants.length} {category.discipline === 'doubles' ? 'pairs are' : 'players are'} registered. The bracket appears here as soon as
              the organisers publish the draw.
            </EmptyState>
          )}
        </div>
      )}

      {!loading && categories.length === 0 && (
        <div className="container-page mt-6">
          <EmptyState icon={<GitBranch className="h-6 w-6" />} title="No competitions yet">
            Categories are created by the organisers in the admin dashboard.
          </EmptyState>
        </div>
      )}

      <MatchDetail match={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
