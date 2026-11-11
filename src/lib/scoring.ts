import type { Game, Slot, Sport } from './types';

/** Best of 3 games: first to win 2 games wins the match. */
export const GAMES_TO_WIN = 2;
export const MAX_GAMES = 3;

export const SCORING_RULES: Record<Sport, { points: number; cap: number | null; text: string }> = {
  table_tennis: {
    points: 11,
    cap: null,
    text: 'Games to 11 points, win by 2 (deuce has no cap). Best of 3 games.',
  },
  badminton: {
    points: 21,
    cap: 30,
    text: 'Games to 21 points, win by 2, capped at 30 (30–29 wins). Best of 3 games.',
  },
};

const isScore = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;

/** Returns an error message if `g` is not a valid *finished* game, otherwise null. */
export function validateGame(sport: Sport, g: Game, index = 0): string | null {
  const label = `Game ${index + 1}`;
  if (!g || !isScore(g.a) || !isScore(g.b)) return `${label}: scores must be whole numbers between 0 and 99`;
  const { points, cap } = SCORING_RULES[sport];
  const w = Math.max(g.a, g.b);
  const l = Math.min(g.a, g.b);
  if (w === l) return `${label}: a game cannot end in a tie (${g.a}–${g.b})`;
  if (w < points) return `${label}: the winner needs at least ${points} points (${g.a}–${g.b})`;
  if (cap !== null && w > cap) return `${label}: maximum score is ${cap} (${g.a}–${g.b})`;
  if (w === points) {
    if (l > points - 2) return `${label}: must win by 2 points (${g.a}–${g.b})`;
    return null;
  }
  // Extended game (deuce)
  if (w - l === 2) return null;
  if (cap !== null && w === cap && l === cap - 1) return null;
  return `${label}: after deuce a game is won by exactly 2 points (${g.a}–${g.b})`;
}

export function gameWinner(g: Game): Slot | null {
  if (g.a > g.b) return 'a';
  if (g.b > g.a) return 'b';
  return null;
}

export function countGames(games: Game[]): { a: number; b: number } {
  const res = { a: 0, b: 0 };
  for (const g of games) {
    const w = gameWinner(g);
    if (w) res[w] += 1;
  }
  return res;
}

export interface ResultValidation {
  ok: boolean;
  errors: string[];
  winner: Slot | null;
  gamesWon: { a: number; b: number };
}

/** Validate a complete match result (used before a winner may advance). */
export function validateMatchResult(sport: Sport, games: unknown): ResultValidation {
  const errors: string[] = [];
  if (!Array.isArray(games)) {
    return { ok: false, errors: ['Games must be a list of game scores'], winner: null, gamesWon: { a: 0, b: 0 } };
  }
  const list = games as Game[];
  if (list.length < GAMES_TO_WIN) errors.push(`A best-of-3 match needs at least ${GAMES_TO_WIN} games`);
  if (list.length > MAX_GAMES) errors.push(`A best-of-3 match has at most ${MAX_GAMES} games`);

  const won = { a: 0, b: 0 };
  list.forEach((g, i) => {
    if (won.a >= GAMES_TO_WIN || won.b >= GAMES_TO_WIN) {
      errors.push(`Game ${i + 1}: the match was already decided after game ${i}`);
      return;
    }
    const err = validateGame(sport, g, i);
    if (err) {
      errors.push(err);
      return;
    }
    won[gameWinner(g)!] += 1;
  });

  let winner: Slot | null = null;
  if (won.a === GAMES_TO_WIN) winner = 'a';
  else if (won.b === GAMES_TO_WIN) winner = 'b';
  if (!errors.length && !winner) errors.push('No player has won 2 games yet — the match is not finished');
  return { ok: errors.length === 0, errors, winner: errors.length ? null : winner, gamesWon: won };
}

/** Validate a live (possibly unfinished) score. Every game except the last must be finished. */
export function validateLiveScore(sport: Sport, games: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(games)) return { ok: false, errors: ['Games must be a list of game scores'] };
  const list = games as Game[];
  if (list.length > MAX_GAMES) errors.push(`A best-of-3 match has at most ${MAX_GAMES} games`);
  const won = { a: 0, b: 0 };
  list.forEach((g, i) => {
    if (!g || !isScore(g.a) || !isScore(g.b)) {
      errors.push(`Game ${i + 1}: scores must be whole numbers between 0 and 99`);
      return;
    }
    if (won.a >= GAMES_TO_WIN || won.b >= GAMES_TO_WIN) {
      errors.push(`Game ${i + 1}: the match was already decided — confirm the result instead`);
      return;
    }
    const isLast = i === list.length - 1;
    const err = validateGame(sport, g, i);
    if (!isLast && err) {
      errors.push(err);
      return;
    }
    if (!err) won[gameWinner(g)!] += 1;
  });
  return { ok: errors.length === 0, errors };
}

export function formatGames(games: Game[], flip = false): string {
  return games.map((g) => (flip ? `${g.b}-${g.a}` : `${g.a}-${g.b}`)).join(', ');
}
