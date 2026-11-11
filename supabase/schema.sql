-- =====================================================================
--  Smash Cup Tournament Platform — Supabase / PostgreSQL schema
--  Run this whole file once in Supabase Dashboard -> SQL Editor.
--  It is idempotent for functions/policies; tables use IF NOT EXISTS.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Administrators
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Tournament settings (single row, editable by admins)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id                  int primary key default 1 check (id = 1),
  tournament_name     text not null default 'Smash Cup 2026',
  tagline             text not null default 'Table Tennis & Badminton Championships',
  table_tennis_title  text not null default 'Table Tennis Open',
  badminton_title     text not null default 'Badminton Championship',
  start_date          date,
  end_date            date,
  location            text not null default 'Main Sports Hall',
  description         text not null default '',
  organizer           text not null default '',
  updated_at          timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Categories (one bracket per sport / discipline / level)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id                    uuid primary key default gen_random_uuid(),
  sport                 text not null check (sport in ('table_tennis', 'badminton')),
  discipline            text not null check (discipline in ('singles', 'doubles')),
  level                 text not null check (length(trim(level)) > 0),
  name                  text not null check (length(trim(name)) > 0),
  sort_order            int  not null default 0,
  status                text not null default 'registration'
                        check (status in ('registration', 'draw_preview', 'in_progress', 'completed')),
  champion_id           uuid,
  champion_declared_at  timestamptz,
  created_at            timestamptz not null default now(),
  unique (sport, discipline, level)
);

