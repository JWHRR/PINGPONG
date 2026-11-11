-- Optional starter configuration: competition categories and courts/tables.
-- No participants or results are seeded — register real players in the admin dashboard.

insert into public.categories (sport, discipline, level, name, sort_order) values
  ('table_tennis', 'singles', 'Beginner',     'Table Tennis Singles — Beginner',     10),
  ('table_tennis', 'singles', 'Intermediate', 'Table Tennis Singles — Intermediate', 11),
  ('table_tennis', 'singles', 'Advanced',     'Table Tennis Singles — Advanced',     12),
  ('badminton',    'singles', 'Beginner',     'Badminton Singles — Beginner',        20),
  ('badminton',    'singles', 'Intermediate', 'Badminton Singles — Intermediate',    21),
  ('badminton',    'singles', 'Advanced',     'Badminton Singles — Advanced',        22),
  ('badminton',    'doubles', 'Open',         'Badminton Doubles — Open',            30)
on conflict (sport, discipline, level) do nothing;

insert into public.venues (name, sport) values
  ('Table 1', 'table_tennis'),
  ('Table 2', 'table_tennis'),
  ('Table 3', 'table_tennis'),
  ('Court 1', 'badminton'),
  ('Court 2', 'badminton')
on conflict (name) do nothing;

-- Make an existing Supabase Auth user an administrator (replace the e-mail):
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'organizer@example.com'
-- on conflict (user_id) do nothing;
