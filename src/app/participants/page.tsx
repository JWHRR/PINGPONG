'use client';

import { Crown, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MatchDetail } from '@/components/bracket/MatchDetail';
import { MatchRow } from '@/components/MatchRow';
import { SetupNotice } from '@/components/SetupNotice';
import { EmptyState, LevelBadge, Modal, SkeletonBlock, SportIcon, cx } from '@/components/ui';
import { useTournament } from '@/lib/data';
import { roundName } from '@/lib/draw';
import { initials } from '@/lib/format';
import type { Match, Participant, Sport } from '@/lib/types';
import { LEVEL_LABEL, PLAYER_LEVELS, SPORT_LABEL } from '@/lib/types';

/** Where a participant currently stands in their bracket. */
function useStanding() {
  const { publicMatches, publishedDrawByCategory, categoriesById } = useTournament();
  return (p: Participant): { label: string; tone: 'gold' | 'green' | 'red' | 'slate' } => {
    const category = categoriesById.get(p.category_id);
    if (category?.champion_id === p.id) return { label: 'Champion', tone: 'gold' };
    const draw = publishedDrawByCategory.get(p.category_id);
    if (!draw) return { label: 'Registered', tone: 'slate' };
    const mine = publicMatches.filter((m) => m.draw_id === draw.id && (m.participant_a === p.id || m.participant_b === p.id));
    if (!mine.length) return { label: 'Not in draw', tone: 'slate' };
    const lost = mine.find((m) => m.winner_id && m.winner_id !== p.id);
    if (lost) return { label: `Out · ${roundName(lost.round, draw.rounds)}`, tone: 'red' };
    const final = mine.find((m) => m.round === draw.rounds && m.winner_id === p.id);
    if (final) return { label: 'Won the final', tone: 'gold' };
    const current = mine.sort((a, b) => b.round - a.round)[0];
    return { label: `Active · ${roundName(current.round, draw.rounds)}`, tone: 'green' };
  };
}

export default function ParticipantsPage() {
  const { participants, categories, categoriesById, loading } = useTournament();
  const standing = useStanding();
  const [q, setQ] = useState('');
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [categoryId, setCategoryId] = useState('all');
  const [level, setLevel] = useState('all');
  const [profile, setProfile] = useState<Participant | null>(null);

  const visibleCategories = categories.filter((c) => sport === 'all' || c.sport === sport);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return participants
      .filter((p) => {
        const c = categoriesById.get(p.category_id);
        if (!c) return false;
        if (sport !== 'all' && c.sport !== sport) return false;
        if (categoryId !== 'all' && p.category_id !== categoryId) return false;
        if (level !== 'all' && p.level !== level) return false;
        if (!needle) return true;
        return [p.name, p.player1, p.player2, p.club].some((s) => s?.toLowerCase().includes(needle));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, categoriesById, q, sport, categoryId, level]);

  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="container-page py-8">
          <div className="eyebrow text-pitch-700">Participants</div>
          <h1 className="mt-1 font-display text-4xl font-bold uppercase tracking-tight text-navy-900 sm:text-5xl">Players & teams</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Search by name or club…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <select
              className="input"
              value={sport}
              onChange={(e) => {
                setSport(e.target.value as Sport | 'all');
                setCategoryId('all');
              }}
              aria-label="Sport"
            >
              <option value="all">All sports</option>
              <option value="table_tennis">Table Tennis</option>
              <option value="badminton">Badminton</option>
            </select>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category">
              <option value="all">All tournaments</option>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
              <option value="all">All levels</option>
              {PLAYER_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <SetupNotice />

      <div className="container-page mt-6">
        <div className="mb-3 text-sm text-slate-500">
          {list.length} of {participants.length} entries
        </div>
        {loading && !participants.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No participants found">
            {participants.length ? 'Try a different search or filter.' : 'Players appear here once organisers register them.'}
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const c = categoriesById.get(p.category_id)!;
              const s = standing(p);
              return (
                <button key={p.id} onClick={() => setProfile(p)} className="card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift">
                  <span
                    className={cx(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold text-white',
                      c.sport === 'table_tennis' ? 'bg-gradient-to-br from-navy-600 to-navy-900' : 'bg-gradient-to-br from-pitch-500 to-pitch-800',
                    )}
                  >
                    {initials(p.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-semibold text-navy-900">
                      {p.name}
                      {p.seed ? <span className="text-[10px] font-bold text-navy-400">[{p.seed}]</span> : null}
                    </div>
                    <div className="flex items-center gap-1 truncate text-xs text-slate-500">
                      <SportIcon sport={c.sport} className="h-3 w-3 shrink-0" />
                      {c.name}
                      {p.club ? ` · ${p.club}` : ''}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <LevelBadge level={p.level} className="mt-1.5" />
                      <StandingPill {...s} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <Profile participant={profile} onClose={() => setProfile(null)} />
    </div>
  );
}

function StandingPill({ label, tone }: { label: string; tone: 'gold' | 'green' | 'red' | 'slate' }) {
  return (
    <span
      className={cx(
        'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone === 'gold' && 'bg-gold-100 text-gold-600',
        tone === 'green' && 'bg-pitch-50 text-pitch-700',
        tone === 'red' && 'bg-red-50 text-red-600',
        tone === 'slate' && 'bg-slate-100 text-slate-500',
      )}
    >
      {tone === 'gold' && <Crown className="h-3 w-3" />}
      {label}
    </span>
  );
}

function Profile({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  const { categoriesById, publicMatches, publishedDrawByCategory } = useTournament();
  const standing = useStanding();
  const [selected, setSelected] = useState<Match | null>(null);
  if (!participant) return null;
  const c = categoriesById.get(participant.category_id);
  const draw = publishedDrawByCategory.get(participant.category_id);
  const history = publicMatches
    .filter((m) => m.draw_id === draw?.id && (m.participant_a === participant.id || m.participant_b === participant.id))
    .sort((a, b) => a.round - b.round);
  const played = history.filter((m) => m.status === 'completed' || m.status === 'walkover');
  const wins = played.filter((m) => m.winner_id === participant.id).length;
  return (
    <>
      <Modal open={!selected} onClose={onClose} size="lg" title={participant.name}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-navy-700 to-pitch-700 font-display text-2xl font-bold text-white">
            {initials(participant.name)}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-navy-900">{c?.name}</div>
            <div className="text-slate-500">
              {participant.player2 ? `${participant.player1} & ${participant.player2}` : participant.player1}
              {participant.club ? ` · ${participant.club}` : ''}
              {participant.seed ? ` · Seed ${participant.seed}` : ''}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <LevelBadge level={participant.level} className="mt-1.5" />
              <StandingPill {...standing(participant)} />
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <div className="font-display text-3xl font-bold text-pitch-700">{wins}</div>
              <div className="text-[11px] uppercase text-slate-500">Wins</div>
            </div>
            <div>
              <div className="font-display text-3xl font-bold text-navy-900">{played.length - wins}</div>
              <div className="text-[11px] uppercase text-slate-500">Losses</div>
            </div>
          </div>
        </div>
        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Match history</h3>
        <div className="space-y-2">
          {history.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No matches yet — the draw has not been published.</div>}
          {history.map((m) => (
            <MatchRow key={m.id} match={m} onClick={() => setSelected(m)} />
          ))}
        </div>
        {c && <div className="mt-4 text-xs text-slate-400">{SPORT_LABEL[c.sport]} · best of 3 games</div>}
      </Modal>
      <MatchDetail match={selected} onClose={() => setSelected(null)} />
    </>
  );
}
