/**
 * Live end-to-end check against a real deployment + Supabase project.
 *
 *   BASE_URL=https://your-app.vercel.app \
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run e2e:live
 *
 * Creates a temporary category, runs: register → generate → publish → schedule →
 * scores (incl. walkover + correction) → advance → final → champion, verifies the
 * public (anonymous) view, then deletes everything it created.
 */
import { createClient } from '@supabase/supabase-js';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = process.env.E2E_ADMIN_EMAIL!;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD!;

if (!URL_ || !ANON || !EMAIL || !PASSWORD) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD');
  process.exit(1);
}

const admin = createClient(URL_, ANON, { auth: { persistSession: false } });
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
let token = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function api(resource: string, method: string, body: unknown, expectStatus = 200) {
  const res = await fetch(`${BASE}/api/admin/${resource}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status !== expectStatus) throw new Error(`${method} ${resource} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  console.log(`E2E against ${BASE}`);
  const { data, error } = await admin.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw error;
  token = data.session!.access_token;

  // Unauthenticated / non-admin requests are rejected
  const unauth = await fetch(`${BASE}/api/admin/categories`, { method: 'POST', body: '{}' });
  assert(unauth.status === 401, 'admin API rejects requests without a token');

  const stamp = Date.now().toString(36);
  const category = await api('categories', 'POST', { sport: 'table_tennis', discipline: 'singles', level: `E2E-${stamp}`, sort_order: 999 });
  console.log(`Category: ${category.name}`);
  try {
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'].map((n) => `${n} ${stamp}`);
    for (const [i, n] of names.entries()) await api('participants', 'POST', { category_id: category.id, player1: n, seed: i === 0 ? 1 : null });
    assert(true, 'registered 6 participants');
    await api('participants', 'POST', { category_id: category.id, player1: names[1] }, 400);
    assert(true, 'duplicate registration rejected');

    const preview = await api('draws', 'POST', { action: 'generate', categoryId: category.id });
    assert(preview.status === 'preview' && preview.bracket_size === 8, 'preview generated (8-draw, 2 BYEs)');
    const { data: hidden } = await anon.from('draws').select('id').eq('id', preview.id);
    assert((hidden ?? []).length === 0, 'preview is hidden from the public (RLS)');

    const draw = await api('draws', 'POST', { action: 'publish', drawId: preview.id });
    assert(draw.status === 'published', 'draw published');
    await api('draws', 'POST', { action: 'generate', categoryId: category.id }, 409);
    assert(true, 'accidental regeneration of published draw blocked');

    const venue = await api('venues', 'POST', { name: `E2E Table ${stamp}`, sport: 'table_tennis' });
    const load = async () => {
      const { data: ms } = await admin.from('matches').select('*').eq('draw_id', draw.id).order('number');
      return ms as any[];
    };

    let ms = await load();
    assert(ms.filter((m) => m.status === 'bye').length === 2, 'two BYE matches auto-advanced');
    const first = ms.filter((m) => m.round === 1 && m.status !== 'bye');
    for (const [i, m] of first.entries()) {
      await api('matches', 'POST', { action: 'schedule', matchId: m.id, scheduled_at: new Date(Date.now() + (i + 1) * 3600e3).toISOString(), venue_id: venue.id });
    }
    assert(true, 'first-round matches scheduled');

    await api('matches', 'POST', { action: 'live', matchId: first[0].id, games: [{ a: 11, b: 4 }, { a: 3, b: 2 }] });
    const { data: liveRow } = await anon.from('matches').select('status').eq('id', first[0].id).single();
    assert(liveRow?.status === 'in_progress', 'live score visible publicly');
    await api('matches', 'POST', { action: 'confirm', matchId: first[0].id, games: [{ a: 11, b: 10 }, { a: 11, b: 2 }] }, 400);
    assert(true, 'invalid score (11-10) rejected');

    for (let round = 1; round <= draw.rounds; round++) {
      ms = await load();
      for (const m of ms.filter((x) => x.round === round && x.status !== 'bye')) {
        if (round === 1 && m.id === first[1].id) await api('matches', 'POST', { action: 'walkover', matchId: m.id, winnerId: m.participant_b, reason: 'E2E absent' });
        else await api('matches', 'POST', { action: 'confirm', matchId: m.id, games: [{ a: 11, b: 6 }, { a: 7, b: 11 }, { a: 11, b: 9 }] });
      }
    }
    ms = await load();
    const final = ms.find((m) => m.round === draw.rounds)!;
    assert(final.status === 'completed' && final.winner_id, 'final completed');
    for (const m of ms.filter((x) => x.round < draw.rounds)) {
      const next = ms.find((x) => x.round === m.round + 1 && x.position === Math.floor(m.position / 2));
      if (![next.participant_a, next.participant_b].includes(m.winner_id)) throw new Error(`winner of M${m.number} did not advance`);
    }
    assert(true, 'every winner advanced to the correct slot');

    const semi = ms.find((m) => m.round === draw.rounds - 1 && m.winner_id === final.winner_id)!;
    await api('matches', 'POST', { action: 'confirm', matchId: semi.id, games: [{ a: 6, b: 11 }, { a: 7, b: 11 }] }, 409);
    await api('matches', 'POST', { action: 'confirm', matchId: semi.id, games: [{ a: 6, b: 11 }, { a: 7, b: 11 }], cascade: true });
    ms = await load();
    const finalAfter = ms.find((m) => m.round === draw.rounds)!;
    assert(finalAfter.status !== 'completed' && !finalAfter.winner_id, 'semifinal correction reset the final (cascade)');
    await api('matches', 'POST', { action: 'confirm', matchId: finalAfter.id, games: [{ a: 11, b: 5 }, { a: 11, b: 5 }] });

    const champ = await api('champion', 'POST', { action: 'declare', categoryId: category.id });
    assert(champ.status === 'completed' && champ.champion_id === finalAfter.participant_a, 'champion declared');
    const { data: pubCat } = await anon.from('categories').select('champion_id').eq('id', category.id).single();
    assert(pubCat?.champion_id === champ.champion_id, 'champion visible publicly');
    await api('matches', 'POST', { action: 'reset', matchId: finalAfter.id }, 400);
    assert(true, 'results locked after declaration');

    const { data: audit } = await admin.from('audit_log').select('action').eq('category_id', category.id);
    assert((audit ?? []).some((a) => a.action === 'match.correct'), 'audit log recorded the correction');
    await api('venues', 'DELETE', { id: venue.id });
    console.log('\nALL CHECKS PASSED');
  } finally {
    // Cleanup (admin RLS allows these deletes)
    await admin.from('categories').update({ champion_id: null }).eq('id', category.id);
    await admin.from('draws').delete().eq('category_id', category.id);
    await admin.from('participants').delete().eq('category_id', category.id);
    await admin.from('categories').delete().eq('id', category.id);
    await admin.from('venues').delete().like('name', 'E2E Table %');
    console.log('cleaned up test data');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
