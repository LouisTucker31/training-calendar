-- Training Calendar Supabase schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

-- events
create table events (
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

-- training_blocks
create table training_blocks (
  event_date text primary key references events(date) on delete cascade,
  start_date text not null,           -- ISO date
  end_date text not null              -- ISO date
);

-- workouts
create table workouts (
  date text primary key,              -- ISO date, one row per calendar day
  week int not null,
  phase text not null,
  sessions jsonb not null default '[]'::jsonb
  -- sessions: [{ day, discipline, session, duration, details, rpe }, ...]
);

-- logged_workouts
-- One row per date marked "complete" via the popup button. Presence of a
-- row = logged; no row = not logged.
create table logged_workouts (
  date text primary key references workouts(date) on delete cascade,
  logged_at timestamptz not null default now()
);

-- Row Level Security
-- Public read+write via the anon key, same trust model as the current
-- localStorage-only setup: anyone with the page open can view and edit.
-- Tighten this later (e.g. require auth for writes) if this URL is ever
-- shared beyond just you.

alter table events enable row level security;
alter table training_blocks enable row level security;
alter table workouts enable row level security;
alter table logged_workouts enable row level security;

create policy "public read events" on events for select using (true);
create policy "public write events" on events for insert with check (true);
create policy "public update events" on events for update using (true);
create policy "public delete events" on events for delete using (true);

create policy "public read training_blocks" on training_blocks for select using (true);
create policy "public write training_blocks" on training_blocks for insert with check (true);
create policy "public update training_blocks" on training_blocks for update using (true);
create policy "public delete training_blocks" on training_blocks for delete using (true);

create policy "public read workouts" on workouts for select using (true);
create policy "public write workouts" on workouts for insert with check (true);
create policy "public update workouts" on workouts for update using (true);
create policy "public delete workouts" on workouts for delete using (true);

create policy "public read logged_workouts" on logged_workouts for select using (true);
create policy "public write logged_workouts" on logged_workouts for insert with check (true);
create policy "public update logged_workouts" on logged_workouts for update using (true);
create policy "public delete logged_workouts" on logged_workouts for delete using (true);
