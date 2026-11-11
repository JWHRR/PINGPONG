# Technical Reference

## Architecture

```
Browser (Next.js client pages)
  ├─ reads   → Supabase (anon key, RLS: only published data; admins also see previews)
  ├─ live    → Supabase Realtime (postgres_changes on all tournament tables → refetch)
  └─ writes  → Next.js API  /api/admin/*  (Bearer = admin's Supabase access token)
                 └─ adminHandler: verify token → check public.admins → service layer
                      └─ Supabase client acting AS the admin (RLS enforced again)
```

- **One source of truth.** Every page reads the same tables through `TournamentProvider` (`src/lib/data.tsx`). A Realtime subscription refetches (debounced) on any change, so a result entered by an organiser appears on every open bracket, match center and profile within about a second. A 30-second poll is the fallback for venue networks that block websockets.
- **Defence in depth.** The API checks admin membership, and the database independently enforces `is_admin()` on every write through RLS. No service-role key exists anywhere in the app.
- **Testable service layer.** `src/lib/service.ts` takes a `Repo` interface. In production it's `supabaseRepo`; the tests use an in-memory repo that mirrors the database constraints.

## Data model (`supabase/schema.sql`)

| Table | Purpose |
|---|---|
| `settings` | Single row: names, dates, location (editable) |
| `categories` | sport × discipline × level (unique), status, declared champion |
| `participants` | player or doubles pair, club, seed; unique name, unique seed per category |
| `venues` | courts/tables with sport tag and active flag |
| `draws` | every generated draw: version, status `preview/published/superseded`, `rng_seed`, immutable `original_draw` JSON |
| `matches` | round, position, number, two slots, games JSON, winner, status, schedule, venue, validation stamp |
| `audit_log` | every admin action with details |
| `admins` | Supabase Auth users with admin rights |

Integrity enforced **in the database**:
- At most one published draw and one preview per category (partial unique indexes).
- A participant appears at most once per round of a draw and only in matches of their own category (trigger `matches_integrity`).
- A winner must be one of the two participants; a match can't contain the same participant twice (CHECK constraints).
- `original_draw` and `rng_seed` can't be modified after insert (trigger `draws_protect_original`).

## Draw algorithm (`src/lib/draw.ts`)
1. Validate: at least 2 participants, no duplicate ids or seeds.
2. Bracket size `S` = next power of two ≥ N; rounds = log₂ S; BYEs = S − N.
3. Seeded participants take seed numbers 1..k in seed order. Unseeded participants are shuffled with Fisher–Yates using a **mulberry32 PRNG** seeded from a 128-bit random seed. The seed is stored, so the draw is reproducible and auditable.
4. Positions follow the **standard seed order** (8 → `1,8,4,5,2,7,3,6`). Seed numbers above N are BYEs, so BYEs always meet the top seeds, are balanced across halves, and BYE-vs-BYE is impossible.
5. Round-1 BYE matches are created as `status = 'bye'` with the winner already advanced into round 2.

The tests check every N from 2 to 70: each player appears exactly once, no BYE-vs-BYE, the BYE count is correct, BYEs are balanced across halves, and round 2 has no duplicates.

## Advancement engine (`src/lib/engine.ts`)
- Next match of (round r, position p) = (r + 1, ⌊p/2⌋), slot `a` if p is even, otherwise `b`.
- `applyResult` records the validated result and places the winner in the next slot.
- **Corrections:** if the winner changes and the next match has started or finished, a `409 DOWNSTREAM_PLAYED` is returned. Resubmitting with `cascade: true` clears all dependent results recursively before placing the new winner.
- Changes are written in round order so the per-round uniqueness trigger is never violated part-way through.

## Scoring (`src/lib/scoring.ts`)
- Best of 3, two games to win, no games after the match is decided.
- Table tennis: game to 11, win by 2, no cap. Badminton: game to 21, win by 2, cap 30.
- `validateLiveScore` allows an unfinished last game; `validateMatchResult` requires a complete, valid result. The server always re-validates.

## API

All endpoints need `Authorization: Bearer <supabase access token>` from an administrator. Errors return `{ error, code? }` with an HTTP status (400 validation, 401 unauthenticated, 403 not admin, 404 missing, 409 needs confirmation).

| Endpoint | Body |
|---|---|
| `POST/PATCH/DELETE /api/admin/participants` | `{category_id, player1, player2?, name?, club?, seed?, notes?}` / `{id, …}` / `{id}` |
| `POST/PATCH/DELETE /api/admin/categories` | `{sport, discipline, level, name?, sort_order?}` / `{id, …}` / `{id}` |
| `POST/PATCH/DELETE /api/admin/venues` | `{name, sport, active?}` / `{id, …}` / `{id}` |
| `PATCH /api/admin/settings` | any settings fields |
| `POST /api/admin/draws` | `{action:'generate', categoryId, confirmText?}` · `{action:'publish', drawId, confirmReplace?}` · `{action:'discard', drawId}` |
| `POST /api/admin/matches` | `{action:'schedule', matchId, scheduled_at?, venue_id?}` · `{action:'live', matchId, games}` · `{action:'confirm', matchId, games, cascade?}` · `{action:'walkover', matchId, winnerId, reason?, cascade?}` · `{action:'reset', matchId, cascade?}` |
| `POST /api/admin/champion` | `{action:'declare' \| 'reopen', categoryId}` |
| `GET /api/health` | — |

`games` is `[{a: number, b: number}, …]`, where `a` is `participant_a`'s points.

## Bracket UI (`src/components/bracket`)
- Absolute layout: round-1 cards are spaced evenly, and each later card sits at the vertical midpoint of its two feeders. SVG connectors run into the exact player row they feed. Paths of players who advanced are drawn in green; hovering a player traces their path in gold.
- Zoom (buttons, Ctrl/⌘ + wheel, 30–160%), fit-to-screen, drag-to-pan, round jump chips, full screen (Fullscreen API with a CSS fallback for iOS). Phones open at a readable ~100% scale with horizontal scrolling.
- Cards show seed, name, per-game scores, games won, status bar colour, court/table and time. Clicking a card opens full match details.
