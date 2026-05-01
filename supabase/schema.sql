-- Horse Training Tracker — Supabase schema + RLS + seed trigger.
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  position int not null,
  created_at timestamptz not null default now(),
  unique (user_id, position)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  phase_id uuid not null references public.phases on delete cascade,
  text text not null,
  position int not null default 0,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_phase_idx on public.questions(phase_id);

create table if not exists public.horses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  breed text,
  owner_name text,
  owner_email text,
  start_date date,
  current_phase_id uuid references public.phases on delete set null,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists horses_user_idx on public.horses(user_id);

create table if not exists public.tqas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  horse_id uuid not null references public.horses on delete cascade,
  phase_id uuid not null references public.phases on delete restrict,
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tqas_horse_idx on public.tqas(horse_id, occurred_at desc);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tqa_id uuid not null references public.tqas on delete cascade,
  question_id uuid not null references public.questions on delete restrict,
  question_text_snapshot text not null,
  score smallint not null check (score between 1 and 5),
  comment text,
  unique (tqa_id, question_id)
);

create index if not exists ratings_tqa_idx on public.ratings(tqa_id);
create index if not exists ratings_question_idx on public.ratings(question_id);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  phase_id uuid references public.phases on delete cascade,
  question_id uuid references public.questions on delete cascade,
  title text not null,
  url text not null,
  kind text not null check (kind in ('youtube','link')),
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  -- Exactly one of phase_id or question_id must be set.
  constraint resources_target_check check (
    (phase_id is not null and question_id is null)
    or (phase_id is null and question_id is not null)
  )
);

create index if not exists resources_phase_idx on public.resources(phase_id);
create index if not exists resources_question_idx on public.resources(question_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles  enable row level security;
alter table public.phases    enable row level security;
alter table public.questions enable row level security;
alter table public.horses    enable row level security;
alter table public.tqas      enable row level security;
alter table public.ratings   enable row level security;
alter table public.resources enable row level security;

drop policy if exists "own profile"   on public.profiles;
drop policy if exists "own phases"    on public.phases;
drop policy if exists "own questions" on public.questions;
drop policy if exists "own horses"    on public.horses;
drop policy if exists "own tqas"      on public.tqas;
drop policy if exists "own ratings"   on public.ratings;
drop policy if exists "own resources" on public.resources;

create policy "own profile"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "own phases"
  on public.phases for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own questions"
  on public.questions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own horses"
  on public.horses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own tqas"
  on public.tqas for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own ratings"
  on public.ratings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own resources"
  on public.resources for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Signup trigger: seed a profile + the 5 default phases for every new user.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.phases (user_id, name, position) values
    (new.id, 'Foundation', 0),
    (new.id, 'Phase 1', 1),
    (new.id, 'Phase 2', 2),
    (new.id, 'Phase 3', 3),
    (new.id, 'Phase 4', 4)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_questions on public.questions;
drop trigger if exists touch_horses    on public.horses;
drop trigger if exists touch_tqas      on public.tqas;

create trigger touch_questions before update on public.questions
  for each row execute function public.touch_updated_at();
create trigger touch_horses before update on public.horses
  for each row execute function public.touch_updated_at();
create trigger touch_tqas before update on public.tqas
  for each row execute function public.touch_updated_at();