-- ---------------------------------------------------------------------
-- Participants (a player for singles, a pair for doubles)
-- ---------------------------------------------------------------------
create table if not exists public.participants (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete restrict,
  name         text not null check (length(trim(name)) > 0),
  player1      text not null check (length(trim(player1)) > 0),
  player2      text,
  club         text,
  seed         int check (seed is null or seed > 0),
  level        text not null default 'beginner'
               check (level in ('beginner', 'intermediate', 'advanced')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- For databases created before player levels existed
alter table public.participants add column if not exists level text not null default 'beginner';
do $
begin
  if not exists (select 1 from pg_constraint where conname = 'participants_level_check') then
    alter table public.participants add constraint participants_level_check
      check (level in ('beginner', 'intermediate', 'advanced'));
  end if;
end $;

create unique index if not exists participants_unique_name_per_category
  on public.participants (category_id, lower(trim(name)));
create unique index if not exists participants_unique_seed_per_category
  on public.participants (category_id, seed) where seed is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_champion_fk') then
    alter table public.categories
      add constraint categories_champion_fk
      foreign key (champion_id) references public.participants(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Courts / tables
-- ---------------------------------------------------------------------
create table if not exists public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  sport       text not null default 'any' check (sport in ('table_tennis', 'badminton', 'any')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Draws (every generated draw is kept for audit; superseded ones too)
-- ---------------------------------------------------------------------
create table if not exists public.draws (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid not null references public.categories(id) on delete cascade,
  version            int  not null,
  status             text not null check (status in ('preview', 'published', 'superseded')),
  bracket_size       int  not null check (bracket_size >= 2),
  rounds             int  not null check (rounds >= 1),
  participant_count  int  not null check (participant_count >= 2),
  rng_seed           text not null,
  original_draw      jsonb not null,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  published_at       timestamptz,
  published_by       uuid,
  superseded_at      timestamptz,
  unique (category_id, version)
);
create unique index if not exists draws_one_published_per_category
  on public.draws (category_id) where status = 'published';
create unique index if not exists draws_one_preview_per_category
  on public.draws (category_id) where status = 'preview';

-- ---------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id             uuid primary key default gen_random_uuid(),
  draw_id        uuid not null references public.draws(id) on delete cascade,
  category_id    uuid not null references public.categories(id) on delete cascade,
  round          int  not null check (round >= 1),
  position       int  not null check (position >= 0),
  number         int  not null check (number >= 1),
  participant_a  uuid references public.participants(id) on delete set null,
  participant_b  uuid references public.participants(id) on delete set null,
  bye            boolean not null default false,
  status         text not null default 'pending'
                 check (status in ('pending', 'scheduled', 'in_progress', 'completed', 'walkover', 'bye')),
  games          jsonb not null default '[]'::jsonb check (jsonb_typeof(games) = 'array'),
  winner_id      uuid references public.participants(id) on delete set null,
  scheduled_at   timestamptz,
  venue_id       uuid references public.venues(id) on delete set null,
  started_at     timestamptz,
  completed_at   timestamptz,
  validated_at   timestamptz,
  validated_by   uuid,
  notes          text,
  updated_at     timestamptz not null default now(),
  unique (draw_id, round, position),
  unique (draw_id, number),
  check (participant_a is null or participant_b is null or participant_a <> participant_b),
  check (winner_id is null or winner_id = participant_a or winner_id = participant_b)
);
create index if not exists matches_category_idx on public.matches (category_id);
create index if not exists matches_status_idx on public.matches (status);

-- Integrity: a participant may appear only once per round of a draw and
-- only in matches of their own category.
create or replace function public.matches_integrity()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.participant_a is not null and not exists (
       select 1 from public.participants p where p.id = new.participant_a and p.category_id = new.category_id) then
    raise exception 'Participant % does not belong to this category', new.participant_a;
  end if;
  if new.participant_b is not null and not exists (
       select 1 from public.participants p where p.id = new.participant_b and p.category_id = new.category_id) then
    raise exception 'Participant % does not belong to this category', new.participant_b;
  end if;
  if exists (
       select 1 from public.matches m
        where m.draw_id = new.draw_id and m.round = new.round and m.id <> new.id
          and (   (new.participant_a is not null and new.participant_a in (m.participant_a, m.participant_b))
               or (new.participant_b is not null and new.participant_b in (m.participant_a, m.participant_b)))) then
    raise exception 'Duplicate participant in round % of this draw', new.round;
  end if;
  return new;
end $$;

drop trigger if exists matches_integrity_trg on public.matches;
create trigger matches_integrity_trg
  before insert or update on public.matches
  for each row execute function public.matches_integrity();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists participants_touch on public.participants;
create trigger participants_touch before update on public.participants
  for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- The original draw is immutable once written (auditability).
create or replace function public.draws_protect_original()
returns trigger language plpgsql as $$
begin
  if new.original_draw is distinct from old.original_draw
     or new.rng_seed is distinct from old.rng_seed then
    raise exception 'The original draw record is immutable';
  end if;
  return new;
end $$;
drop trigger if exists draws_protect_original_trg on public.draws;
create trigger draws_protect_original_trg before update on public.draws
  for each row execute function public.draws_protect_original();

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  user_id      uuid default auth.uid(),
  action       text not null,
  category_id  uuid,
  details      jsonb not null default '{}'::jsonb
);

-- =====================================================================
--  Row Level Security
--  Public (anon) can read published tournament data. Only admins write.
-- =====================================================================
alter table public.admins       enable row level security;
alter table public.settings     enable row level security;
alter table public.categories   enable row level security;
alter table public.participants enable row level security;
alter table public.venues       enable row level security;
alter table public.draws        enable row level security;
alter table public.matches      enable row level security;
alter table public.audit_log    enable row level security;

drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists participants_read on public.participants;
create policy participants_read on public.participants for select using (true);
drop policy if exists participants_write on public.participants;
create policy participants_write on public.participants for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists venues_read on public.venues;
create policy venues_read on public.venues for select using (true);
drop policy if exists venues_write on public.venues;
create policy venues_write on public.venues for all
  using (public.is_admin()) with check (public.is_admin());

-- Draw previews are private to admins until published.
drop policy if exists draws_read on public.draws;
create policy draws_read on public.draws for select
  using (status in ('published', 'superseded') or public.is_admin());
drop policy if exists draws_write on public.draws;
create policy draws_write on public.draws for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select
  using (public.is_admin() or exists (
    select 1 from public.draws d where d.id = matches.draw_id and d.status = 'published'));
drop policy if exists matches_write on public.matches;
create policy matches_write on public.matches for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (public.is_admin());
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert with check (public.is_admin());

-- Grants (Supabase usually sets these by default; explicit for safety)
grant usage on schema public to anon, authenticated;
grant select on public.settings, public.categories, public.participants, public.venues,
                public.draws, public.matches to anon, authenticated;
grant select on public.admins to authenticated;
grant insert, update, delete on public.settings, public.categories, public.participants,
                public.venues, public.draws, public.matches to authenticated;
grant select, insert on public.audit_log to authenticated;
grant usage, select on sequence public.audit_log_id_seq to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- =====================================================================
--  Realtime: broadcast changes so every page updates live
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['settings', 'categories', 'participants', 'venues', 'draws', 'matches'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
