'use client';

import { ArrowRight, CalendarDays, CheckCircle2, Crown, Flame, GitBranch, MapPin, Radio, Swords, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MatchDetail } from '@/components/bracket/MatchDetail';
import { MatchRow } from '@/components/MatchRow';
import { SetupNotice } from '@/components/SetupNotice';
import { EmptyState, LiveDot, SkeletonBlock, SportIcon, cx } from '@/components/ui';
import { useTournament } from '@/lib/data';
import { formatDateRange, sortMatchesByTime } from '@/lib/format';
import type { Category, Match, Sport } from '@/lib/types';
import { CATEGORY_STATUS_LABEL, DISCIPLINE_LABEL } from '@/lib/types';

export default function HomePage() {
  const t = useTournament();
  const { settings, categories, participants, publicMatches, participantsById, loading } = t;
  const [selected, setSelected] = useState<Match | null>(null);

  const live = publicMatches.filter((m) => m.status === 'in_progress');
  const completed = publicMatches.filter((m) => m.status === 'completed' || m.status === 'walkover');
  const upcoming = useMemo(
    () =>
      publicMatches
        .filter((m) => (m.status === 'scheduled' || m.status === 'pending') && m.participant_a && m.participant_b)
        .sort(sortMatchesByTime)
        .slice(0, 6),
    [publicMatches],
  );
  const latest = useMemo(
    () => [...completed].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 4),
    [completed],
  );
  const thrillers = completed.filter((m) => m.games.length === 3).length;
  const champions = categories.filter((c) => c.champion_id && c.status === 'completed');

  const stats = [
    { label: 'Registered participants', value: participants.length, icon: Users, tone: 'text-sky-300' },
    { label: 'Matches live now', value: live.length, icon: Radio, tone: 'text-red-300', live: live.length > 0 },
    { label: 'Matches completed', value: completed.length, icon: CheckCircle2, tone: 'text-pitch-300' },
    { label: 'Competitions', value: categories.length, icon: GitBranch, tone: 'text-gold-300' },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,133,0.28),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(66,95,146,0.45),transparent_60%)]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
          <defs>
            <pattern id="court" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M0 60 H120 M60 0 V120" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#court)" />
        </svg>
        <div className="container-page relative py-14 sm:py-20">
          <div className="eyebrow text-pitch-300">{settings?.tagline ?? 'Table Tennis & Badminton Championships'}</div>
          {loading && !settings ? (
            <SkeletonBlock className="mt-3 h-14 w-2/3 opacity-20" />
          ) : (
            <h1 className="mt-2 max-w-4xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl">
              {settings?.tournament_name ?? 'Smash Cup'}
            </h1>
          )}
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-navy-100">
            <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
              <CalendarDays className="h-4 w-4 text-pitch-300" />
              {formatDateRange(settings?.start_date ?? null, settings?.end_date ?? null)}
            </span>
            <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
              <MapPin className="h-4 w-4 text-pitch-300" />
              {settings?.location || 'Venue to be announced'}
            </span>
          </div>
          {settings?.description && <p className="mt-5 max-w-2xl text-base text-navy-200">{settings.description}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/draw" className="btn bg-pitch-500 px-5 py-3 text-white hover:bg-pitch-400">
              <GitBranch className="h-4 w-4" /> View the draws
            </Link>
            <Link href="/live" className="btn bg-white/10 px-5 py-3 text-white ring-1 ring-white/20 hover:bg-white/15">
              {live.length > 0 ? <LiveDot /> : <Radio className="h-4 w-4" />} Match center
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center justify-between">
                  <s.icon className={cx('h-5 w-5', s.tone)} />
                  {s.live && <LiveDot />}
                </div>
                <div className="mt-3 font-display text-4xl font-bold tabular-nums">{loading ? '–' : s.value}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-navy-300">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SetupNotice />

      {/* Sports */}
      <section className="container-page mt-10 grid gap-6 lg:grid-cols-2">
        <SportPanel sport="table_tennis" title={settings?.table_tennis_title ?? 'Table Tennis Open'} categories={categories} />
        <SportPanel sport="badminton" title={settings?.badminton_title ?? 'Badminton Championship'} categories={categories} />
      </section>

      {/* Live + upcoming */}
      <section className="container-page mt-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle icon={live.length ? <LiveDot /> : <CalendarDays className="h-5 w-5 text-pitch-600" />} href="/live">
            {live.length ? 'Live now & up next' : 'Upcoming matches'}
          </SectionTitle>
          <div className="space-y-3">
            {[...live, ...upcoming].slice(0, 6).map((m) => (
              <MatchRow key={m.id} match={m} onClick={() => setSelected(m)} />
            ))}
            {!loading && live.length + upcoming.length === 0 && (
              <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No upcoming matches">
                Matches appear here once a draw is published and scheduled.
              </EmptyState>
            )}
          </div>
        </div>

        <div>
          <SectionTitle icon={<Flame className="h-5 w-5 text-gold-500" />}>Highlights</SectionTitle>
          <div className="space-y-3">
            {champions.map((c) => (
              <Link
                key={c.id}
                href={`/draw?category=${c.id}`}
                className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-navy-900 to-pitch-900 p-4 text-white shadow-card ring-1 ring-gold-400/60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400 text-navy-950">
                  <Crown className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[11px] uppercase tracking-wide text-gold-300">{c.name} champion</div>
                  <div className="truncate font-display text-lg font-bold uppercase">{participantsById.get(c.champion_id!)?.name}</div>
                </div>
              </Link>
            ))}
            <div className="card grid grid-cols-2 divide-x divide-slate-100 p-0">
              <div className="p-4">
                <div className="font-display text-3xl font-bold text-navy-900">{thrillers}</div>
                <div className="text-xs text-slate-500">three-game thrillers</div>
              </div>
              <div className="p-4">
                <div className="font-display text-3xl font-bold text-navy-900">
                  {completed.filter((m) => m.status === 'walkover').length}
                </div>
                <div className="text-xs text-slate-500">walkovers</div>
              </div>
            </div>
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Swords className="h-4 w-4" /> Latest results
              </div>
              {latest.length === 0 && <div className="py-2 text-sm text-slate-400">No results yet.</div>}
              <ul className="divide-y divide-slate-100">
                {latest.map((m) => {
                  const w = participantsById.get(m.winner_id ?? '');
                  const l = participantsById.get((m.winner_id === m.participant_a ? m.participant_b : m.participant_a) ?? '');
                  return (
                    <li key={m.id}>
                      <button className="w-full py-2 text-left text-sm hover:text-pitch-700" onClick={() => setSelected(m)}>
                        <span className="font-semibold">{w?.name}</span> <span className="text-slate-400">def.</span> {l?.name}
                        <span className="ml-1 text-xs tabular-nums text-slate-500">
                          {m.status === 'walkover'
                            ? '(W/O)'
                            : `(${m.games.map((g) => (m.winner_id === m.participant_a ? `${g.a}-${g.b}` : `${g.b}-${g.a}`)).join(', ')})`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <MatchDetail match={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function SectionTitle({ children, icon, href }: { children: React.ReactNode; icon?: React.ReactNode; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide text-navy-900">
        {icon}
        {children}
      </h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-pitch-700 hover:text-pitch-800">
          All matches <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function SportPanel({ sport, title, categories }: { sport: Sport; title: string; categories: Category[] }) {
  const { participants, publicMatches, participantsById } = useTournament();
  const cats = categories.filter((c) => c.sport === sport);
  const ids = new Set(cats.map((c) => c.id));
  const count = participants.filter((p) => ids.has(p.category_id)).length;
  const ms = publicMatches.filter((m) => ids.has(m.category_id) && m.status !== 'bye');
  const done = ms.filter((m) => m.status === 'completed' || m.status === 'walkover').length;
  const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;
  return (
    <div className="card overflow-hidden">
      <div
        className={cx(
          'relative p-6 text-white',
          sport === 'table_tennis' ? 'bg-gradient-to-br from-navy-800 to-navy-950' : 'bg-gradient-to-br from-pitch-700 to-pitch-950',
        )}
      >
        <SportIcon sport={sport} className="absolute -right-4 -top-4 h-36 w-36 opacity-10" />
        <div className="eyebrow text-white/70">{sport === 'table_tennis' ? 'Table Tennis' : 'Badminton'}</div>
        <h3 className="mt-1 font-display text-3xl font-bold uppercase">{title}</h3>
        <div className="mt-3 flex gap-5 text-sm text-white/80">
          <span>
            <b className="text-white">{count}</b> entries
          </span>
          <span>
            <b className="text-white">{cats.length}</b> categories
          </span>
          <span>
            <b className="text-white">{pct}%</b> complete
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {cats.length === 0 && <li className="p-5 text-sm text-slate-400">No categories configured yet.</li>}
        {cats.map((c) => {
          const n = participants.filter((p) => p.category_id === c.id).length;
          const champ = c.champion_id ? participantsById.get(c.champion_id) : undefined;
          return (
            <li key={c.id}>
              <Link href={`/draw?category=${c.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-navy-900">
                    {DISCIPLINE_LABEL[c.discipline]} · {c.level}
                  </div>
                  <div className="text-xs text-slate-500">
                    {n} {c.discipline === 'doubles' ? 'pairs' : 'players'} · {CATEGORY_STATUS_LABEL[c.status]}
                  </div>
                </div>
                {champ ? (
                  <span className="flex max-w-[45%] items-center gap-1 truncate rounded-full bg-gold-100 px-2.5 py-1 text-xs font-semibold text-gold-600">
                    <Crown className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{champ.name}</span>
                  </span>
                ) : (
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
