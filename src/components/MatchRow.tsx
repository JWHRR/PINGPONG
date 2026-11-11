'use client';

import { CalendarClock, MapPin } from 'lucide-react';
import { roundName } from '@/lib/draw';
import { formatDateTime, formatTime } from '@/lib/format';
import { useTournament } from '@/lib/data';
import { countGames } from '@/lib/scoring';
import type { Match } from '@/lib/types';
import { STATUS_STYLE, SportIcon, StatusBadge, cx } from './ui';

/** Horizontal match summary used in the match center, home page and profiles. */
export function MatchRow({ match, onClick, big }: { match: Match; onClick?: () => void; big?: boolean }) {
  const { participantsById, categoriesById, venuesById, draws } = useTournament();
  const category = categoriesById.get(match.category_id);
  const draw = draws.find((d) => d.id === match.draw_id);
  const a = match.participant_a ? participantsById.get(match.participant_a) : undefined;
  const b = match.participant_b ? participantsById.get(match.participant_b) : undefined;
  const won = countGames(match.games);
  const live = match.status === 'in_progress';
  const venue = match.venue_id ? venuesById.get(match.venue_id)?.name : undefined;

  const name = (slot: 'a' | 'b') => {
    const p = slot === 'a' ? a : b;
    const id = slot === 'a' ? match.participant_a : match.participant_b;
    const winner = !!id && match.winner_id === id;
    const loser = !!match.winner_id && !!id && !winner;
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cx(
            'min-w-0 flex-1 truncate',
            big ? 'text-base' : 'text-sm',
            winner ? 'font-bold text-navy-950' : loser ? 'text-slate-400' : 'font-medium text-navy-800',
            !p && 'italic text-slate-400',
          )}
        >
          {p?.name ?? 'TBD'}
          {p?.seed ? <span className="ml-1 text-[10px] font-bold text-navy-400">[{p.seed}]</span> : null}
        </span>
        <span className="flex gap-1">
          {match.games.map((g, i) => {
            const mine = slot === 'a' ? g.a : g.b;
            const theirs = slot === 'a' ? g.b : g.a;
            return (
              <span
                key={i}
                className={cx('w-6 text-center text-xs tabular-nums', mine > theirs ? 'font-bold text-navy-900' : 'text-slate-400')}
              >
                {mine}
              </span>
            );
          })}
        </span>
        {(match.games.length > 0 || live) && (
          <span
            className={cx(
              'flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold tabular-nums',
              winner ? 'bg-pitch-600 text-white' : live ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500',
            )}
          >
            {won[slot]}
          </span>
        )}
        {match.status === 'walkover' && winner && (
          <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">W/O</span>
        )}
      </div>
    );
  };

  return (
    <button
      onClick={onClick}
      className={cx(
        'card relative flex w-full flex-col gap-3 overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift sm:flex-row sm:items-center',
        live && 'ring-2 ring-red-200',
      )}
    >
      <span className={cx('absolute inset-y-0 left-0 w-1', STATUS_STYLE[match.status].bar)} />
      <div className="flex shrink-0 items-start gap-3 sm:w-56">
        {category && (
          <span className="mt-0.5 rounded-lg bg-navy-50 p-1.5 text-navy-700">
            <SportIcon sport={category.sport} className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-navy-900">{category?.name}</div>
          <div className="text-[11px] text-slate-500">
            {draw ? roundName(match.round, draw.rounds) : ''} · M{match.number}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {name('a')}
        {name('b')}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:w-44 sm:flex-col sm:items-end">
        <StatusBadge status={match.status} />
        {venue && (
          <span className="flex items-center gap-1 font-medium text-navy-700">
            <MapPin className="h-3.5 w-3.5" /> {venue}
          </span>
        )}
        {match.scheduled_at && (
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {match.status === 'completed' || match.status === 'walkover' ? formatDateTime(match.scheduled_at) : formatTime(match.scheduled_at) + ' · ' + new Date(match.scheduled_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </button>
  );
}
