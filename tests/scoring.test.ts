import { describe, expect, it } from 'vitest';
import { validateGame, validateLiveScore, validateMatchResult } from '@/lib/scoring';

describe('game validation', () => {
  it('table tennis', () => {
    expect(validateGame('table_tennis', { a: 11, b: 9 })).toBeNull();
    expect(validateGame('table_tennis', { a: 3, b: 11 })).toBeNull();
    expect(validateGame('table_tennis', { a: 11, b: 10 })).toMatch(/win by 2/);
    expect(validateGame('table_tennis', { a: 12, b: 10 })).toBeNull();
    expect(validateGame('table_tennis', { a: 18, b: 16 })).toBeNull();
    expect(validateGame('table_tennis', { a: 13, b: 10 })).toMatch(/exactly 2/);
    expect(validateGame('table_tennis', { a: 10, b: 8 })).toMatch(/at least 11/);
    expect(validateGame('table_tennis', { a: 11, b: 11 })).toMatch(/tie/);
    expect(validateGame('table_tennis', { a: -1, b: 11 })).toMatch(/whole numbers/);
    expect(validateGame('table_tennis', { a: 11.5, b: 3 })).toMatch(/whole numbers/);
  });
  it('badminton', () => {
    expect(validateGame('badminton', { a: 21, b: 19 })).toBeNull();
    expect(validateGame('badminton', { a: 21, b: 20 })).toMatch(/win by 2/);
    expect(validateGame('badminton', { a: 22, b: 20 })).toBeNull();
    expect(validateGame('badminton', { a: 29, b: 27 })).toBeNull();
    expect(validateGame('badminton', { a: 30, b: 28 })).toBeNull();
    expect(validateGame('badminton', { a: 30, b: 29 })).toBeNull();
    expect(validateGame('badminton', { a: 31, b: 29 })).toMatch(/maximum/);
    expect(validateGame('badminton', { a: 11, b: 5 })).toMatch(/at least 21/);
  });
});

describe('best of 3', () => {
  it('accepts 2-0 and 2-1 results', () => {
    expect(validateMatchResult('table_tennis', [{ a: 11, b: 5 }, { a: 11, b: 7 }])).toMatchObject({ ok: true, winner: 'a' });
    expect(
      validateMatchResult('table_tennis', [{ a: 11, b: 5 }, { a: 8, b: 11 }, { a: 9, b: 11 }]),
    ).toMatchObject({ ok: true, winner: 'b', gamesWon: { a: 1, b: 2 } });
  });
  it('rejects incomplete, extra or invalid games', () => {
    expect(validateMatchResult('table_tennis', [{ a: 11, b: 5 }]).ok).toBe(false);
    expect(validateMatchResult('table_tennis', [{ a: 11, b: 5 }, { a: 5, b: 11 }]).ok).toBe(false);
    expect(
      validateMatchResult('table_tennis', [{ a: 11, b: 5 }, { a: 11, b: 5 }, { a: 5, b: 11 }]).errors.join(),
    ).toMatch(/already decided/);
    expect(validateMatchResult('badminton', [{ a: 21, b: 20 }, { a: 21, b: 5 }]).ok).toBe(false);
    expect(validateMatchResult('badminton', 'nope').ok).toBe(false);
    expect(validateMatchResult('badminton', [{ a: 21, b: 1 }, { a: 1, b: 21 }, { a: 21, b: 1 }, { a: 21, b: 1 }]).ok).toBe(false);
  });
  it('live scores allow an unfinished last game only', () => {
    expect(validateLiveScore('badminton', [{ a: 21, b: 10 }, { a: 4, b: 3 }]).ok).toBe(true);
    expect(validateLiveScore('badminton', [{ a: 20, b: 10 }, { a: 4, b: 3 }]).ok).toBe(false);
    expect(validateLiveScore('badminton', [{ a: 21, b: 10 }, { a: 21, b: 3 }, { a: 0, b: 0 }]).ok).toBe(false);
  });
});
