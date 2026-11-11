'use client';

import { ArrowRight, CalendarClock, CheckCircle2, MapPin, Trophy } from 'lucide-react';
import { roundName } from '@/lib/draw';
import { formatDateTime } from '@/lib/format';
import { countGames, SCORING_RULES } from '@/lib/scoring';
import { useTournament } from '@/lib/data';
import type { Match } from '@/lib/types';
import { Modal, StatusBadge, cx } from '../ui';

export function MatchDetail({ match: initial, onClose }: { match: Match | null; onClose: () => void }) {
  const { participantsById, categoriesById, venuesById, draws, matches } = useTournament();
  if (!initial) return null;
  // Always show the freshest (realtime) version of the match
  const match = matches.find((m) => m.id === initial.id) ?? initial;
  const draw = draws.find((d) => d.id === match.draw_id);
  const category = categoriesById.get(match.category_id);
  const rounds = draw?.rounds ?? 1;
  const a = match.participant_a ? participantsById.get(match.participant_a) : undefined;
  const b = match.participant_b ? participantsById.get(match.participant_b) : undefined;
  const won = countGames(match.games);
  const venue = match.venue_id ? venuesById.get(match.venue_id) : undefined;
  const next =
    match.round < rounds
      ? matches.find((m) => m.draw_id === match.draw_id && m.round === match.round + 1 && m.position === Math.floor(match.position / 2))
      : undefined;
  const feeders = matches.filter((m) => m.draw_id === match.draw_id && m.round === match.round - 1 && Math.floor(m.position / 2) === match.position);
  const isFinal = match.round === rounds;
  const hasResult = ['completed', 'walkover', 'bye'].includes(match.status);

  const side = (slot: 'a' | 'b') => {
    const p = slot === 'a' ? a : b;
    const id = slot === 'a' ? match.participant_a : match.participant_b;
    const winner = !!id && match.winner_id === id;
    const feeder = feeders.find((f) => f.position % 2 === (slot === 'a' ? 0 : 1));
    return (
      <div
        className={cx(
          'flex min-w-0 flex-1 flex-col items-center rounded-2xl p-4 text-center',
          winner ? 'bg-pitch-50 ring-1 ring-pitch-200' : 'bg-slate-50',
        )}
      >
        <div className="flex h-6 items-center">
          {winner && (
            <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-pitch-700">
              <CheckCircle2 className="h-4 w-4" /> {isFinal ? 'Champion' : 'Winner'}
            </span>
          )}
        </div>
        <div className={cx('mt-1 line-clamp-2 font-display text-xl font-semibold uppercase', p ? 'text-navy-900' : 'text-slate-400')}>
          {p?.name ?? (match.bye ? 'BYE' : feeder ? `Winner of M${feeder.number}` : 'TBD')}
        </div>
        {p && (
          <div className="mt-1 text-xs text-slate-500">
            {p.player2 ? `${p.player1} & ${p.player2}` : p.club || ' '}
            {p.seed ? <span className="ml-1 font-semibold text-navy-500">· Seed {p.seed}</span> : null}
          </div>
        )}
        {match.games.length > 0 && (
          <div className={cx('mt-2 font-display text-4xl font-bold tabular-nums', winner ? 'text-pitch-700' : 'text-navy-800')}>
            {won[slot]}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <div>
          <div className="eyebrow text-pitch-700">{category?.name}</div>
          <div className="flex flex-wrap items-center gap-2">
            {roundName(match.round, rounds)} · Match M{match.number}
            <StatusBadge status={match.status} />
          </div>
        </div>
      }
    >
      <div className="flex items-stretch gap-3">
        {side('a')}
        <div className="flex items-center font-display text-sm font-bold text-slate-400">VS</div>
        {side('b')}
      </div>

      {match.games.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Player</th>
                {match.games.map((_, i) => (
                  <th key={i} className="px-3 py-2 text-center font-semibold">
                    G{i + 1}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold">Games</th>
              </tr>
            </thead>
            <tbody>
              {(['a', 'b'] as const).map((slot) => {
                const p = slot === 'a' ? a : b;
                return (
                  <tr key={slot} className="border-t border-slate-100">
                    <td className="max-w-[10rem] truncate px-3 py-2 font-medium">{p?.name ?? 'TBD'}</td>
                    {match.games.map((g, i) => {
                      const mine = slot === 'a' ? g.a : g.b;
                      const theirs = slot === 'a' ? g.b : g.a;
                      return (
                        <td key={i} className={cx('px-3 py-2 text-center tabular-nums', mine > theirs ? 'font-bold text-navy-900' : 'text-slate-400')}>
                          {mine}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold tabular-nums">{won[slot]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <CalendarClock className="h-4 w-4 text-slate-400" />
          <span className="text-slate-500">Scheduled:</span>
          <span className="font-medium">{match.scheduled_at ? formatDateTime(match.scheduled_at) : 'Not scheduled'}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          <span className="text-slate-500">Court/Table:</span>
          <span className="font-medium">{venue?.name ?? 'To be assigned'}</span>
        </div>
        {match.completed_at && match.status !== 'bye' && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 sm:col-span-2">
            <CheckCircle2 className="h-4 w-4 text-pitch-600" />
            <span className="text-slate-500">Result validated:</span>
            <span className="font-medium">{formatDateTime(match.validated_at ?? match.completed_at)}</span>
          </div>
        )}
      </dl>

      {match.status === 'walkover' && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Walkover — {match.notes || 'opponent did not play'}.
        </p>
      )}
      {match.status === 'bye' && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          BYE: {participantsById.get(match.winner_id ?? '')?.name} advances automatically to the next round.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>{category ? SCORING_RULES[category.sport].text : ''}</span>
        {next ? (
          <span className="flex items-center gap-1 font-medium text-navy-700">
            Winner advances to {roundName(next.round, rounds)} M{next.number} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        ) : (
          isFinal && (
            <span className="flex items-center gap-1 font-semibold text-gold-600">
              <Trophy className="h-4 w-4" /> {hasResult ? 'Championship decided' : 'Winner becomes champion'}
            </span>
          )
        )}
      </div>
    </Modal>
  );
}
