-- Class Scheduler — Supabase Schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ── Semesters ────────────────────────────────────────────────────────────────
create table if not exists public.semesters (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  display_order int  not null default 0,
  created_at    timestamptz default now()
);

-- ── Courses ──────────────────────────────────────────────────────────────────
create table if not exists public.courses (
  id            text primary key,
  semester_id   text references public.semesters(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  course_code   text not null,
  name          text not null default '',
  instructor    text not null default '',
  room          text not null default '',
  days          text[] not null default '{}',
  start_time    text not null default '08:00',
  end_time      text not null default '09:00',
  units         numeric not null default 3,
  class_number  text not null default '',
  section       text not null default '',
  color         text not null default '#3b82f6',
  availability  text not null default 'Open',
  open_seats    int,
  total_seats   int,
  notes         text,
  created_at    timestamptz default now()
);

-- ── User settings ─────────────────────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  active_semester_id text,
  updated_at         timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.semesters     enable row level security;
alter table public.courses        enable row level security;
alter table public.user_settings  enable row level security;

-- Drop before recreate so this script is safe to re-run
drop policy if exists "own semesters"  on public.semesters;
drop policy if exists "own courses"    on public.courses;
drop policy if exists "own settings"   on public.user_settings;

create policy "own semesters"    on public.semesters    for all using (auth.uid() = user_id);
create policy "own courses"      on public.courses       for all using (auth.uid() = user_id);
create policy "own settings"     on public.user_settings for all using (auth.uid() = user_id);
