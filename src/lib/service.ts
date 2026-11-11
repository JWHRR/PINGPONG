/**
 * Tournament service layer — all organizer operations with validation.
 * Works against any `Repo` (Supabase in production, in-memory in tests).
 */
import { generateDraw } from './draw';
import { BracketState, ConflictError, hasResult, idleStatus, isActive } from './engine';
import { validateLiveScore, validateMatchResult } from './scoring';
import type {
  Category,
  CategoryStatus,
  Discipline,
  Draw,
  Game,
  Match,
  Participant,
  Settings,
  Sport,
  Venue,
} from './types';

export type Table = 'settings' | 'categories' | 'participants' | 'venues' | 'draws' | 'matches' | 'audit_log';

export interface Repo {
  list<T>(table: Table, filter?: Record<string, string | number | boolean | null>): Promise<T[]>;
  get<T>(table: Table, id: string | number): Promise<T | null>;
  insert<T>(table: Table, rows: Record<string, unknown>[]): Promise<T[]>;
  update<T>(table: Table, id: string | number, patch: Record<string, unknown>): Promise<T>;
  remove(table: Table, id: string | number): Promise<void>;
}

export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

const bad = (msg: string, code?: string) => new ServiceError(400, msg, code);
const notFound = (what: string) => new ServiceError(404, `${what} not found`);

export interface Ctx {
  repo: Repo;
  userId: string | null;
  now?: () => string;
  randomSeed?: () => string;
}

const nowOf = (ctx: Ctx) => (ctx.now ? ctx.now() : new Date().toISOString());

