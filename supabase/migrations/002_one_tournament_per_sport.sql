-- =====================================================================
--  Migration 002 — one tournament per sport, players carry a level
--  Run once in Supabase → SQL Editor on a database that was set up with
--  the original schema.sql + seed.sql (separate Beginner/Intermediate/
--  Advanced categories). Safe to run more than once.
-- =====================================================================

-- 1. Players get a level used for seeding the draw
alter table public.participants add column if not exists level text not null default 'beginner';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'participants_level_check') then
    alter table public.participants add constraint participants_level_check
      check (level in ('beginner', 'intermediate', 'advanced'));
  end if;
end $$;

-- 2. One tournament per sport
insert into public.categories (sport, discipline, level, name, sort_order) values
  ('table_tennis', 'singles', 'Open', 'Table Tennis', 10),
  ('badminton',    'singles', 'Open', 'Badminton',    20)
on conflict (sport, discipline, level) do update set name = excluded.name, sort_order = excluded.sort_order;

-- 3. Move players from the old level categories into the single tournament,
--    keeping their level (only categories that have no draw yet)
update public.participants p
   set level = lower(old.level),
       category_id = open_cat.id
  from public.categories old
  join public.categories open_cat
    on open_cat.sport = old.sport and open_cat.discipline = 'singles' and open_cat.level = 'Open'
 where p.category_id = old.id
   and old.discipline = 'singles'
   and old.level in ('Beginner', 'Intermediate', 'Advanced')
   and not exists (select 1 from public.draws d where d.category_id = old.id);

-- 4. Remove the old, now-empty categories (never touches anything with a draw)
delete from public.categories c
 where c.level <> 'Open'
   and not exists (select 1 from public.participants p where p.category_id = c.id)
   and not exists (select 1 from public.draws d where d.category_id = c.id);
delete from public.categories c
 where c.discipline = 'doubles'
   and not exists (select 1 from public.participants p where p.category_id = c.id)
   and not exists (select 1 from public.draws d where d.category_id = c.id);

-- Result
select name, sport, discipline, level, status,
       (select count(*) from public.participants p where p.category_id = c.id) as players
  from public.categories c order by sort_order;
