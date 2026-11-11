/**
 * Full organizer workflow through the same service functions the API routes call:
 * Register → Assign levels → Generate → Publish → Schedule → Scores → Advance → Final → Champion
 */
import { describe, expect, it } from 'vitest';
import * as svc from '@/lib/service';
import type { Category, Draw, Game, Match, Participant } from '@/lib/types';
import { memoryRepo } from './memory-repo';

function setup() {
  const { repo, db } = memoryRepo();
  let seedCounter = 0;
  const ctx: svc.Ctx = { repo, userId: 'admin-1', randomSeed: () => `seed-${++seedCounter}` };
  return { ctx, db, repo };
}

const ttWin: Game[] = [{ a: 11, b: 7 }, { a: 11, b: 9 }];
const ttWinB: Game[] = [{ a: 4, b: 11 }, { a: 11, b: 9 }, { a: 8, b: 11 }];

async function matchesOf(ctx: svc.Ctx, drawId: string) {
  const ms = await ctx.repo.list<Match>('matches', { draw_id: drawId });
  return ms.sort((x, y) => x.number - y.number);
}

describe('end-to-end tournament workflow', () => {
  it('runs a 13-player table tennis category from registration to champion', async () => {
    const { ctx, db } = setup();

    // Categories / levels
    const beginner = await svc.createCategory(ctx, { sport: 'table_tennis', discipline: 'singles', level: 'Beginner' });
    const advanced = await svc.createCategory(ctx, { sport: 'table_tennis', discipline: 'singles', level: 'Advanced' });
    await expect(svc.createCategory(ctx, { sport: 'table_tennis', discipline: 'singles', level: 'beginner' })).rejects.toThrow(
      /already exists/,
    );

    // Register participants (assigned to Advanced by mistake, then moved to Beginner)
    const players: Participant[] = [];
    for (let i = 1; i <= 13; i++) {
      players.push(
        await svc.createParticipant(ctx, {
          category_id: advanced.id,
          player1: `Player ${i}`,
          club: i % 2 ? 'Club A' : 'Club B',
          seed: i <= 2 ? i : null,
        }),
      );
    }
    await expect(svc.createParticipant(ctx, { category_id: advanced.id, player1: 'player 3' })).rejects.toThrow(/already/);
    for (const p of players) await svc.updateParticipant(ctx, p.id, { category_id: beginner.id });
    expect((await ctx.repo.list('participants', { category_id: beginner.id })).length).toBe(13);

    // Venues
    const t1 = await svc.createVenue(ctx, { name: 'Table 1', sport: 'table_tennis' });
    const t2 = await svc.createVenue(ctx, { name: 'Table 2', sport: 'table_tennis' });

    // Generate a preview, regenerate the preview freely, then publish
    const preview1 = await svc.generateDrawPreview(ctx, beginner.id);
    expect(preview1.status).toBe('preview');
    expect(preview1.bracket_size).toBe(16);
    const preview2 = await svc.generateDrawPreview(ctx, beginner.id);
    expect(await ctx.repo.get('draws', preview1.id)).toBeNull();
    expect(((await ctx.repo.get<Category>('categories', beginner.id)) as Category).status).toBe('draw_preview');

    // Results cannot be entered on a preview
    const pm = (await matchesOf(ctx, preview2.id)).find((m) => m.status === 'pending' && m.participant_a && m.participant_b)!;
    await expect(svc.confirmResult(ctx, pm.id, ttWin)).rejects.toThrow(/published/);

    // A participant in the draw cannot be deleted
    await expect(svc.deleteParticipant(ctx, players[0].id)).rejects.toThrow(/current draw/);

    const draw = await svc.publishDraw(ctx, preview2.id);
    expect(draw.status).toBe('published');

    // Accidental regeneration of a published draw is blocked without the typed confirmation
    await expect(svc.generateDrawPreview(ctx, beginner.id)).rejects.toMatchObject({ code: 'CONFIRM_REQUIRED' });
    await expect(svc.generateDrawPreview(ctx, beginner.id, 'wrong name')).rejects.toMatchObject({ code: 'CONFIRM_REQUIRED' });

    let ms = await matchesOf(ctx, draw.id);
    expect(ms.length).toBe(15);
    const r1 = ms.filter((m) => m.round === 1);
    expect(r1.filter((m) => m.status === 'bye').length).toBe(3);
    // seeds 1 & 2 got byes and were advanced into the quarterfinals
    const r2Participants = ms.filter((m) => m.round === 2).flatMap((m) => [m.participant_a, m.participant_b]);
    expect(r2Participants).toEqual(expect.arrayContaining([players[0].id, players[1].id]));

    // Schedule all playable first-round matches; venue clash detection
    const playable = r1.filter((m) => m.status !== 'bye');
    const t0 = new Date('2026-12-01T09:00:00Z').getTime();
    for (let i = 0; i < playable.length; i++) {
      const at = new Date(t0 + Math.floor(i / 2) * 30 * 60000).toISOString();
      await svc.scheduleMatch(ctx, playable[i].id, { scheduled_at: at, venue_id: i % 2 ? t2.id : t1.id });
    }
    await expect(
      svc.scheduleMatch(ctx, playable[2].id, { scheduled_at: new Date(t0).toISOString(), venue_id: t1.id }),
    ).rejects.toThrow(/already hosts/);
    ms = await matchesOf(ctx, draw.id);
    expect(ms.filter((m) => m.status === 'scheduled').length).toBe(playable.length);

    // Live score, invalid scores rejected, then confirm
    await svc.saveLiveScore(ctx, playable[0].id, [{ a: 11, b: 3 }, { a: 5, b: 4 }]);
    expect(((await ctx.repo.get<Match>('matches', playable[0].id)) as Match).status).toBe('in_progress');
    await expect(svc.confirmResult(ctx, playable[0].id, [{ a: 11, b: 10 }, { a: 11, b: 3 }])).rejects.toThrow(/win by 2/);
    await expect(svc.confirmResult(ctx, playable[0].id, [{ a: 11, b: 3 }])).rejects.toThrow(/at least 2 games/);

    // Play every round: A wins odd-numbered matches, B wins even ones; one walkover
    for (let round = 1; round <= draw.rounds; round++) {
      ms = await matchesOf(ctx, draw.id);
      for (const m of ms.filter((x) => x.round === round && x.status !== 'bye')) {
        expect(m.participant_a && m.participant_b).toBeTruthy();
        if (round === 1 && m.number === playable[1].number) {
          await svc.awardWalkover(ctx, m.id, m.participant_b!, 'Opponent absent');
        } else {
          await svc.confirmResult(ctx, m.id, m.number % 2 ? ttWin : ttWinB);
        }
      }
    }

    ms = await matchesOf(ctx, draw.id);
    expect(ms.every((m) => ['completed', 'walkover', 'bye'].includes(m.status))).toBe(true);
    // Every winner (except the final's) appears in the next round
    for (const m of ms.filter((x) => x.round < draw.rounds)) {
      const next = ms.find((x) => x.round === m.round + 1 && x.position === Math.floor(m.position / 2))!;
      expect([next.participant_a, next.participant_b]).toContain(m.winner_id);
    }

    const final = ms.find((m) => m.round === draw.rounds)!;
    expect(final.winner_id).toBeTruthy();

    // Correcting a semifinal after the final was played requires cascade
    const semi = ms.find((m) => m.round === draw.rounds - 1 && m.winner_id === final.winner_id)!;
    const flipped: Game[] = semi.games.map((g) => ({ a: g.b, b: g.a }));
    await expect(svc.confirmResult(ctx, semi.id, flipped)).rejects.toMatchObject({ code: 'DOWNSTREAM_PLAYED' });
    await svc.confirmResult(ctx, semi.id, flipped, true);
    ms = await matchesOf(ctx, draw.id);
    const finalAfter = ms.find((m) => m.round === draw.rounds)!;
    const newSemiWinner = ms.find((m) => m.id === semi.id)!.winner_id;
    expect(finalAfter.status).toBe('pending');
    expect(finalAfter.winner_id).toBeNull();
    expect([finalAfter.participant_a, finalAfter.participant_b]).toContain(newSemiWinner);
    expect([finalAfter.participant_a, finalAfter.participant_b]).not.toContain(semi.winner_id);

    // Champion cannot be declared before the final is played
    await expect(svc.declareChampion(ctx, beginner.id)).rejects.toThrow(/final/);

    // Replay the final and declare the champion
    await svc.confirmResult(ctx, finalAfter.id, ttWin);
    const champ = await svc.declareChampion(ctx, beginner.id);
    expect(champ.status).toBe('completed');
    expect(champ.champion_id).toBe(finalAfter.participant_a);

    // Results are locked after declaration
    await expect(svc.resetMatch(ctx, finalAfter.id)).rejects.toThrow(/locked/);

    // Audit trail and immutable original draw
    const actions = db.audit_log.map((a) => a.action);
    for (const a of ['draw.generate', 'draw.publish', 'match.confirm', 'match.walkover', 'match.correct', 'champion.declare']) {
      expect(actions).toContain(a);
    }
    const stored = (await ctx.repo.get<Draw>('draws', draw.id))!;
    expect(stored.original_draw.slots.filter((s) => s.participant_id).length).toBe(13);
    expect(stored.original_draw.rng_seed).toBe(stored.rng_seed);
  });

  it('regenerates a published badminton doubles draw only with explicit confirmation, keeping history', async () => {
    const { ctx } = setup();
    const cat = await svc.createCategory(ctx, { sport: 'badminton', discipline: 'doubles', level: 'Open' });
    await expect(svc.createParticipant(ctx, { category_id: cat.id, player1: 'Ann' })).rejects.toThrow(/Partner/);
    await svc.createParticipant(ctx, { category_id: cat.id, player1: 'Ann', player2: 'Bea' });
    await expect(svc.createParticipant(ctx, { category_id: cat.id, player1: 'Cat', player2: 'ann' })).rejects.toThrow(
      /already entered/,
    );
    await svc.createParticipant(ctx, { category_id: cat.id, player1: 'Cat', player2: 'Dee' });
    await svc.createParticipant(ctx, { category_id: cat.id, player1: 'Eve', player2: 'Fay' });

    const d1 = await svc.publishDraw(ctx, (await svc.generateDrawPreview(ctx, cat.id)).id);
    const ms = await matchesOf(ctx, d1.id);
    expect(ms.length).toBe(3);
    const playable = ms.find((m) => m.round === 1 && m.status !== 'bye')!;
    await expect(svc.confirmResult(ctx, playable.id, [{ a: 21, b: 20 }, { a: 21, b: 3 }])).rejects.toThrow(/win by 2/);
    await svc.confirmResult(ctx, playable.id, [{ a: 30, b: 29 }, { a: 15, b: 21 }, { a: 21, b: 19 }]);

    // A new player registers late → regenerate with typed confirmation
    await svc.createParticipant(ctx, { category_id: cat.id, player1: 'Gia', player2: 'Hal' });
    const d2 = await svc.generateDrawPreview(ctx, cat.id, cat.name);
    await expect(svc.publishDraw(ctx, d2.id)).rejects.toMatchObject({ code: 'CONFIRM_REQUIRED' });
    await svc.publishDraw(ctx, d2.id, true);
    const draws = await ctx.repo.list<Draw>('draws', { category_id: cat.id });
    expect(draws.find((d) => d.id === d1.id)!.status).toBe('superseded');
    expect(draws.find((d) => d.id === d2.id)!.status).toBe('published');
    expect((await matchesOf(ctx, d1.id)).length).toBe(3); // history kept for audit
    expect((await matchesOf(ctx, d2.id)).every((m) => m.round > 1 || (m.participant_a && m.participant_b))).toBe(true);
  });

  it('blocks publishing a stale preview and handles resets', async () => {
    const { ctx } = setup();
    const cat = await svc.createCategory(ctx, { sport: 'badminton', discipline: 'singles', level: 'Beginner' });
    for (const n of ['A', 'B', 'C', 'D']) await svc.createParticipant(ctx, { category_id: cat.id, player1: n });
    const prev = await svc.generateDrawPreview(ctx, cat.id);
    await svc.createParticipant(ctx, { category_id: cat.id, player1: 'E' });
    await expect(svc.publishDraw(ctx, prev.id)).rejects.toThrow(/Registrations changed/);
    const d = await svc.publishDraw(ctx, (await svc.generateDrawPreview(ctx, cat.id)).id);
    expect(d.bracket_size).toBe(8);
    let ms = await matchesOf(ctx, d.id);
    const m = ms.find((x) => x.round === 1 && x.status !== 'bye')!;
    await svc.confirmResult(ctx, m.id, [{ a: 21, b: 5 }, { a: 21, b: 5 }]);
    ms = await matchesOf(ctx, d.id);
    const next = ms.find((x) => x.round === 2 && x.position === Math.floor(m.position / 2))!;
    expect([next.participant_a, next.participant_b]).toContain(m.participant_a);
    await svc.resetMatch(ctx, m.id);
    ms = await matchesOf(ctx, d.id);
    expect(ms.find((x) => x.id === next.id)!.participant_a === m.participant_a || ms.find((x) => x.id === next.id)!.participant_b === m.participant_a).toBe(false);
    expect(ms.find((x) => x.id === m.id)!.status).toBe('pending');
  });
});
