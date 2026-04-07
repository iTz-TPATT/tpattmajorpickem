-- ============================================================
-- Major Pick'em 2026 — Full Setup Script (v2)
-- Run this in Supabase SQL Editor
-- If upgrading from v1, run the ALTER statements at the bottom
-- ============================================================

-- 1. Users
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz default now()
);

-- 2. Picks (tournament-aware)
create table if not exists picks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade not null,
  username      text not null,
  tournament    text not null default 'masters',
  round_number  int  not null check (round_number between 1 and 4),
  golfer        text not null,
  created_at    timestamptz default now(),
  unique(user_id, tournament, round_number, golfer)
);

-- 3. Score cache (ESPN API responses, 2-min TTL)
create table if not exists score_cache (
  tournament  text primary key,
  data        jsonb not null,
  updated_at  timestamptz default now()
);

-- 4. Champions (prior year + 2026 auto-computed after each tournament)
create table if not exists champions (
  tournament    text not null,
  year          int  not null,
  champion_name text not null,
  primary key (tournament, year)
);

-- 5. Disable RLS (auth handled in API routes)
alter table users         disable row level security;
alter table picks         disable row level security;
alter table score_cache   disable row level security;
alter table champions     disable row level security;

-- 6. Seed prior year champions
insert into champions (tournament, year, champion_name) values
  ('masters',  2025, 'Wyatt T.O. Robson'),
  ('pga',      2025, 'Wyatt T.O. Robson'),
  ('usopen',   2025, 'Corbin "Lite It Up" Blount'),
  ('theopen',  2025, 'Corbin "Lite It Up" Blount')
on conflict (tournament, year) do nothing;

-- ============================================================
-- IF UPGRADING FROM V1 (already ran the first setup script):
-- Run these lines instead of everything above:
-- ============================================================

-- alter table picks add column if not exists tournament text not null default 'masters';
-- alter table picks drop constraint if exists picks_user_id_round_number_golfer_key;
-- alter table picks add constraint picks_user_tournament_round_golfer_unique unique(user_id, tournament, round_number, golfer);

-- create table if not exists score_cache (
--   tournament text primary key,
--   data jsonb not null,
--   updated_at timestamptz default now()
-- );

-- create table if not exists champions (
--   tournament text not null, year int not null, champion_name text not null,
--   primary key (tournament, year)
-- );

-- alter table score_cache disable row level security;
-- alter table champions disable row level security;

-- insert into champions (tournament, year, champion_name) values
--   ('masters', 2025, 'Wyatt T.O. Robson'),
--   ('pga', 2025, 'Wyatt T.O. Robson'),
--   ('usopen', 2025, 'Corbin "Lite It Up" Blount'),
--   ('theopen', 2025, 'Corbin "Lite It Up" Blount')
-- on conflict do nothing;
