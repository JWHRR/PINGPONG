'use client';

import { ArrowRight, CheckCircle2, Circle, Crown, GitBranch, Swords, Users } from 'lucide-react';
import type { AdminTab } from '@/app/admin/page';
import { useTournament } from '@/lib/data';
import { CATEGORY_STATUS_LABEL } from '@/lib/types';
import { LiveDot, SportIcon, cx } from '../ui';

export function Overview({ go }: { go: (t: AdminTab, categoryId?: string) => void }) {
  const { categories, participants, matches, publishedDrawByCategory, previewDrawByCategory, participantsById, venues } = useTournament();
  const pub = new Set([...publishedDrawByCategory.values()].map((d) => d.id));
  const ms = matches.filter((m) => pub.has(m.draw_id) && m.status !== 'bye');
  const live = ms.filter((m) => m.status === 'in_progress').length;
  const done = ms.filter((m) => m.status === 'completed' || m.status === 'walkover').length;
  const ready = ms.filter((m) => ['pending', 'scheduled'].includes(m.status) && m.participant_a && m.participant_b).length;

  const tiles = [
    { label: 'Participants', value: participants.length, icon: Users, tab: 'participants' as AdminTab },
    { label: 'Ready to play', value: ready, icon: Swords, tab: 'matches' as AdminTab },
    { label: 'Live', value: live, icon: GitBranch, tab: 'matches' as AdminTab, live: live > 0 },
    { label: 'Completed', value: `${done}/${ms.length}`, icon: CheckCircle2, tab: 'matches' as AdminTab },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <button key={t.label} onClick={() => go(t.tab)} className="card p-4 text-left transition hover:shadow-lift">
            <div className="flex items-center justify-between text-slate-400">
              <t.icon className="h-5 w-5" />
              {t.live && <LiveDot />}
            </div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums text-navy-900">{t.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold uppercase text-navy-900">Competition pipeline</h2>
          <p className="text-xs text-slate-500">Register → generate draw → publish → schedule → score → declare champion</p>
        </div>
        {categories.length === 0 && (
          <div className="p-5 text-sm text-slate-500">
            No categories yet.{' '}
            <button className="font-semibold text-pitch-700" onClick={() => go('categories')}>
              Create one
            </button>
            .
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {categories.map((c) => {
            const n = participants.filter((p) => p.category_id === c.id).length;
            const draw = publishedDrawByCategory.get(c.id);
            const preview = previewDrawByCategory.get(c.id);
            const cms = draw ? matches.filter((m) => m.draw_id === draw.id && m.status !== 'bye') : [];
            const cdone = cms.filter((m) => m.status === 'completed' || m.status === 'walkover').length;
            const final = draw ? matches.find((m) => m.draw_id === draw.id && m.round === draw.rounds) : undefined;
            const steps = [
              { label: `${n} registered`, ok: n >= 2, tab: 'participants' as AdminTab },
              { label: draw ? `Draw v${draw.version} published` : preview ? 'Preview ready' : 'No draw', ok: !!draw, tab: 'draws' as AdminTab },
              { label: draw ? `${cdone}/${cms.length} played` : 'Matches', ok: !!draw && cdone === cms.length, tab: 'matches' as AdminTab },
              {
                label: c.champion_id ? participantsById.get(c.champion_id)?.name ?? 'Champion' : final?.winner_id ? 'Declare champion' : 'Champion',
                ok: !!c.champion_id,
                tab: 'matches' as AdminTab,
              },
            ];
            return (
              <li key={c.id} className="flex flex-col gap-3 px-5 py-4 xl:flex-row xl:items-center">
                <div className="flex min-w-0 items-center gap-3 xl:w-72">
                  <span className="rounded-lg bg-navy-50 p-2 text-navy-700">
                    <SportIcon sport={c.sport} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-navy-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{CATEGORY_STATUS_LABEL[c.status]}</div>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {steps.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <button
                        onClick={() => go(s.tab, c.id)}
                        className={cx(
                          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition',
                          s.ok ? 'bg-pitch-50 text-pitch-800 hover:bg-pitch-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                          i === 3 && s.ok && 'bg-gold-100 text-gold-600',
                        )}
                      >
                        {i === 3 && s.ok ? <Crown className="h-3.5 w-3.5" /> : s.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                        <span className="max-w-[10rem] truncate">{s.label}</span>
                      </button>
                      {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-slate-300" />}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {venues.length === 0 && (
        <div className="card p-4 text-sm text-slate-600">
          No courts or tables configured.{' '}
          <button className="font-semibold text-pitch-700" onClick={() => go('venues')}>
            Add courts &amp; tables
          </button>{' '}
          to assign matches.
        </div>
      )}
    </div>
  );
}
