-- Optional starter configuration: one Table Tennis and one Badminton tournament,
-- plus courts/tables. Each player has a level (beginner / intermediate / advanced)
-- that is used to seed the draw so the strongest players meet as late as possible.
-- No participants or results are seeded — register real players in the admin dashboard.

insert into public.categories (sport, discipline, level, name, sort_order) values
  ('table_tennis', 'singles', 'Open', 'Table Tennis', 10),
  ('badminton',    'singles', 'Open', 'Badminton',    20)
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
