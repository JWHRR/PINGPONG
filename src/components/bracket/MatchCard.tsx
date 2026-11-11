'use client';

import { Check, Clock, MapPin } from 'lucide-react';
import { countGames } from '@/lib/scoring';
import { formatTime } from '@/lib/format';
import type { Match, Participant, Slot } from '@/lib/types';
import { STATUS_STYLE, cx } from '../ui';

export const CARD_W = 272;
export const CARD_H = 92;

interface Props {
  match: Match;
  a?: Participant;
  b?: Participant;
  venueName?: string;
  feederA?: string; // e.g. "Winner M3"
  feederB?: string;
  highlightId?: string | null;
  onHover?: (id: string | null) => void;
  onClick?: () => void;
  style?: React.CSSProperties;
  compact?: boolean;
}

function PlayerRow({
  slot,
  match,
  p,
  feeder,
  highlightId,
  onHover,
}: {
  slot: Slot;
  match: Match;
  p?: Participant;
  feeder?: string;
  highlightId?: string | null;
  onHover?: (id: string | null) => void;
}) {
  const id = slot === 'a' ? match.participant_a : match.participant_b;
  const decided = match.status === 'completed' || match.status === 'walkover' || match.status === 'bye';
  const isWinner = !!id && match.winner_id === id;
  const isLoser = decided && !!id && !!match.winner_id && match.winner_id !== id;
  const isBye = match.bye && !id;
  const won = countGames(match.games)[slot];
  const highlighted = !!id && highlightId === id;

  return (
    <div
      className={cx(
        'flex h-[34px] items-center gap-2 px-2.5 transition-colors',
        isWinner && 'bg-pitch-50/80',
        highlighted && '!bg-gold-100',
      )}
      onMouseEnter={() => id && onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {p?.seed ? (
        <span className="w-5 shrink-0 text-center text-[10px] font-bold text-navy-400">[{p.seed}]</span>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <span
        className={cx(
          'min-w-0 flex-1 truncate text-[13px] leading-tight',
          isWinner && 'font-bold text-navy-950',
          !isWinner && p && !isLoser && 'font-medium text-navy-800',
          isLoser && 'text-slate-400 line-through decoration-slate-300',
          !p && !isBye && 'italic text-slate-400',
          isBye && 'font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400',
        )}
        title={p?.name}
      >
        {p ? p.name : isBye ? 'BYE' : feeder ?? 'TBD'}
      </span>
      {match.games.length > 0 && (
        <span className="flex shrink-0 gap-0.5">
          {match.games.map((g, i) => {
            const mine = slot === 'a' ? g.a : g.b;
            const theirs = slot === 'a' ? g.b : g.a;
            return (
              <span
                key={i}
                className={cx(
                  'w-[22px] rounded text-center text-[11px] tabular-nums',
                  mine > theirs ? 'font-bold text-navy-900' : 'text-slate-400',
                )}
              >
                {mine}
              </span>
            );
          })}
        </span>
      )}
      {(match.status === 'completed' || match.status === 'in_progress') && (
        <span
          className={cx(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums',
            isWinner ? 'bg-pitch-600 text-white' : 'bg-slate-100 text-slate-500',
            match.status === 'in_progress' && 'bg-red-50 text-red-700',
          )}
        >
          {won}
        </span>
      )}
      {match.status === 'walkover' && isWinner && (
        <span className="shrink-0 rounded-md bg-amber-100 px-1 text-[10px] font-bold text-amber-800">W/O</span>
      )}
      {match.status === 'bye' && isWinner && <Check className="h-4 w-4 shrink-0 text-pitch-600" />}
    </div>
  );
}

export function MatchCard({ match, a, b, venueName, feederA, feederB, highlightId, onHover, onClick, style }: Props) {
  const s = STATUS_STYLE[match.status];
  const live = match.status === 'in_progress';
  const involved = !!highlightId && (match.participant_a === highlightId || match.participant_b === highlightId);
  return (
    <button
      type="button"
      data-card
      onClick={onClick}
      style={{ width: CARD_W, height: CARD_H, ...style }}
      className={cx(
        'group absolute flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-card transition',
        'hover:-translate-y-0.5 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-pitch-500',
        match.bye ? 'border-dashed border-slate-300 bg-slate-50/80 shadow-none' : 'border-slate-200',
        live && 'border-red-300 ring-2 ring-red-200',
        involved && 'ring-2 ring-gold-400',
      )}
      aria-label={`Match ${match.number}: ${a?.name ?? 'TBD'} vs ${b?.name ?? (match.bye ? 'BYE' : 'TBD')}`}
    >
      <span className={cx('absolute inset-y-0 left-0 w-1', s.bar, live && 'animate-livepulse')} />
      <div className="flex h-[22px] items-center gap-2 border-b border-slate-100 pl-3 pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="text-navy-500">M{match.number}</span>
        {venueName && (
          <span className="flex min-w-0 items-center gap-0.5 truncate">
            <MapPin className="h-3 w-3" />
            {venueName}
          </span>
        )}
        {match.scheduled_at && !['completed', 'walkover', 'bye'].includes(match.status) && (
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {formatTime(match.scheduled_at)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {live ? (
            <span className="flex items-center gap-1 text-red-600">
              <span className="h-1.5 w-1.5 animate-livepulse rounded-full bg-red-500" /> Live
            </span>
          ) : match.status === 'bye' ? (
            'Bye'
          ) : match.status === 'walkover' ? (
            <span className="text-amber-700">Walkover</span>
          ) : match.status === 'completed' ? (
            <span className="text-pitch-700">Completed</span>
          ) : match.status === 'scheduled' ? (
            <span className="text-sky-600">Scheduled</span>
          ) : (
            'Pending'
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center divide-y divide-slate-100 pl-1">
        <PlayerRow slot="a" match={match} p={a} feeder={feederA} highlightId={highlightId} onHover={onHover} />
        <PlayerRow slot="b" match={match} p={b} feeder={feederB} highlightId={highlightId} onHover={onHover} />
      </div>
    </button>
  );
}
