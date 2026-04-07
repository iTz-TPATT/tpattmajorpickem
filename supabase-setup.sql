-- ============================================================
-- Major Pick'em 2026 — Supabase Setup Script
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Users table (one row per player in your group)
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz default now()
);

-- 2. Picks table
create table if not exists picks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade not null,
  username      text not null,
  round_number  int  not null check (round_number between 1 and 4),
  golfer        text not null,
  created_at    timestamptz default now(),
  unique(user_id, round_number, golfer)
);

-- 3. Golfer scores (update this manually each day via Supabase Table Editor)
create table if not exists golfer_scores (
  golfer       text primary key,
  r1           int,
  r2           int,
  r3           int,
  r4           int,
  total_score  int  not null default 0,
  position     text,
  status       text not null default 'active',  -- active | cut | wd
  updated_at   timestamptz default now()
);

-- 4. Disable RLS (we handle auth ourselves in API routes)
alter table users          disable row level security;
alter table picks          disable row level security;
alter table golfer_scores  disable row level security;

-- ============================================================
-- 5. Insert the Masters 2026 field (all start at E / 0)
-- ============================================================
insert into golfer_scores (golfer) values
  ('Scottie Scheffler'),
  ('Rory McIlroy'),
  ('Jon Rahm'),
  ('Xander Schauffele'),
  ('Ludvig Åberg'),
  ('Collin Morikawa'),
  ('Viktor Hovland'),
  ('Tommy Fleetwood'),
  ('Brooks Koepka'),
  ('Justin Thomas'),
  ('Patrick Cantlay'),
  ('Will Zalatoris'),
  ('Shane Lowry'),
  ('Tony Finau'),
  ('Hideki Matsuyama'),
  ('Max Homa'),
  ('Russell Henley'),
  ('Adam Scott'),
  ('Cameron Smith'),
  ('Dustin Johnson'),
  ('Bryson DeChambeau'),
  ('Jordan Spieth'),
  ('Matt Fitzpatrick'),
  ('Tyrrell Hatton'),
  ('Robert MacIntyre'),
  ('Tom Kim'),
  ('Sahith Theegala'),
  ('Sungjae Im'),
  ('Akshay Bhatia'),
  ('Min Woo Lee')
on conflict (golfer) do nothing;

-- ============================================================
-- 6. Create your users (run this AFTER installing bcryptjs)
--    OR use the helper script in README.md to generate hashes
-- ============================================================

-- Example (replace hash with output from the README hash script):
-- insert into users (username, password_hash) values
--   ('Trenton', '$2a$10$...your_hash_here...'),
--   ('Adam',    '$2a$10$...your_hash_here...'),
--   ('Will',    '$2a$10$...your_hash_here...');

-- ============================================================
-- HOW TO UPDATE SCORES DURING THE TOURNAMENT:
-- Go to Supabase → Table Editor → golfer_scores
-- Update total_score (and r1/r2/r3/r4) after each round.
-- Negative = under par (good). Positive = over par.
-- Example: Scheffler at -7 → total_score = -7
-- ============================================================
