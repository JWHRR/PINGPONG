'use client';

import { CalendarClock, Check, ChevronDown, Crown, Flag, MapPin, Play, RotateCcw, Save, Swords, Unlock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, adminApi, useAdminAction } from '@/lib/adminApi';
import { useTournament } from '@/lib/data';
import { roundName } from '@/lib/draw';
import { formatDateTime, toLocalInput } from '@/lib/format';
import { SCORING_RULES, validateLiveScore, validateMatchResult } from '@/lib/scoring';
import type { Category, Draw, Game, Match } from '@/lib/types';
import { ChampionCard } from '../bracket/Bracket';
import { CategoryPicker } from '../CategoryPicker';
import { EmptyState, Spinner, StatusBadge, cx, useConfirm, useToast } from '../ui';

type Filter = 'all' | 'ready' | 'live' | 'done' | 'waiting';

export function MatchesAdmin({ initialCategory, onCategory }: { initialCategory: string | null; onCategory: (id: string) => void }) {
  const { categories, matches, publishedDrawByCategory, participantsById } = useTournament();
  const { run, busy } = useAdminAction();
  const confirm = useConfirm();
  const withDraw = categories.filter((c) => publishedDrawByCategory.has(c.id));
  const [categoryId, setCategoryId] = useState<string | null>(
    initialCategory && publishedDrawByCategory.has(initialCategory) ? initialCategory : withDraw[0]?.id ?? null,
  );
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId && withDraw[0]) setCategoryId(withDraw[0].id);
  }, [withDraw, categoryId]);

  const category = categories.find((c) => c.id === categoryId);
  const draw = categoryId ? publishedDrawByCategory.get(categoryId) : undefined;
  const ms = useMemo(() => (draw ? matches.filter((m) => m.draw_id === draw.id).sort((a, b) => a.number - b.number) : []), [draw, matches]);
  const final = draw ? ms.find((m) => m.round === draw.rounds) : undefined;
  const finalDone = !!final?.winner_id && ['completed', 'walkover'].includes(final.status);

  const visible = ms.filter((m) => {
    if (m.status === 'bye') return filter === 'all';
    const both = m.participant_a && m.participant_b;
    switch (filter) {
      case 'ready':
        return both && (m.status === 'pending' || m.status === 'scheduled');
      case 'live':
        return m.status === 'in_progress';
      case 'done':
        return m.status === 'completed' || m.status === 'walkover';
      case 'waiting':
        return !both;
      default:
        return true;
    }
  });

  const declare = async () => {
    if (!category || !final?.winner_id) return;
    const name = participantsById.get(final.winner_id)?.name;
    const ok = await confirm({
      title: 'Declare champion',
      message: (
        <>
          Declare <b>{name}</b> the official champion of {category.name}? Results in this category will be locked.
        </>
      ),
      confirmLabel: 'Declare champion',
    });
    if (ok) await run('champ', () => adminApi('champion', 'POST', { action: 'declare', categoryId: category.id }), `${name} declared champion 🏆`);
  };
  const reopen = async () => {
    if (!category) return;
    const ok = await confirm({
      title: 'Re-open category',
      message: 'This removes the official champion declaration and unlocks results for corrections.',
      confirmLabel: 'Re-open',
      danger: true,
      typeToConfirm: category.name,
    });
    if (ok) await run('reopen', () => adminApi('champion', 'POST', { action: 'reopen', categoryId: category.id }), 'Category re-opened');
  };

  if (!withDraw.length) {
    return (
      <EmptyState icon={<Swords className="h-6 w-6" />} title="No published draws">
        Publish a draw in the Draws tab to schedule matches and enter scores.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <CategoryPicker
          categories={withDraw}
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            onCategory(id);
            setOpen(null);
          }}
        />
      </div>

      {category && draw && finalDone && (
        <div className="card flex flex-col items-center gap-4 p-5 sm:flex-row">
          <div className="w-full max-w-xs">
            <ChampionCard
              champion={participantsById.get(category.champion_id ?? final!.winner_id!)}
              declared={category.status === 'completed'}
              declaredAt={category.champion_declared_at}
            />
          </div>
          <div className="flex-1 text-sm text-slate-600">
            {category.status === 'completed' ? (
              <>
                <p>The champion is officially declared and results are locked.</p>
                <button className="btn-secondary mt-3" onClick={reopen} disabled={!!busy}>
                  <Unlock className="h-4 w-4" /> Re-open for corrections
                </button>
              </>
            ) : (
              <>
                <p>The final has been validated. Declare the champion to finalise this category and lock its results.</p>
                <button className="btn-accent mt-3" onClick={declare} disabled={!!busy}>
                  {busy === 'champ' ? <Spinner className="h-4 w-4" /> : <Crown className="h-4 w-4" />} Declare tournament champion
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {(
          [
            ['all', 'All'],
            ['ready', 'Ready to play'],
            ['live', 'Live'],
            ['done', 'Completed'],
            ['waiting', 'Awaiting players'],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cx('rounded-full px-3 py-1.5 text-xs font-semibold', filter === id ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-slate-200')}
          >
            {label}
          </button>
        ))}
      </div>

      {category && draw && (
        <div className="space-y-2">
          {visible.map((m, i) => (
            <div key={m.id}>
              {(i === 0 || visible[i - 1].round !== m.round) && (
                <div className="mb-2 mt-4 font-display text-sm font-bold uppercase tracking-wider text-slate-500">{roundName(m.round, draw.rounds)}</div>
              )}
              <MatchEditor match={m} draw={draw} category={category} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />
            </div>
          ))}
          {visible.length === 0 && <div className="card p-6 text-center text-sm text-slate-500">No matches for this filter.</div>}
        </div>
      )}
    </div>
  );
}

function MatchEditor({ match, draw, category, open, onToggle }: { match: Match; draw: Draw; category: Category; open: boolean; onToggle: () => void }) {
  const { participantsById, venues, venuesById } = useTournament();
  const { run, busy } = useAdminAction();
  const confirm = useConfirm();
  const toast = useToast();
  const a = match.participant_a ? participantsById.get(match.participant_a) : undefined;
  const b = match.participant_b ? participantsById.get(match.participant_b) : undefined;
  const hasResult = match.status === 'completed' || match.status === 'walkover';
  const locked = category.status === 'completed';
  const playable = !!a && !!b && match.status !== 'bye';

  const blank = () => [0, 1, 2].map((i) => ({ a: match.games[i]?.a?.toString() ?? '', b: match.games[i]?.b?.toString() ?? '' }));
  const [rows, setRows] = useState(blank);
  const [when, setWhen] = useState(toLocalInput(match.scheduled_at));
  const [venue, setVenue] = useState(match.venue_id ?? '');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!open) {
      setRows(blank());
      setWhen(toLocalInput(match.scheduled_at));
      setVenue(match.venue_id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.updated_at, open]);

  const games: Game[] = rows.filter((r) => r.a !== '' || r.b !== '').map((r) => ({ a: Number(r.a || 0), b: Number(r.b || 0) }));
  const check = validateMatchResult(category.sport, games);
  const liveCheck = validateLiveScore(category.sport, games);
  const winnerName = check.ok ? (check.winner === 'a' ? a?.name : b?.name) : null;

  /** Calls the API; if a downstream match is already played, asks before cascading. */
  const call = async (key: string, body: Record<string, unknown>, success: string) => {
    try {
      await run(key, () => adminApi('matches', 'POST', body), success);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DOWNSTREAM_PLAYED') {
        const ok = await confirm({
          title: 'Reset dependent results?',
          message: <>{e.message} Do you want to continue? The affected later-round matches will be reset and must be replayed/re-entered.</>,
          confirmLabel: 'Correct & reset later rounds',
          danger: true,
        });
        if (ok) await run(key, () => adminApi('matches', 'POST', { ...body, cascade: true }), success);
      } else if (e instanceof ApiError) toast('error', e.message);
    }
  };

  const confirmResult = async () => {
    if (!check.ok) return toast('error', check.errors.join(' · '));
    const ok = await confirm({
      title: hasResult ? 'Correct result' : 'Validate result',
      message: (
        <>
          <b>{winnerName}</b> wins {check.gamesWon.a}–{check.gamesWon.b} in games ({games.map((g) => `${g.a}-${g.b}`).join(', ')}).
          {draw.rounds > match.round ? ' The winner will advance to the next round.' : ' This decides the champion.'}
        </>
      ),
      confirmLabel: hasResult ? 'Save correction' : 'Validate & advance winner',
    });
    if (ok) await call('confirm', { action: 'confirm', matchId: match.id, games }, hasResult ? 'Result corrected' : `Result validated — ${winnerName} advances`);
  };

  const walkover = async (winnerId: string) => {
    const w = participantsById.get(winnerId)?.name;
    const ok = await confirm({
      title: 'Award walkover',
      message: (
        <>
          Award the match to <b>{w}</b> by walkover{reason ? ` (${reason})` : ''}? The opponent is eliminated.
        </>
      ),
      confirmLabel: 'Award walkover',
      danger: true,
    });
    if (ok) await call('wo', { action: 'walkover', matchId: match.id, winnerId, reason: reason || 'Walkover' }, `Walkover awarded to ${w}`);
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset match',
      message: 'Clear the score and result of this match? If the winner had advanced, they are removed from the next round.',
      confirmLabel: 'Reset match',
      danger: true,
    });
    if (ok) await call('reset', { action: 'reset', matchId: match.id }, 'Match reset');
  };

  const saveSchedule = () =>
    call('sched', { action: 'schedule', matchId: match.id, scheduled_at: when ? new Date(when).toISOString() : null, venue_id: venue || null }, 'Schedule saved');

  const saveLive = () => {
    if (!liveCheck.ok) return toast('error', liveCheck.errors.join(' · '));
    return call('live', { action: 'live', matchId: match.id, games }, match.status === 'in_progress' ? 'Live score updated' : 'Match started — now live');
  };

  const venueOptions = venues.filter((v) => v.active && (v.sport === 'any' || v.sport === category.sport));

  return (
    <div className={cx('card overflow-hidden', open && 'ring-2 ring-pitch-200')}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/60">
        <span className="w-10 shrink-0 font-mono text-xs font-bold text-navy-500">M{match.number}</span>
        <div className="min-w-0 flex-1 text-sm">
          <div className={cx('truncate', match.winner_id && match.winner_id === match.participant_a ? 'font-bold text-navy-950' : 'text-navy-800', !a && 'italic text-slate-400')}>
            {a?.name ?? (match.bye ? 'BYE' : 'TBD')}
          </div>
          <div className={cx('truncate', match.winner_id && match.winner_id === match.participant_b ? 'font-bold text-navy-950' : 'text-navy-800', !b && 'italic text-slate-400')}>
            {b?.name ?? (match.bye ? 'BYE' : 'TBD')}
          </div>
        </div>
        <div className="hidden text-right text-xs tabular-nums text-slate-500 sm:block">
          {match.games.length > 0 && <div className="font-semibold text-navy-800">{match.games.map((g) => `${g.a}-${g.b}`).join('  ')}</div>}
          <div>
            {match.venue_id && <>{venuesById.get(match.venue_id)?.name} · </>}
            {match.scheduled_at ? formatDateTime(match.scheduled_at) : ''}
          </div>
        </div>
        <StatusBadge status={match.status} />
        {match.status !== 'bye' && <ChevronDown className={cx('h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')} />}
      </button>

      {open && match.status !== 'bye' && (
        <div className="grid gap-5 border-t border-slate-100 bg-slate-50/50 p-4 lg:grid-cols-2">
          {/* Schedule */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CalendarClock className="h-4 w-4" /> Schedule & court/table
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date and time" />
              <select className="input" value={venue} onChange={(e) => setVenue(e.target.value)} aria-label="Court or table">
                <option value="">No court/table</option>
                {venueOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-secondary btn-sm" onClick={saveSchedule} disabled={!!busy}>
              {busy === 'sched' ? <Spinner className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} Save schedule
            </button>
          </div>

          {/* Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="flex items-center gap-2">
                <Swords className="h-4 w-4" /> Score (best of 3)
              </span>
              <span className="normal-case tracking-normal text-slate-400">{SCORING_RULES[category.sport].points} pts, win by 2</span>
            </div>
            {!playable ? (
              <div className="rounded-xl bg-white p-3 text-sm text-slate-500 ring-1 ring-slate-200">Waiting for both participants to be decided.</div>
            ) : locked ? (
              <div className="rounded-xl bg-white p-3 text-sm text-slate-500 ring-1 ring-slate-200">Champion declared — results are locked. Re-open the category to correct.</div>
            ) : (
              <>
                <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold">Player</th>
                        {[1, 2, 3].map((g) => (
                          <th key={g} className="w-16 px-1 py-1.5 font-semibold">
                            G{g}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(['a', 'b'] as const).map((s) => (
                        <tr key={s} className="border-t border-slate-100">
                          <td className="max-w-[9rem] truncate px-3 py-1.5 font-medium">{(s === 'a' ? a : b)?.name}</td>
                          {rows.map((r, i) => (
                            <td key={i} className="px-1 py-1.5">
                              <input
                                inputMode="numeric"
                                className="input px-1 py-1.5 text-center tabular-nums"
                                value={r[s]}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                                  setRows(rows.map((x, j) => (j === i ? { ...x, [s]: v } : x)));
                                }}
                                aria-label={`Game ${i + 1} ${(s === 'a' ? a : b)?.name}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={cx('rounded-xl px-3 py-2 text-xs', check.ok ? 'bg-pitch-50 text-pitch-800' : 'bg-white text-slate-500 ring-1 ring-slate-200')}>
                  {check.ok ? (
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Check className="h-4 w-4" /> Valid result — {winnerName} wins {Math.max(check.gamesWon.a, check.gamesWon.b)}–
                      {Math.min(check.gamesWon.a, check.gamesWon.b)}
                    </span>
                  ) : games.length ? (
                    check.errors[0]
                  ) : (
                    'Enter game scores. Save a live score during play, then validate the final result.'
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!hasResult && (
                    <button className="btn-secondary btn-sm" onClick={saveLive} disabled={!!busy || (!liveCheck.ok && games.length > 0)}>
                      {busy === 'live' ? <Spinner className="h-4 w-4" /> : match.status === 'in_progress' ? <Save className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {match.status === 'in_progress' ? 'Update live score' : 'Start / live score'}
                    </button>
                  )}
                  <button className="btn-accent btn-sm" onClick={confirmResult} disabled={!!busy || !check.ok}>
                    {busy === 'confirm' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    {hasResult ? 'Save correction' : 'Validate result'}
                  </button>
                  {(hasResult || match.status === 'in_progress') && (
                    <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={reset} disabled={!!busy}>
                      <RotateCcw className="h-4 w-4" /> Reset
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                  <Flag className="h-4 w-4 text-amber-600" />
                  <input className="input max-w-[12rem] py-1.5 text-xs" placeholder="Walkover reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="btn-secondary btn-sm" onClick={() => walkover(match.participant_a!)} disabled={!!busy}>
                    W/O → {a?.name}
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => walkover(match.participant_b!)} disabled={!!busy}>
                    W/O → {b?.name}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