function randomSeed(ctx: Ctx): string {
  if (ctx.randomSeed) return ctx.randomSeed();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function audit(ctx: Ctx, action: string, categoryId: string | null, details: Record<string, unknown>) {
  await ctx.repo.insert('audit_log', [{ action, category_id: categoryId, details, user_id: ctx.userId, at: nowOf(ctx) }]);
}

const str = (v: unknown, field: string, { required = true, max = 120 } = {}): string | null => {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    if (required) throw bad(`${field} is required`);
    return null;
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  const t = v.trim();
  if (t.length > max) throw bad(`${field} must be at most ${max} characters`);
  return t;
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function updateSettings(ctx: Ctx, input: Partial<Settings>) {
  const patch: Record<string, unknown> = {};
  const textFields: (keyof Settings)[] = [
    'tournament_name',
    'tagline',
    'table_tennis_title',
    'badminton_title',
    'location',
    'description',
    'organizer',
  ];
  for (const f of textFields) {
    if (f in input) {
      const required = ['tournament_name', 'table_tennis_title', 'badminton_title'].includes(f);
      patch[f] = str(input[f], f, { required, max: f === 'description' ? 2000 : 160 }) ?? '';
    }
  }
  for (const f of ['start_date', 'end_date'] as const) {
    if (f in input) {
      const v = input[f];
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`${f} must be a date (YYYY-MM-DD)`);
      patch[f] = v || null;
    }
  }
  const start = (patch.start_date ?? input.start_date) as string | null | undefined;
  const end = (patch.end_date ?? input.end_date) as string | null | undefined;
  if (start && end && end < start) throw bad('End date cannot be before the start date');
  const s = await ctx.repo.update<Settings>('settings', 1, patch);
  await audit(ctx, 'settings.update', null, patch);
  return s;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const SPORTS: Sport[] = ['table_tennis', 'badminton'];
const DISCIPLINES: Discipline[] = ['singles', 'doubles'];

export async function createCategory(ctx: Ctx, input: Partial<Category>) {
  if (!SPORTS.includes(input.sport as Sport)) throw bad('Sport must be table_tennis or badminton');
  if (!DISCIPLINES.includes(input.discipline as Discipline)) throw bad('Discipline must be singles or doubles');
  if (input.sport === 'table_tennis' && input.discipline === 'doubles') {
    // Allowed, but keep it explicit — some events run TT doubles too.
  }
  const level = str(input.level, 'Level', { max: 60 })!;
  const existing = await ctx.repo.list<Category>('categories', { sport: input.sport!, discipline: input.discipline! });
  if (existing.some((c) => c.level.toLowerCase() === level.toLowerCase())) {
    throw bad('A category with this sport, discipline and level already exists');
  }
  const name = str(input.name, 'Name', { required: false, max: 120 }) ??
    `${input.sport === 'table_tennis' ? 'Table Tennis' : 'Badminton'} ${input.discipline === 'singles' ? 'Singles' : 'Doubles'} — ${level}`;
  const [c] = await ctx.repo.insert<Category>('categories', [
    {
      sport: input.sport,
      discipline: input.discipline,
      level,
      name,
      sort_order: Number.isInteger(input.sort_order) ? input.sort_order : 0,
      status: 'registration',
      champion_id: null,
      champion_declared_at: null,
    },
  ]);
  await audit(ctx, 'category.create', c.id, { name });
  return c;
}

export async function updateCategory(ctx: Ctx, id: string, input: Partial<Category>) {
  const c = await ctx.repo.get<Category>('categories', id);
  if (!c) throw notFound('Category');
  const patch: Record<string, unknown> = {};
  if ('name' in input) patch.name = str(input.name, 'Name');
  if ('level' in input) patch.level = str(input.level, 'Level', { max: 60 });
  if ('sort_order' in input) {
    if (!Number.isInteger(input.sort_order)) throw bad('Sort order must be a whole number');
    patch.sort_order = input.sort_order;
  }
  if (('sport' in input && input.sport !== c.sport) || ('discipline' in input && input.discipline !== c.discipline)) {
    const parts = await ctx.repo.list<Participant>('participants', { category_id: id });
    if (parts.length) throw bad('Sport/discipline cannot change once participants are registered');
    if (!SPORTS.includes(input.sport ?? c.sport)) throw bad('Invalid sport');
    if (!DISCIPLINES.includes(input.discipline ?? c.discipline)) throw bad('Invalid discipline');
    patch.sport = input.sport ?? c.sport;
    patch.discipline = input.discipline ?? c.discipline;
  }
  const updated = await ctx.repo.update<Category>('categories', id, patch);
  await audit(ctx, 'category.update', id, patch);
  return updated;
}

export async function deleteCategory(ctx: Ctx, id: string) {
  const c = await ctx.repo.get<Category>('categories', id);
  if (!c) throw notFound('Category');
  const parts = await ctx.repo.list<Participant>('participants', { category_id: id });
  if (parts.length) throw bad('Remove all participants from this category before deleting it');
  const draws = await ctx.repo.list<Draw>('draws', { category_id: id });
  for (const d of draws) await deleteDrawRows(ctx, d.id);
  await ctx.repo.remove('categories', id);
  await audit(ctx, 'category.delete', null, { id, name: c.name });
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------
async function activeDrawFor(ctx: Ctx, categoryId: string): Promise<Draw[]> {
  const draws = await ctx.repo.list<Draw>('draws', { category_id: categoryId });
  return draws.filter((d) => d.status === 'preview' || d.status === 'published');
}

async function participantInActiveDraw(ctx: Ctx, p: Participant): Promise<boolean> {
  for (const d of await activeDrawFor(ctx, p.category_id)) {
    if (d.original_draw.slots.some((s) => s.participant_id === p.id)) return true;
  }
  return false;
}

async function checkParticipantFields(ctx: Ctx, input: Partial<Participant>, category: Category, selfId?: string) {
  const player1 = str(input.player1, 'Player name', { max: 80 })!;
  let player2: string | null = null;
  if (category.discipline === 'doubles') {
    player2 = str(input.player2, 'Partner name (doubles)', { max: 80 });
    if (player2!.toLowerCase() === player1.toLowerCase()) throw bad('A doubles pair needs two different players');
  }
  const name =
    str(input.name, 'Display name', { required: false, max: 120 }) ??
    (category.discipline === 'doubles' ? `${player1} / ${player2}` : player1);
  let seed: number | null = null;
  if (input.seed !== undefined && input.seed !== null && (input.seed as unknown) !== '') {
    const n = Number(input.seed);
    if (!Number.isInteger(n) || n < 1 || n > 64) throw bad('Seed must be a whole number between 1 and 64');
    seed = n;
  }
  const others = (await ctx.repo.list<Participant>('participants', { category_id: category.id })).filter(
    (p) => p.id !== selfId,
  );
  if (others.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) {
    throw bad(`"${name}" is already registered in ${category.name}`);
  }
  const people = (p: Pick<Participant, 'player1' | 'player2'>) =>
    [p.player1, p.player2].filter(Boolean).map((x) => x!.trim().toLowerCase());
  const mine = people({ player1, player2 });
  for (const o of others) {
    const clash = people(o).find((x) => mine.includes(x));
    if (clash) throw bad(`Player "${clash}" is already entered in ${category.name} (${o.name})`);
  }
  if (seed !== null && others.some((p) => p.seed === seed)) throw bad(`Seed ${seed} is already used in this category`);
  return {
    name,
    player1,
    player2,
    club: str(input.club, 'Club', { required: false, max: 80 }),
    seed,
    notes: str(input.notes, 'Notes', { required: false, max: 500 }),
  };
}

export async function createParticipant(ctx: Ctx, input: Partial<Participant>) {
  if (!input.category_id) throw bad('Category is required');
  const category = await ctx.repo.get<Category>('categories', input.category_id);
  if (!category) throw notFound('Category');
  if (category.status === 'completed') throw bad('This category is completed; registration is closed');
  const fields = await checkParticipantFields(ctx, input, category);
  const [p] = await ctx.repo.insert<Participant>('participants', [{ ...fields, category_id: category.id }]);
  await audit(ctx, 'participant.create', category.id, { id: p.id, name: p.name });
  return p;
}

export async function updateParticipant(ctx: Ctx, id: string, input: Partial<Participant>) {
  const p = await ctx.repo.get<Participant>('participants', id);
  if (!p) throw notFound('Participant');
  const targetCategoryId = input.category_id ?? p.category_id;
  const category = await ctx.repo.get<Category>('categories', targetCategoryId);
  if (!category) throw notFound('Category');
  const inDraw = await participantInActiveDraw(ctx, p);
  if (targetCategoryId !== p.category_id && inDraw) {
    throw bad('This participant is part of a generated draw; they cannot change category. Regenerate the draw after removing them.');
  }
  if (inDraw && input.seed !== undefined && (input.seed ?? null) !== p.seed) {
    throw bad('Seeding cannot change after the draw is generated. Regenerate the draw to apply new seeds.');
  }
  const fields = await checkParticipantFields(ctx, { ...p, ...input }, category, id);
  const updated = await ctx.repo.update<Participant>('participants', id, { ...fields, category_id: targetCategoryId });
  await audit(ctx, 'participant.update', targetCategoryId, { id, ...fields });
  return updated;
}

export async function deleteParticipant(ctx: Ctx, id: string) {
  const p = await ctx.repo.get<Participant>('participants', id);
  if (!p) throw notFound('Participant');
  if (await participantInActiveDraw(ctx, p)) {
    throw bad(
      'This participant is in the current draw. Discard the preview (or regenerate the draw without them) before removing them.',
    );
  }
  await ctx.repo.remove('participants', id);
  await audit(ctx, 'participant.delete', p.category_id, { id, name: p.name });
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------
export async function createVenue(ctx: Ctx, input: Partial<Venue>) {
  const name = str(input.name, 'Name', { max: 60 })!;
  const sport = input.sport ?? 'any';
  if (!['table_tennis', 'badminton', 'any'].includes(sport)) throw bad('Invalid sport');
  const all = await ctx.repo.list<Venue>('venues');
  if (all.some((v) => v.name.toLowerCase() === name.toLowerCase())) throw bad('A court/table with this name exists');
  const [v] = await ctx.repo.insert<Venue>('venues', [{ name, sport, active: input.active ?? true }]);
  await audit(ctx, 'venue.create', null, { name });
  return v;
}

export async function updateVenue(ctx: Ctx, id: string, input: Partial<Venue>) {
  const v = await ctx.repo.get<Venue>('venues', id);
  if (!v) throw notFound('Court/table');
  const patch: Record<string, unknown> = {};
  if ('name' in input) {
    patch.name = str(input.name, 'Name', { max: 60 });
    const all = await ctx.repo.list<Venue>('venues');
    if (all.some((o) => o.id !== id && o.name.toLowerCase() === String(patch.name).toLowerCase())) {
      throw bad('A court/table with this name exists');
    }
  }
  if ('sport' in input) {
    if (!['table_tennis', 'badminton', 'any'].includes(input.sport as string)) throw bad('Invalid sport');
    patch.sport = input.sport;
  }
  if ('active' in input) patch.active = !!input.active;
  const updated = await ctx.repo.update<Venue>('venues', id, patch);
  await audit(ctx, 'venue.update', null, { id, ...patch });
  return updated;
}

export async function deleteVenue(ctx: Ctx, id: string) {
  const v = await ctx.repo.get<Venue>('venues', id);
  if (!v) throw notFound('Court/table');
  const used = (await ctx.repo.list<Match>('matches', { venue_id: id })).filter((m) => !hasResult(m) && m.status !== 'bye');
  if (used.length) throw bad(`${v.name} is assigned to ${used.length} upcoming match(es). Reassign them first.`);
  await ctx.repo.remove('venues', id);
  await audit(ctx, 'venue.delete', null, { id, name: v.name });
}

// ---------------------------------------------------------------------------
// Draws
// ---------------------------------------------------------------------------
async function deleteDrawRows(ctx: Ctx, drawId: string) {
  const ms = await ctx.repo.list<Match>('matches', { draw_id: drawId });
  for (const m of ms) await ctx.repo.remove('matches', m.id);
  await ctx.repo.remove('draws', drawId);
}

async function setCategoryStatus(ctx: Ctx, id: string, status: CategoryStatus, extra: Record<string, unknown> = {}) {
  await ctx.repo.update('categories', id, { status, ...extra });
}

/**
 * Generate a draw PREVIEW for a category. If a draw is already published, the
 * organizer must type the category name as confirmation (prevents accidents).
 */
export async function generateDrawPreview(ctx: Ctx, categoryId: string, confirmText?: string) {
  const category = await ctx.repo.get<Category>('categories', categoryId);
  if (!category) throw notFound('Category');
  const draws = await ctx.repo.list<Draw>('draws', { category_id: categoryId });
  const published = draws.find((d) => d.status === 'published');
  if (published && (confirmText ?? '').trim() !== category.name.trim()) {
    throw new ServiceError(
      409,
      `A draw is already published for ${category.name}. Type the category name exactly to confirm regeneration.`,
      'CONFIRM_REQUIRED',
    );
  }
  const participants = await ctx.repo.list<Participant>('participants', { category_id: categoryId });
  if (participants.length < 2) throw bad('At least 2 registered participants are needed to generate a draw');
  if (participants.length > 128) throw bad('Draws are limited to 128 participants per category');

  const rngSeed = randomSeed(ctx);
  const plan = generateDraw(participants, rngSeed, nowOf(ctx));

  const preview = draws.find((d) => d.status === 'preview');
  if (preview) await deleteDrawRows(ctx, preview.id);

  const version = draws.reduce((mx, d) => Math.max(mx, d.version), 0) + 1;
  const [draw] = await ctx.repo.insert<Draw>('draws', [
    {
      category_id: categoryId,
      version,
      status: 'preview',
      bracket_size: plan.size,
      rounds: plan.rounds,
      participant_count: participants.length,
      rng_seed: rngSeed,
      original_draw: plan.original,
      created_by: ctx.userId,
      created_at: nowOf(ctx),
      published_at: null,
      published_by: null,
      superseded_at: null,
    },
  ]);
  const ts = nowOf(ctx);
  await ctx.repo.insert<Match>(
    'matches',
    plan.matches.map((m) => ({
      ...m,
      draw_id: draw.id,
      category_id: categoryId,
      games: [],
      completed_at: m.status === 'bye' ? ts : null,
      validated_at: m.status === 'bye' ? ts : null,
    })),
  );
  if (!published) await setCategoryStatus(ctx, categoryId, 'draw_preview');
  await audit(ctx, 'draw.generate', categoryId, {
    draw_id: draw.id,
    version,
    rng_seed: rngSeed,
    size: plan.size,
    byes: plan.byes,
    replaces_published: published?.id ?? null,
  });
  return draw;
}

export async function discardDrawPreview(ctx: Ctx, drawId: string) {
  const draw = await ctx.repo.get<Draw>('draws', drawId);
  if (!draw) throw notFound('Draw');
  if (draw.status !== 'preview') throw bad('Only an unpublished preview can be discarded');
  await deleteDrawRows(ctx, drawId);
  const remaining = await ctx.repo.list<Draw>('draws', { category_id: draw.category_id });
  if (!remaining.some((d) => d.status === 'published')) await setCategoryStatus(ctx, draw.category_id, 'registration');
  await audit(ctx, 'draw.discard', draw.category_id, { draw_id: drawId, version: draw.version });
}

export async function publishDraw(ctx: Ctx, drawId: string, confirmReplace = false) {
  const draw = await ctx.repo.get<Draw>('draws', drawId);
  if (!draw) throw notFound('Draw');
  if (draw.status !== 'preview') throw bad('This draw is not a preview');
  const participants = await ctx.repo.list<Participant>('participants', { category_id: draw.category_id });
  const ids = new Set(participants.map((p) => p.id));
  const drawn = draw.original_draw.slots.filter((s) => s.participant_id);
  if (drawn.some((s) => !ids.has(s.participant_id!)) || drawn.length !== participants.length) {
    throw bad('Registrations changed since this preview was generated. Regenerate the preview before publishing.');
  }
  const draws = await ctx.repo.list<Draw>('draws', { category_id: draw.category_id });
  const published = draws.find((d) => d.status === 'published');
  if (published) {
    if (!confirmReplace) {
      throw new ServiceError(409, 'Publishing will replace the currently published draw and its results.', 'CONFIRM_REQUIRED');
    }
    await ctx.repo.update('draws', published.id, { status: 'superseded', superseded_at: nowOf(ctx) });
  }
  const updated = await ctx.repo.update<Draw>('draws', drawId, {
    status: 'published',
    published_at: nowOf(ctx),
    published_by: ctx.userId,
  });
  await setCategoryStatus(ctx, draw.category_id, 'in_progress', { champion_id: null, champion_declared_at: null });
  await audit(ctx, 'draw.publish', draw.category_id, { draw_id: drawId, version: draw.version, replaced: published?.id ?? null });
  return updated;
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
async function loadMatchContext(ctx: Ctx, matchId: string) {
  const match = await ctx.repo.get<Match>('matches', matchId);
  if (!match) throw notFound('Match');
  const draw = await ctx.repo.get<Draw>('draws', match.draw_id);
  if (!draw) throw notFound('Draw');
  const category = await ctx.repo.get<Category>('categories', match.category_id);
  if (!category) throw notFound('Category');
  return { match, draw, category };
}

function requireEditable(draw: Draw, category: Category) {
  if (draw.status !== 'published') throw bad('Results can only be entered on a published draw');
  if (category.status === 'completed') {
    throw bad('The champion has been declared and results are locked. Re-open the category to make changes.');
  }
}

async function persist(ctx: Ctx, state: BracketState) {
  // Write cleared slots before filled ones so the "one appearance per round" rule never trips.
  const changes = state.changes().sort((x, y) => x.round - y.round);
  for (const m of changes) {
    const { id, ...rest } = m;
    await ctx.repo.update('matches', id, {
      participant_a: rest.participant_a,
      participant_b: rest.participant_b,
      status: rest.status,
      games: rest.games,
      winner_id: rest.winner_id,
      started_at: rest.started_at,
      completed_at: rest.completed_at,
      validated_at: rest.validated_at,
      validated_by: rest.validated_by,
      notes: rest.notes,
    });
  }
  return changes;
}

async function bracketFor(ctx: Ctx, draw: Draw) {
  const matches = await ctx.repo.list<Match>('matches', { draw_id: draw.id });
  return new BracketState(matches, draw.rounds);
}

export async function scheduleMatch(
  ctx: Ctx,
  matchId: string,
  input: { scheduled_at?: string | null; venue_id?: string | null },
) {
  const { match, draw } = await loadMatchContext(ctx, matchId);
  if (draw.status === 'superseded') throw bad('This draw was superseded');
  if (match.status === 'bye') throw bad('BYE matches are not played');
  let scheduledAt: string | null = match.scheduled_at;
  if ('scheduled_at' in input) {
    if (input.scheduled_at) {
      const d = new Date(input.scheduled_at);
      if (Number.isNaN(d.getTime())) throw bad('Invalid date/time');
      scheduledAt = d.toISOString();
    } else scheduledAt = null;
  }
  let venueId: string | null = match.venue_id;
  if ('venue_id' in input) {
    venueId = input.venue_id || null;
    if (venueId) {
      const venue = await ctx.repo.get<Venue>('venues', venueId);
      if (!venue) throw notFound('Court/table');
      if (!venue.active) throw bad(`${venue.name} is inactive`);
    }
  }
  if (venueId && scheduledAt) {
    const clash = (await ctx.repo.list<Match>('matches', { venue_id: venueId })).find(
      (m) =>
        m.id !== matchId &&
        m.scheduled_at &&
        new Date(m.scheduled_at).getTime() === new Date(scheduledAt!).getTime() &&
        !hasResult(m) &&
        m.status !== 'bye',
    );
    if (clash) throw bad(`That court/table already hosts match M${clash.number} at this time`);
  }
  const patch: Record<string, unknown> = { scheduled_at: scheduledAt, venue_id: venueId };
  if (match.status === 'pending' || match.status === 'scheduled') patch.status = scheduledAt ? 'scheduled' : 'pending';
  const updated = await ctx.repo.update<Match>('matches', matchId, patch);
  await audit(ctx, 'match.schedule', match.category_id, { match: match.number, ...patch });
  return updated;
}

function requirePlayers(match: Match) {
  if (match.status === 'bye') throw bad('BYE matches have no score');
  if (!match.participant_a || !match.participant_b) {
    throw bad('Both participants must be known before this match can be played');
  }
}

/** Save a live (in progress) score. Does not advance anyone. */
export async function saveLiveScore(ctx: Ctx, matchId: string, games: Game[]) {
  const { match, draw, category } = await loadMatchContext(ctx, matchId);
  requireEditable(draw, category);
  requirePlayers(match);
  if (hasResult(match)) throw bad('This match already has a confirmed result. Use "Correct result" instead.');
  const v = validateLiveScore(category.sport, games);
  if (!v.ok) throw bad(v.errors.join('; '), 'INVALID_SCORE');
  const updated = await ctx.repo.update<Match>('matches', matchId, {
    games,
    status: 'in_progress',
    started_at: match.started_at ?? nowOf(ctx),
  });
  await audit(ctx, 'match.live', match.category_id, { match: match.number, games });
  return updated;
}

/** Validate and confirm a final result; the winner advances to the next round. */
export async function confirmResult(ctx: Ctx, matchId: string, games: Game[], cascade = false) {
  const { match, draw, category } = await loadMatchContext(ctx, matchId);
  requireEditable(draw, category);
  requirePlayers(match);
  const v = validateMatchResult(category.sport, games);
  if (!v.ok) throw bad(v.errors.join('; '), 'INVALID_SCORE');
  const winnerId = v.winner === 'a' ? match.participant_a! : match.participant_b!;
  const state = await bracketFor(ctx, draw);
  const m = state.get(matchId);
  const wasCorrection = hasResult(m);
  const ts = nowOf(ctx);
  try {
    state.applyResult(
      m,
      winnerId,
      {
        games,
        status: 'completed',
        started_at: m.started_at ?? ts,
        completed_at: ts,
        validated_at: ts,
        validated_by: ctx.userId,
        notes: null,
      },
      cascade,
    );
  } catch (e) {
    if (e instanceof ConflictError) throw new ServiceError(409, e.message, e.code);
    throw e;
  }
  const changed = await persist(ctx, state);
  await audit(ctx, wasCorrection ? 'match.correct' : 'match.confirm', match.category_id, {
    match: match.number,
    games,
    winner_id: winnerId,
    previous_winner_id: match.winner_id,
    previous_games: match.games,
    affected_matches: changed.map((c) => c.number),
  });
  return { match: state.get(matchId), changed };
}

/** Award a walkover (opponent absent / retired before play). */
export async function awardWalkover(ctx: Ctx, matchId: string, winnerId: string, reason: string | undefined, cascade = false) {
  const { match, draw, category } = await loadMatchContext(ctx, matchId);
  requireEditable(draw, category);
  requirePlayers(match);
  if (winnerId !== match.participant_a && winnerId !== match.participant_b) {
    throw bad('The walkover winner must be one of the two participants');
  }
  const state = await bracketFor(ctx, draw);
  const m = state.get(matchId);
  const ts = nowOf(ctx);
  try {
    state.applyResult(
      m,
      winnerId,
      {
        games: [],
        status: 'walkover',
        completed_at: ts,
        validated_at: ts,
        validated_by: ctx.userId,
        notes: str(reason, 'Reason', { required: false, max: 200 }) ?? 'Walkover',
      },
      cascade,
    );
  } catch (e) {
    if (e instanceof ConflictError) throw new ServiceError(409, e.message, e.code);
    throw e;
  }
  const changed = await persist(ctx, state);
  await audit(ctx, 'match.walkover', match.category_id, {
    match: match.number,
    winner_id: winnerId,
    reason,
    previous_winner_id: match.winner_id,
    affected_matches: changed.map((c) => c.number),
  });
  return { match: state.get(matchId), changed };
}

/** Clear a result (or live score) entirely. */
export async function resetMatch(ctx: Ctx, matchId: string, cascade = false) {
  const { match, draw, category } = await loadMatchContext(ctx, matchId);
  requireEditable(draw, category);
  if (match.status === 'bye') throw bad('BYE matches cannot be reset');
  const state = await bracketFor(ctx, draw);
  const m = state.get(matchId);
  try {
    state.resetResult(m, cascade);
  } catch (e) {
    if (e instanceof ConflictError) throw new ServiceError(409, e.message, e.code);
    throw e;
  }
  const changed = await persist(ctx, state);
  await audit(ctx, 'match.reset', match.category_id, {
    match: match.number,
    previous_games: match.games,
    previous_winner_id: match.winner_id,
    affected_matches: changed.map((c) => c.number),
  });
  return { match: state.get(matchId), changed };
}

// ---------------------------------------------------------------------------
// Champion
// ---------------------------------------------------------------------------
export async function declareChampion(ctx: Ctx, categoryId: string) {
  const category = await ctx.repo.get<Category>('categories', categoryId);
  if (!category) throw notFound('Category');
  const draw = (await ctx.repo.list<Draw>('draws', { category_id: categoryId })).find((d) => d.status === 'published');
  if (!draw) throw bad('No published draw for this category');
  const state = await bracketFor(ctx, draw);
  const final = state.final();
  if (!final || !hasResult(final) || !final.winner_id) throw bad('The final has not been completed and validated yet');
  if (state.all().some((m) => m.status === 'in_progress')) throw bad('Some matches are still in progress');
  const updated = await ctx.repo.update<Category>('categories', categoryId, {
    champion_id: final.winner_id,
    champion_declared_at: nowOf(ctx),
    status: 'completed',
  });
  await audit(ctx, 'champion.declare', categoryId, { champion_id: final.winner_id, final_match: final.number });
  return updated;
}

export async function reopenCategory(ctx: Ctx, categoryId: string) {
  const category = await ctx.repo.get<Category>('categories', categoryId);
  if (!category) throw notFound('Category');
  if (category.status !== 'completed') throw bad('Category is not completed');
  const updated = await ctx.repo.update<Category>('categories', categoryId, {
    champion_id: null,
    champion_declared_at: null,
    status: 'in_progress',
  });
  await audit(ctx, 'champion.revoke', categoryId, { previous_champion_id: category.champion_id });
  return updated;
}

export { isActive, idleStatus };
