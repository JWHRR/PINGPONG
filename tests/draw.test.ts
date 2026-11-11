import { describe, expect, it } from 'vitest';
import { generateDraw, matchNumber, roundName, seedOrder } from '@/lib/draw';

const people = (n: number, seeded = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${String(i).padStart(3, '0')}`,
    name: `Player ${i}`,
    seed: i < seeded ? i + 1 : null,
  }));

describe('seed order', () => {
  it('produces the standard order', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(() => seedOrder(6)).toThrow();
  });
  it('names rounds and numbers matches', () => {
    expect(roundName(1, 4)).toBe('Round of 16');
    expect(roundName(2, 4)).toBe('Quarterfinals');
    expect(roundName(3, 4)).toBe('Semifinals');
    expect(roundName(4, 4)).toBe('Final');
    expect(matchNumber(1, 0, 16)).toBe(1);
    expect(matchNumber(2, 0, 16)).toBe(9);
    expect(matchNumber(4, 0, 16)).toBe(15);
  });
});

describe('generateDraw', () => {
  for (let n = 2; n <= 70; n++) {
    it(`builds a valid bracket for ${n} participants`, () => {
      const plan = generateDraw(people(n, Math.min(4, n)), `seed-${n}`);
      expect(plan.size).toBeGreaterThanOrEqual(n);
      expect(plan.size / 2).toBeLessThan(n);
      expect(plan.byes).toBe(plan.size - n);
      expect(plan.matches.length).toBe(plan.size - 1);
      const r1 = plan.matches.filter((m) => m.round === 1);
      const ids = r1.flatMap((m) => [m.participant_a, m.participant_b]).filter(Boolean);
      expect(ids.length).toBe(n);
      expect(new Set(ids).size).toBe(n);
      for (const m of r1) {
        expect(m.participant_a || m.participant_b).toBeTruthy(); // never BYE vs BYE
        if (m.bye) expect(m.winner_id).toBe(m.participant_a ?? m.participant_b);
      }
      expect(r1.filter((m) => m.bye).length).toBe(plan.byes);
      const r2 = plan.matches
        .filter((m) => m.round === 2)
        .flatMap((m) => [m.participant_a, m.participant_b])
        .filter(Boolean);
      expect(new Set(r2).size).toBe(r2.length);
      if (plan.size >= 4) {
        const half = plan.size / 4;
        const top = r1.filter((m) => m.bye && m.position < half).length;
        const bottom = r1.filter((m) => m.bye && m.position >= half).length;
        expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
      }
    });
  }
  it('gives byes to top seeds and splits seeds 1 and 2 into opposite halves', () => {
    const plan = generateDraw(people(13, 4), 'x');
    const r1 = plan.matches.filter((m) => m.round === 1);
    const byeWinners = r1.filter((m) => m.bye).map((m) => m.winner_id);
    expect(byeWinners).toEqual(expect.arrayContaining(['p000', 'p001', 'p002']));
    expect(r1[0].participant_a).toBe('p000');
    expect(r1[r1.length / 2].participant_a).toBe('p001');
  });
  it('is reproducible from the stored seed and differs with another seed', () => {
    const a = generateDraw(people(16), 'abc', 't');
    const b = generateDraw(people(16), 'abc', 't');
    const c = generateDraw(people(16), 'abd', 't');
    expect(a).toEqual(b);
    expect(a.original.slots).not.toEqual(c.original.slots);
  });
  it('rejects duplicates and too few players', () => {
    expect(() => generateDraw(people(1), 's')).toThrow();
    const dup = people(3);
    dup[2].id = dup[0].id;
    expect(() => generateDraw(dup, 's')).toThrow(/Duplicate/);
  });
});
