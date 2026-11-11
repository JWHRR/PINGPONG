import type { OriginalDraw, Participant } from './types';

export const DRAW_ALGORITHM = 'single-elimination/standard-seed-order/v1';

/** Deterministic PRNG (mulberry32) so a stored seed reproduces the draw exactly. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard bracket seed order: index = bracket position, value = seed number (1-based).
 * size 8 → [1, 8, 4, 5, 2, 7, 3, 6]. Top seeds are spread so they can only meet late,
 * and seeds above the participant count become BYEs, which then always face the
 * strongest seeds and are distributed evenly across both halves of the draw.
 */
export function seedOrder(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error('Bracket size must be a power of two ≥ 2');
  let order = [1, 2];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((s) => [s, sum - s]);
  }
  return order;
}

export function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinals';
  if (fromEnd === 2) return 'Quarterfinals';
  return `Round of ${2 ** (fromEnd + 1)}`;
}

export function shortRoundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'F';
  if (fromEnd === 1) return 'SF';
  if (fromEnd === 2) return 'QF';
  return `R${2 ** (fromEnd + 1)}`;
}

/** Sequential match number across the whole bracket (M1, M2, ...). */
export function matchNumber(round: number, position: number, size: number): number {
  let n = 0;
  let count = size / 2;
  for (let r = 1; r < round; r++) {
    n += count;
    count /= 2;
  }
  return n + position + 1;
}

export interface PlannedMatch {
  round: number;
  position: number;
  number: number;
  participant_a: string | null;
  participant_b: string | null;
  bye: boolean;
  winner_id: string | null;
  status: 'pending' | 'bye';
}

export interface DrawPlan {
  size: number;
  rounds: number;
  byes: number;
  original: OriginalDraw;
  matches: PlannedMatch[];
}

export type DrawEntrant = Pick<Participant, 'id' | 'name' | 'seed'>;

/**
 * Generate a single-elimination draw from the registered participants.
 * Seeded participants (seed 1, 2, …) take the seed positions; everyone else is
 * shuffled randomly into the remaining positions. BYEs fill the leftover positions.
 */
export function generateDraw(entrants: DrawEntrant[], rngSeed: string, generatedAt = new Date().toISOString()): DrawPlan {
  if (entrants.length < 2) throw new Error('At least 2 participants are required to generate a draw');
  const ids = new Set<string>();
  for (const p of entrants) {
    if (ids.has(p.id)) throw new Error(`Duplicate participant in draw: ${p.name}`);
    ids.add(p.id);
  }
  const seeds = new Set<number>();
  for (const p of entrants) {
    if (p.seed != null) {
      if (seeds.has(p.seed)) throw new Error(`Seed ${p.seed} is assigned to more than one participant`);
      seeds.add(p.seed);
    }
  }

  const rng = mulberry32(seedFromString(rngSeed));
  const seeded = entrants.filter((p) => p.seed != null).sort((x, y) => x.seed! - y.seed!);
  const unseeded = entrants.filter((p) => p.seed == null).sort((x, y) => x.id.localeCompare(y.id));
  for (let i = unseeded.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [unseeded[i], unseeded[j]] = [unseeded[j], unseeded[i]];
  }
  const bySeedNumber = [...seeded, ...unseeded]; // index 0 = seed number 1

  const size = nextPowerOfTwo(entrants.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const slots = order.map((seedNumber, position) => {
    const p = bySeedNumber[seedNumber - 1] ?? null;
    return {
      position,
      seed_number: seedNumber,
      participant_id: p?.id ?? null,
      name: p?.name ?? null,
      seed: p?.seed ?? null,
    };
  });

  const matches: PlannedMatch[] = [];
  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 0; position < count; position++) {
      matches.push({
        round,
        position,
        number: matchNumber(round, position, size),
        participant_a: null,
        participant_b: null,
        bye: false,
        winner_id: null,
        status: 'pending',
      });
    }
  }
  const at = (round: number, position: number) => matches.find((m) => m.round === round && m.position === position)!;

  for (let position = 0; position < size / 2; position++) {
    const m = at(1, position);
    m.participant_a = slots[position * 2].participant_id;
    m.participant_b = slots[position * 2 + 1].participant_id;
    if (!m.participant_a && !m.participant_b) throw new Error('Invalid draw: BYE against BYE');
    if (!m.participant_a || !m.participant_b) {
      m.bye = true;
      m.status = 'bye';
      m.winner_id = m.participant_a ?? m.participant_b;
      if (rounds > 1) {
        const next = at(2, Math.floor(position / 2));
        if (position % 2 === 0) next.participant_a = m.winner_id;
        else next.participant_b = m.winner_id;
      }
    }
  }

  const byes = size - entrants.length;
  return {
    size,
    rounds,
    byes,
    matches,
    original: {
      algorithm: DRAW_ALGORITHM,
      generated_at: generatedAt,
      rng_seed: rngSeed,
      bracket_size: size,
      rounds,
      participant_count: entrants.length,
      byes,
      slots,
    },
  };
}
