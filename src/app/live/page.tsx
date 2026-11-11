'use client';

import { CalendarClock, CheckCircle2, MapPin, Radio } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MatchDetail } from '@/components/bracket/MatchDetail';
import { MatchRow } from '@/components/MatchRow';
import { SetupNotice } from '@/components/SetupNotice';
import { EmptyState, LiveDot, SportIcon, cx } from '@/components/ui';
import { useTournament } from '@/lib/data';
import { roundName } from '@/lib/draw';
import { countGames } from '@/lib/scoring';
import { sortMatchesByTime } from '@/lib/format';
import type { Match, Sport } from '@/lib/types';

type Tab = 'live' | 'upcoming' | 'completed';

export default function LivePage() {
  const { publicMatches, venues, categoriesById, loading } = useTournament();
  const [tab, setTab] = useState<Tab>('live');
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [venue, setVenue] = useState<string>('all');
  const [selected, setSelected] = useState<Match | null>(null);

  const filtered = useMemo(
    () =>
      publicMatches.filter(
        (m) =>
          m.status !== 'bye' &&
          (sport === 'all' || categoriesById.get(m.category_id)?.sport === sport) &&
          (venue === 'all' || m.venue_id === venue),
      ),
    [publicMatches, sport, venue, categoriesById],
  );
  const live = filtered.filter((m) => m.status === 'in_progress');
  const upcoming = filtered
    .filter((m) => m.status === 'scheduled' || (m.status === 'pending' && m.participant_a && m.participant_b))
    .sort(sortMatchesByTime);
  const completed = filtered
    .filter((m) => m.status === 'completed' || m.status === 'walkover')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  const lists: Record<Tab, Match[]> = { live, upcoming, completed };
  const tabs: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: 'live', label: 'Live', count: live.length, icon: live.length ? <LiveDot className="h-2 w-2" /> : <Radio className="h-4 w-4" /> },
    { id: 'upcoming', label: 'Upcoming', count: upcoming.length, icon: <CalendarClock className="h-4 w-4" /> },
    { id: 'completed', label: 'Results', count: completed.length, icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  // Court / table board: what is on each venue right now / next
  const board = venues
    .filter((v) => v.active && (sport === 'all' || v.sport === 'any' || v.sport === sport))
    .map((v) => {
      const ms = publicMatches.filter((m) => m.venue_id === v.id);
      return {
        venue: v,
        now: ms.find((m) => m.status === 'in_progress'),
        next: ms.filter((m) => m.status === 'scheduled' || m.status === 'pending').sort(sortMatchesByTime)[0],
      };
    });

  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="container-page py-8">
          <div className="eyebrow flex items-center gap-2 text-red-600">
            <LiveDot className="h-2 w-2" /> Match center
          </div>
          <h1 className="mt-1 font-display text-4xl font-bold uppercase tracking-tight text-navy-900 sm:text-5xl">Live scores & schedule</h1>
          <p className="mt-2 text-sm text-slate-500">Scores update automatically while organisers enter them — no need to refresh.</p>
        </div>
      </div>
      <SetupNotice />

      <div className="container-page mt-6">
        {board.length > 0 && (
          <div className="no-scrollbar -mx-4 mb-6 flex gap-3 overflow-x-auto px-4 pb-1">
            {board.map(({ venue: v, now, next }) => (
              <BoardCard key={v.id} name={v.name} now={now} next={next} onOpen={setSelected} />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-2xl bg-slate-200/70 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4',
                  tab === t.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-navy-900',
                )}
              >
                {t.icon}
                {t.label}
                <span className="rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-slate-600">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select className="input w-auto" value={sport} onChange={(e) => setSport(e.target.value as Sport | 'all')} aria-label="Sport">
              <option value="all">All sports</option>
              <option value="table_tennis">Table Tennis</option>
              <option value="badminton">Badminton</option>
            </select>
            <select className="input w-auto" value={venue} onChange={(e) => setVenue(e.target.value)} aria-label="Court or table">
              <option value="all">All courts/tables</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {lists[tab].map((m) => (
            <MatchRow key={m.id} match={m} big={tab === 'live'} onClick={() => setSelected(m)} />
          ))}
          {!loading && lists[tab].length === 0 && (
            <EmptyState
              icon={tab === 'live' ? <Radio className="h-6 w-6" /> : tab === 'upcoming' ? <CalendarClock className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
              title={tab === 'live' ? 'No matches in progress' : tab === 'upcoming' ? 'Nothing scheduled' : 'No results yet'}
            >
              {tab === 'live' ? 'Live matches appear here the moment an organiser starts scoring.' : 'Check back soon.'}
            </EmptyState>
          )}
        </div>
      </div>
      <MatchDetail match={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function BoardCard({ name, now, next, onOpen }: { name: string; now?: Match; next?: Match; onOpen: (m: Match) => void }) {
  const { participantsById, categoriesById, draws } = useTournament();
  const m = now ?? next;
  const cat = m ? categoriesById.get(m.category_id) : undefined;
  const draw = m ? draws.find((d) => d.id === m.draw_id) : undefined;
  const won = m ? countGames(m.games) : { a: 0, b: 0 };
  const last = m?.games[m.games.length - 1];
  return (
    <button
      disabled={!m}
      onClick={() => m && onOpen(m)}
      className={cx(
        'w-64 shrink-0 rounded-2xl p-4 text-left shadow-card ring-1 transition enabled:hover:-translate-y-0.5',
        now ? 'bg-navy-950 text-white ring-red-400/40' : 'bg-white ring-slate-200',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cx('flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide', now ? 'text-white' : 'text-navy-900')}>
          <MapPin className="h-4 w-4" />
          {name}
        </span>
        {now ? (
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-red-300">
            <LiveDot className="h-2 w-2" /> Live
          </span>
        ) : (
          <span className="text-[11px] font-semibold uppercase text-slate-400">{next ? 'Next up' : 'Free'}</span>
        )}
      </div>
      {m ? (
        <>
          <div className={cx('mt-1 flex items-center gap-1 truncate text-[11px]', now ? 'text-navy-300' : 'text-slate-500')}>
            {cat && <SportIcon sport={cat.sport} className="h-3 w-3" />}
            {cat?.level} · {draw ? roundName(m.round, draw.rounds) : ''} · M{m.number}
          </div>
          {(['a', 'b'] as const).map((s) => {
            const p = participantsById.get((s === 'a' ? m.participant_a : m.participant_b) ?? '');
            return (
              <div key={s} className="mt-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p?.name ?? 'TBD'}</span>
                {now && (
                  <>
                    <span className="text-xs tabular-nums text-navy-300">{last ? (s === 'a' ? last.a : last.b) : 0}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-xs font-bold tabular-nums">{won[s]}</span>
                  </>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <div className="mt-3 text-sm text-slate-400">No match assigned</div>
      )}
    </button>
  );
}
