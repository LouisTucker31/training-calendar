-- Training Calendar Supabase schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Table names are prefixed with training_ since this project is shared
-- with other apps, so they can't collide with unrelated existing tables.

-- training_events
create table training_events (
  date text primary key,              -- ISO date, e.g. '2026-09-26'
  name text not null,
  color_index int not null default 0,
  location text,
  website text,
  garmin_epic_link text,
  garmin_epic_link_label text,
  disciplines jsonb not null default '[]'::jsonb
  -- disciplines: [{ discipline, type, surface, elevation, distance, duration, pace }, ...]
);

-- training_event_blocks
create table training_event_blocks (
  event_date text primary key references training_events(date) on delete cascade,
  start_date text not null,           -- ISO date
  end_date text not null              -- ISO date
);

-- training_workouts
create table training_workouts (
  date text primary key,              -- ISO date, one row per calendar day
  week int not null,
  phase text not null,
  sessions jsonb not null default '[]'::jsonb
  -- sessions: [{ day, discipline, session, duration, details, rpe }, ...]
);

-- training_logged_workouts
-- One row per date marked "complete" via the popup button. Presence of a
-- row = logged; no row = not logged.
create table training_logged_workouts (
  date text primary key references training_workouts(date) on delete cascade,
  logged_at timestamptz not null default now()
);

-- training_pace_benchmarks
-- Every save inserts a new row rather than updating one in place, so past
-- benchmark values are preserved as training progresses - the Paces tab
-- always reads the most recent row (highest set_at) to populate its
-- inputs, but nothing is ever overwritten or deleted here. No user_id:
-- this app has no auth, so there's only ever one shared history.
create table training_pace_benchmarks (
  id bigint generated always as identity primary key,
  set_at timestamptz not null default now(),
  css_pace text,              -- swim CSS pace per 100m, e.g. "1:35"
  cycling_lthr int,           -- bike LTHR in bpm
  run_threshold_pace text     -- run threshold pace per km, e.g. "4:30"
);

-- Row Level Security
-- Public read+write via the anon key, same trust model as the current
-- localStorage-only setup: anyone with the page open can view and edit.
-- Tighten this later (e.g. require auth for writes) if this URL is ever
-- shared beyond just you.

alter table training_events enable row level security;
alter table training_event_blocks enable row level security;
alter table training_workouts enable row level security;
alter table training_logged_workouts enable row level security;
alter table training_pace_benchmarks enable row level security;

create policy "public read training_events" on training_events for select using (true);
create policy "public write training_events" on training_events for insert with check (true);
create policy "public update training_events" on training_events for update using (true);
create policy "public delete training_events" on training_events for delete using (true);

create policy "public read training_event_blocks" on training_event_blocks for select using (true);
create policy "public write training_event_blocks" on training_event_blocks for insert with check (true);
create policy "public update training_event_blocks" on training_event_blocks for update using (true);
create policy "public delete training_event_blocks" on training_event_blocks for delete using (true);

create policy "public read training_workouts" on training_workouts for select using (true);
create policy "public write training_workouts" on training_workouts for insert with check (true);
create policy "public update training_workouts" on training_workouts for update using (true);
create policy "public delete training_workouts" on training_workouts for delete using (true);

create policy "public read training_logged_workouts" on training_logged_workouts for select using (true);
create policy "public write training_logged_workouts" on training_logged_workouts for insert with check (true);
create policy "public update training_logged_workouts" on training_logged_workouts for update using (true);
create policy "public delete training_logged_workouts" on training_logged_workouts for delete using (true);

create policy "public read training_pace_benchmarks" on training_pace_benchmarks for select using (true);
create policy "public write training_pace_benchmarks" on training_pace_benchmarks for insert with check (true);
create policy "public update training_pace_benchmarks" on training_pace_benchmarks for update using (true);
create policy "public delete training_pace_benchmarks" on training_pace_benchmarks for delete using (true);
