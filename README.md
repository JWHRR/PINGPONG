# Smash Cup — Table Tennis & Badminton Tournament Platform

A complete tournament website and management platform for knockout competitions in **Table Tennis** and **Badminton** (singles and doubles, with separate brackets for every competition level).

- **Public site**: Home, Participants (search, filters, profiles and match history), an interactive **knockout bracket** (zoom, pan, full screen, mobile-friendly), and a **Live Match Center**.
- **Admin dashboard** (protected): register participants, manage categories and levels, generate, preview and publish random draws, schedule matches on courts and tables, enter live scores, validate results, handle walkovers and corrections, and declare champions. Every action goes into an audit log.
- **Real backend**: Supabase Postgres with Row Level Security, Supabase Auth, Next.js API routes, and Realtime updates on every page.

| Stack | |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, lucide-react |
| Backend | Next.js Route Handlers (`/api/admin/*`) and a service layer in `src/lib/service.ts` |
| Database | Supabase Postgres: `supabase/schema.sql` (tables, constraints, triggers, RLS, realtime) |
| Auth | Supabase Auth (email + password); administrators are listed in `public.admins` |
| Tests | Vitest: scoring rules, draw algorithm (2–70 players), full organizer workflow |

---

## 1. Installation (local)

Requirements: Node.js 20+ and a free [Supabase](https://supabase.com) project.

```bash
git clone <your-repo-url> smash-cup
cd smash-cup
npm install
cp .env.example .env.local      # then fill in the two Supabase values
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable | Where to find it | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key | yes |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | an admin account, only for `npm run e2e:live` | no |

No service-role key is needed. All writes run with the signed-in administrator's token, so the database's RLS policies are enforced on every request.

## 2. Database setup (Supabase)

1. Create a project at supabase.com and wait for it to finish provisioning.
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. (Optional) Run [`supabase/seed.sql`](supabase/seed.sql) to create the standard categories (TT Singles Beginner, Intermediate and Advanced; Badminton Singles at the same three levels; Badminton Doubles Open) and five courts/tables. It does **not** create any players.
4. **Create the administrator:**
   - Authentication → Users → **Add user** → *Create new user* (email + password, tick *Auto Confirm User*).
   - In the SQL Editor run:
     ```sql
     insert into public.admins (user_id, email)
     select id, email from auth.users where email = 'organizer@example.com';
     ```
5. Recommended: Authentication → Sign In / Providers → turn **off** "Allow new users to sign up". Admins are created by you; the public site needs no accounts.

## 3. Deployment (Vercel)

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com): **Add New… → Project → Import** the GitHub repository. Vercel detects Next.js automatically.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Click **Deploy**. After every `git push`, Vercel redeploys automatically.
5. Check `https://<your-app>.vercel.app/api/health`. It should return `"supabaseConfigured": true`.

> If you change environment variables later, redeploy (Deployments → ⋯ → Redeploy) because `NEXT_PUBLIC_*` values are compiled into the build.

## 4. Testing

```bash
npm test             # 82 unit + workflow tests (no database needed)
npm run typecheck
npm run build
```

`tests/workflow.test.ts` runs the full organizer workflow through the same service functions the API uses: register participants → assign levels → generate draw → publish → schedule → enter scores → advance winners → corrections → final → champion.

To verify a real deployment end to end (it creates a temporary category, plays it through to a champion, checks the public view, then deletes everything it created):

```bash
BASE_URL=https://<your-app>.vercel.app \
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run e2e:live
```

## 5. Documentation

- [Administrator guide](docs/ADMIN_GUIDE.md): running a tournament day step by step.
- [Technical reference](docs/TECHNICAL.md): architecture, data model, draw algorithm, scoring rules, security, and the API.

## Project structure

```
supabase/schema.sql        tables, constraints, triggers, RLS, realtime
supabase/seed.sql          optional categories + courts/tables
src/lib/draw.ts            draw generation (seeding, BYEs, reproducible RNG)
src/lib/scoring.ts         best-of-3 score validation (TT 11 / badminton 21)
src/lib/engine.ts          bracket advancement, corrections, cascade resets
src/lib/service.ts         all organizer operations with validation + audit
src/app/api/admin/*        authenticated API routes
src/components/bracket/*   interactive knockout tree
src/app/(pages)            /, /draw, /live, /participants, /admin
tests/*                    Vitest suites
scripts/e2e-live.ts        end-to-end check against a live deployment
```
