'use client';

import { Crown, Expand, Maximize2, Minimize2, Minus, Plus, ScanSearch, Trophy } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { roundName, shortRoundName } from '@/lib/draw';
import { formatDate } from '@/lib/format';
import type { Category, Draw, Match, Participant, Venue } from '@/lib/types';
import { cx } from '../ui';
import { CARD_H, CARD_W, MatchCard } from './MatchCard';

const GAP_Y = 20;
const COL_GAP = 68;
const HEADER_H = 64;
const PAD = 24;
const CHAMP_W = 260;
const MIN_SCALE = 0.3;
const MAX_SCALE = 1.6;

interface Props {
  draw: Draw;
  matches: Match[];
  category: Category;
  participantsById: Map<string, Participant>;
  venuesById: Map<string, Venue>;
  onSelect?: (m: Match) => void;
  preview?: boolean;
}

export function Legend({ className }: { className?: string }) {
  const items = [
    { label: 'Pending', el: <span className="h-3 w-1 rounded bg-slate-300" /> },
    { label: 'Scheduled', el: <span className="h-3 w-1 rounded bg-sky-500" /> },
    { label: 'In progress', el: <span className="h-3 w-1 animate-livepulse rounded bg-red-500" /> },
    { label: 'Completed', el: <span className="h-3 w-1 rounded bg-pitch-500" /> },
    { label: 'Walkover', el: <span className="h-3 w-1 rounded bg-amber-500" /> },
    { label: 'BYE', el: <span className="h-3 w-4 rounded border border-dashed border-slate-400 bg-slate-50" /> },
    {
      label: 'Winner',
      el: <span className="flex h-4 w-4 items-center justify-center rounded bg-pitch-600 text-[9px] font-bold text-white">2</span>,
    },
    { label: 'Eliminated', el: <span className="text-xs text-slate-400 line-through">Name</span> },
  ];
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600', className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.el}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function Bracket({ draw, matches, category, participantsById, venuesById, onSelect, preview }: Props) {
  const rounds = draw.rounds;
  const firstRoundCount = draw.bracket_size / 2;
  const [scale, setScale] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const userZoomed = useRef(false);

  // ---- layout -------------------------------------------------------------
  const layout = useMemo(() => {
    const byKey = new Map<string, Match>();
    for (const m of matches) byKey.set(`${m.round}:${m.position}`, m);
    const pos = new Map<string, { x: number; y: number }>();
    for (let r = 1; r <= rounds; r++) {
      const count = draw.bracket_size / 2 ** r;
      for (let p = 0; p < count; p++) {
        const x = PAD + (r - 1) * (CARD_W + COL_GAP);
        let y: number;
        if (r === 1) y = HEADER_H + p * (CARD_H + GAP_Y);
        else {
          const c1 = pos.get(`${r - 1}:${p * 2}`)!;
          const c2 = pos.get(`${r - 1}:${p * 2 + 1}`)!;
          y = (c1.y + c2.y) / 2;
        }
        pos.set(`${r}:${p}`, { x, y });
      }
    }
    const width = PAD * 2 + rounds * CARD_W + rounds * COL_GAP + CHAMP_W;
    const height = Math.max(HEADER_H + firstRoundCount * (CARD_H + GAP_Y) + PAD, HEADER_H + 250);
    return { byKey, pos, width, height };
  }, [matches, rounds, draw.bracket_size, firstRoundCount]);

  const final = layout.byKey.get(`${rounds}:0`);
  const finalDone = !!final && ['completed', 'walkover'].includes(final.status) && !!final.winner_id;
  const champion =
    (category.champion_id && participantsById.get(category.champion_id)) ||
    (finalDone ? participantsById.get(final!.winner_id!) : undefined);
  const declared = !!category.champion_id && category.status === 'completed';

  // ---- zoom -------------------------------------------------------------
  const clamp = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * 100) / 100));
  const fit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sx = (el.clientWidth - 8) / layout.width;
    const sy = (el.clientHeight - 8) / layout.height;
    setScale(clamp(Math.min(sx, sy, 1)));
  }, [layout.width, layout.height]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || userZoomed.current) return;
    // Phones: keep cards readable and scroll horizontally. Larger screens: fit the width.
    if (el.clientWidth < 640) setScale(clamp(Math.max(0.78, Math.min(1, el.clientWidth / (CARD_W * 1.35)))));
    else setScale(clamp(Math.min(1, Math.max(0.55, (el.clientWidth - 8) / layout.width))));
  }, [layout.width]);

  const zoomBy = (d: number) => {
    userZoomed.current = true;
    setScale((s) => clamp(s + d));
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      userZoomed.current = true;
      setScale((s) => clamp(s * (e.deltaY > 0 ? 0.92 : 1.08)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---- drag to pan (mouse) -------------------------------------------------
  const drag = useRef<{ x: number; y: number; l: number; t: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-card],button,a')) return;
    const el = scrollRef.current!;
    drag.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const el = scrollRef.current!;
    el.scrollLeft = d.l - (e.clientX - d.x);
    el.scrollTop = d.t - (e.clientY - d.y);
  };
  const onPointerUp = () => (drag.current = null);

  // ---- fullscreen -------------------------------------------------------------
  const toggleFullscreen = async () => {
    const next = !fullscreen;
    setFullscreen(next);
    try {
      if (next && wrapRef.current?.requestFullscreen) await wrapRef.current.requestFullscreen();
      else if (!next && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* CSS overlay fallback is already active */
    }
  };
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const firstFs = useRef(true);
  useEffect(() => {
    if (firstFs.current) {
      firstFs.current = false;
      return;
    }
    // Entering full screen shows the whole draw; leaving restores a readable size.
    if (fullscreen) setTimeout(fit, 80);
  }, [fullscreen, fit]);

  const jumpTo = (r: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const x = r > rounds ? PAD + rounds * (CARD_W + COL_GAP) : PAD + (r - 1) * (CARD_W + COL_GAP);
    const target = r > rounds ? layout.pos.get(`${rounds}:0`) : layout.pos.get(`${r}:0`);
    el.scrollTo({ left: Math.max(0, (x - 12) * scale), top: r === 1 ? 0 : Math.max(0, ((target?.y ?? 0) - 120) * scale), behavior: 'smooth' });
  };

  // ---- connectors -------------------------------------------------------------
  const paths: { d: string; state: 'idle' | 'advanced' | 'hover' }[] = [];
  for (const m of matches) {
    if (m.round >= rounds) continue;
    const from = layout.pos.get(`${m.round}:${m.position}`);
    const to = layout.pos.get(`${m.round + 1}:${Math.floor(m.position / 2)}`);
    if (!from || !to) continue;
    const x1 = from.x + CARD_W;
    const y1 = from.y + CARD_H / 2;
    const x2 = to.x;
    const y2 = to.y + 22 + (m.position % 2 === 0 ? 17 : 51); // into the correct player row
    const mx = x1 + COL_GAP / 2;
    const r = Math.min(8, Math.abs(y2 - y1) / 2);
    const dir = y2 > y1 ? 1 : -1;
    const d =
      Math.abs(y2 - y1) < 1
        ? `M${x1},${y1} H${x2}`
        : `M${x1},${y1} H${mx - r} Q${mx},${y1} ${mx},${y1 + dir * r} V${y2 - dir * r} Q${mx},${y2} ${mx + r},${y2} H${x2}`;
    const advanced = !!m.winner_id;
    paths.push({ d, state: hover && m.winner_id === hover ? 'hover' : advanced ? 'advanced' : 'idle' });
  }
  let champPath: string | null = null;
  const finalPos = layout.pos.get(`${rounds}:0`);
  const champX = PAD + rounds * (CARD_W + COL_GAP);
  if (finalPos) champPath = `M${finalPos.x + CARD_W},${finalPos.y + CARD_H / 2} H${champX}`;

  const feederLabel = (m: Match, slot: 'a' | 'b') => {
    if (m.round === 1) return undefined;
    const feeder = layout.byKey.get(`${m.round - 1}:${m.position * 2 + (slot === 'a' ? 0 : 1)}`);
    return feeder ? `Winner M${feeder.number}` : undefined;
  };

  return (
    <div
      ref={wrapRef}
      className={cx(
        'flex flex-col overflow-hidden bg-white',
        fullscreen ? 'fixed inset-0 z-[90]' : 'card relative',
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 sm:px-4">
        <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
          {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
            <button key={r} onClick={() => jumpTo(r)} className="btn-ghost btn-sm shrink-0 whitespace-nowrap font-display uppercase tracking-wide">
              <span className="sm:hidden">{shortRoundName(r, rounds)}</span>
              <span className="hidden sm:inline">{roundName(r, rounds)}</span>
            </button>
          ))}
          <button onClick={() => jumpTo(rounds + 1)} className="btn-ghost btn-sm shrink-0 font-display uppercase tracking-wide text-gold-600">
            <Trophy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Champion</span>
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button className="rounded-lg p-1.5 text-navy-700 hover:bg-white" onClick={() => zoomBy(-0.1)} aria-label="Zoom out" title="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
          <button
            className="w-12 rounded-lg py-1 text-center text-xs font-semibold tabular-nums text-navy-700 hover:bg-white"
            onClick={() => {
              userZoomed.current = true;
              setScale(1);
            }}
            title="Reset to 100%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button className="rounded-lg p-1.5 text-navy-700 hover:bg-white" onClick={() => zoomBy(0.1)} aria-label="Zoom in" title="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
          <button
            className="rounded-lg p-1.5 text-navy-700 hover:bg-white"
            onClick={() => {
              userZoomed.current = true;
              fit();
            }}
            aria-label="Fit to screen"
            title="Fit whole draw"
          >
            <ScanSearch className="h-4 w-4" />
          </button>
          <button
            className="rounded-lg p-1.5 text-navy-700 hover:bg-white"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            title={fullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={scrollRef}
        className={cx('bracket-canvas relative cursor-grab overflow-auto overscroll-contain bg-slate-50/70 active:cursor-grabbing', fullscreen ? 'flex-1' : '')}
        style={fullscreen ? undefined : { height: `min(78vh, ${Math.ceil(layout.height * scale) + 12}px)`, minHeight: 320 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div style={{ width: layout.width * scale, height: layout.height * scale, position: 'relative' }}>
          <div
            style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
            className="absolute left-0 top-0"
          >
            {preview && (
              <div className="pointer-events-none absolute right-6 top-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-800 ring-1 ring-amber-300">
                Preview · not published
              </div>
            )}
            {/* Round headers */}
            {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => {
              const count = draw.bracket_size / 2 ** r;
              const done = matches.filter((m) => m.round === r && ['completed', 'walkover', 'bye'].includes(m.status)).length;
              return (
                <div key={r} className="absolute top-3" style={{ left: PAD + (r - 1) * (CARD_W + COL_GAP), width: CARD_W }}>
                  <div className={cx('font-display text-base font-bold uppercase tracking-wider', r === rounds ? 'text-gold-600' : 'text-navy-900')}>
                    {roundName(r, rounds)}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500">
                    {count} match{count > 1 ? 'es' : ''} · {done}/{count} decided
                  </div>
                </div>
              );
            })}
            <div className="absolute top-3" style={{ left: champX + 16, width: CHAMP_W - 16 }}>
              <div className="font-display text-base font-bold uppercase tracking-wider text-gold-600">Champion</div>
              <div className="text-[11px] font-medium text-slate-500">{declared ? 'Officially declared' : finalDone ? 'Final decided' : 'To be decided'}</div>
            </div>

            {/* Connectors */}
            <svg className="pointer-events-none absolute left-0 top-0" width={layout.width} height={layout.height} aria-hidden>
              {paths
                .sort((x, y) => (x.state === 'idle' ? -1 : 1) - (y.state === 'idle' ? -1 : 1))
                .map((p, i) => (
                  <path
                    key={i}
                    d={p.d}
                    fill="none"
                    strokeLinecap="round"
                    stroke={p.state === 'hover' ? '#e99b15' : p.state === 'advanced' ? '#05966c' : '#cbd5e1'}
                    strokeWidth={p.state === 'idle' ? 1.5 : 2.5}
                  />
                ))}
              {champPath && (
                <path d={champPath} fill="none" stroke={finalDone ? '#e99b15' : '#cbd5e1'} strokeWidth={finalDone ? 3 : 1.5} strokeDasharray={finalDone ? undefined : '4 4'} />
              )}
            </svg>

            {/* Matches */}
            {matches.map((m) => {
              const p = layout.pos.get(`${m.round}:${m.position}`);
              if (!p) return null;
              return (
                <MatchCard
                  key={m.id}
                  match={m}
                  a={m.participant_a ? participantsById.get(m.participant_a) : undefined}
                  b={m.participant_b ? participantsById.get(m.participant_b) : undefined}
                  venueName={m.venue_id ? venuesById.get(m.venue_id)?.name : undefined}
                  feederA={feederLabel(m, 'a')}
                  feederB={feederLabel(m, 'b')}
                  highlightId={hover}
                  onHover={setHover}
                  onClick={() => onSelect?.(m)}
                  style={{ left: p.x, top: p.y }}
                />
              );
            })}

            {/* Champion */}
            {finalPos && (
              <div className="absolute" style={{ left: champX + 16, top: Math.max(HEADER_H - 4, finalPos.y + CARD_H / 2 - 100), width: CHAMP_W - 24 }}>
                <ChampionCard champion={champion} declared={declared} declaredAt={category.champion_declared_at} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
        <Legend />
        <span className="hidden items-center gap-1 text-[11px] text-slate-400 md:flex">
          <Expand className="h-3 w-3" /> Drag to pan · Ctrl + scroll to zoom · click a match for details
        </span>
      </div>
    </div>
  );
}

export function ChampionCard({
  champion,
  declared,
  declaredAt,
  large,
}: {
  champion?: Participant;
  declared: boolean;
  declaredAt?: string | null;
  large?: boolean;
}) {
  if (!champion) {
    return (
      <div className={cx('flex flex-col items-center rounded-3xl border-2 border-dashed border-gold-300 bg-white/70 p-5 text-center', large && 'p-8')}>
        <Trophy className={cx('text-gold-300', large ? 'h-14 w-14' : 'h-10 w-10')} strokeWidth={1.5} />
        <div className="mt-2 font-display text-sm font-semibold uppercase tracking-widest text-gold-600">Champion</div>
        <div className="mt-1 text-xs text-slate-400">Decided by the final</div>
      </div>
    );
  }
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-pitch-900 p-5 text-center text-white shadow-lift ring-2 ring-gold-400',
        large && 'p-8',
      )}
    >
      <div className="trophy-glow absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2" />
      <div className="relative">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 text-navy-950 shadow-lg">
          <Crown className="h-7 w-7" />
        </div>
        <div className="mt-3 eyebrow text-gold-300">{declared ? 'Official champion' : 'Champion'}</div>
        <div className={cx('mt-1 font-display font-bold uppercase leading-tight', large ? 'text-3xl' : 'text-xl')}>{champion.name}</div>
        {(champion.club || champion.player2) && (
          <div className="mt-1 text-xs text-navy-200">{champion.player2 ? `${champion.player1} & ${champion.player2}` : champion.club}</div>
        )}
        <div className="mt-2 text-[11px] text-navy-300">
          {declared ? `Declared ${formatDate(declaredAt)}` : 'Awaiting official declaration'}
        </div>
      </div>
    </div>
  );
}
