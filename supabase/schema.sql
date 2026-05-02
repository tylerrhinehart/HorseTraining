-- TQA digitization schema. Run on a fresh Supabase project; this file
-- drops and recreates all app tables and is NOT a migration.
--
-- Mirrors src/content/tqa-template.ts and src/content/trifecta.ts.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Drop existing tables so reruns are clean. Order respects FKs.
-- ---------------------------------------------------------------------------

drop table if exists public.trifecta_scores       cascade;
drop table if exists public.trifecta_evaluations  cascade;
drop table if exists public.ratings               cascade;
drop table if exists public.sessions              cascade;
drop table if exists public.weeks                 cascade;
drop table if exists public.engagements           cascade;
drop table if exists public.resources             cascade;
drop table if exists public.questions             cascade;
drop table if exists public.phases                cascade;
drop table if exists public.horses                cascade;
drop table if exists public.riders                cascade;
drop table if exists public.profiles              cascade;
drop table if exists public.tqas                  cascade;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.riders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  role text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index riders_user_idx on public.riders(user_id);

create table public.horses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  breed text,
  dob date,
  sex text,
  color text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index horses_user_idx on public.horses(user_id);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  horse_id uuid not null references public.horses on delete cascade,
  owner_name text,
  owner_info text,
  owner_email text,
  payment_method text,
  payment_amount numeric(10, 2),
  arrival_date date,
  departure_date date,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index engagements_horse_idx on public.engagements(horse_id, arrival_date desc);
create index engagements_user_idx on public.engagements(user_id);

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  code text not null check (code in ('groundwork','phase_1','phase_2','phase_3','phase_4')),
  position int not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, code),
  unique (user_id, position)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  phase_id uuid not null references public.phases on delete cascade,
  axis text not null check (axis in ('foundation','temperament')),
  position int not null,
  text text not null,
  low_label text not null,
  high_label text not null,
  created_at timestamptz not null default now(),
  unique (phase_id, axis, position)
);

create index questions_phase_idx on public.questions(phase_id);

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  engagement_id uuid not null references public.engagements on delete cascade,
  week_number int not null check (week_number >= 1),
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, week_number)
);

create index weeks_engagement_idx on public.weeks(engagement_id, week_number);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  engagement_id uuid not null references public.engagements on delete cascade,
  week_id uuid not null references public.weeks on delete cascade,
  horse_id uuid not null references public.horses on delete cascade,
  phase_id uuid not null references public.phases on delete restrict,
  rider_id uuid references public.riders on delete set null,
  occurred_at timestamptz not null default now(),
  session_number int check (session_number between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_week_idx on public.sessions(week_id, session_number);
create index sessions_horse_idx on public.sessions(horse_id, occurred_at desc);
create index sessions_engagement_idx on public.sessions(engagement_id, occurred_at desc);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  session_id uuid not null references public.sessions on delete cascade,
  question_id uuid not null references public.questions on delete restrict,
  axis_snapshot text not null check (axis_snapshot in ('foundation','temperament')),
  question_text_snapshot text not null,
  score smallint not null check (score between -3 and 3),
  comment text,
  unique (session_id, question_id)
);

create index ratings_session_idx on public.ratings(session_id);
create index ratings_question_idx on public.ratings(question_id);

create table public.trifecta_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  engagement_id uuid not null references public.engagements on delete cascade,
  evaluated_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id)
);

create table public.trifecta_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  evaluation_id uuid not null references public.trifecta_evaluations on delete cascade,
  axis text not null check (axis in ('foundation','task_completion','temperament')),
  item_code text not null,
  item_text_snapshot text not null,
  score smallint not null check (score between -3 and 3),
  comment text,
  unique (evaluation_id, axis, item_code)
);

create index trifecta_scores_eval_idx on public.trifecta_scores(evaluation_id);

create table public.resources (
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
  constraint resources_target_check check (
    (phase_id is not null and question_id is null)
    or (phase_id is null and question_id is not null)
  )
);

create index resources_phase_idx on public.resources(phase_id);
create index resources_question_idx on public.resources(question_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — own-rows on every table.
-- ---------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.riders                enable row level security;
alter table public.horses                enable row level security;
alter table public.engagements           enable row level security;
alter table public.phases                enable row level security;
alter table public.questions             enable row level security;
alter table public.weeks                 enable row level security;
alter table public.sessions              enable row level security;
alter table public.ratings               enable row level security;
alter table public.trifecta_evaluations  enable row level security;
alter table public.trifecta_scores       enable row level security;
alter table public.resources             enable row level security;

create policy "own profile"     on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own riders"      on public.riders for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own horses"      on public.horses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own engagements" on public.engagements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own phases"      on public.phases for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own questions"   on public.questions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own weeks"       on public.weeks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own sessions"    on public.sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own ratings"     on public.ratings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own trifecta_evaluations" on public.trifecta_evaluations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own trifecta_scores"      on public.trifecta_scores for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own resources"   on public.resources for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at maintenance.
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

create trigger touch_riders                before update on public.riders                for each row execute function public.touch_updated_at();
create trigger touch_horses                before update on public.horses                for each row execute function public.touch_updated_at();
create trigger touch_engagements           before update on public.engagements           for each row execute function public.touch_updated_at();
create trigger touch_weeks                 before update on public.weeks                 for each row execute function public.touch_updated_at();
create trigger touch_sessions              before update on public.sessions              for each row execute function public.touch_updated_at();
create trigger touch_trifecta_evaluations  before update on public.trifecta_evaluations  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Canonical template seed: profile + 5 phases + 70 questions verbatim.
--
-- This block is the SQL counterpart of src/content/tqa-template.ts. Keep
-- the two in sync if either is edited. The function is idempotent — it
-- skips users who already have phases — so it can also be used to backfill
-- existing accounts after a schema reset.
-- ---------------------------------------------------------------------------

create or replace function public.seed_canonical_template(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gw_id  uuid;
  p1_id  uuid;
  p2_id  uuid;
  p3_id  uuid;
  p4_id  uuid;
  existing_phase_count int;
begin
  insert into public.profiles (id) values (p_user_id) on conflict do nothing;

  select count(*) into existing_phase_count from public.phases where user_id = p_user_id;
  if existing_phase_count > 0 then
    return;
  end if;

  insert into public.phases (user_id, code, position, name) values
    (p_user_id, 'groundwork', 0, 'Groundwork'),
    (p_user_id, 'phase_1',    1, 'Phase 1'),
    (p_user_id, 'phase_2',    2, 'Phase 2'),
    (p_user_id, 'phase_3',    3, 'Phase 3'),
    (p_user_id, 'phase_4',    4, 'Phase 4');

  select id into gw_id from public.phases where user_id = p_user_id and code = 'groundwork';
  select id into p1_id from public.phases where user_id = p_user_id and code = 'phase_1';
  select id into p2_id from public.phases where user_id = p_user_id and code = 'phase_2';
  select id into p3_id from public.phases where user_id = p_user_id and code = 'phase_3';
  select id into p4_id from public.phases where user_id = p_user_id and code = 'phase_4';

  -- Foundation rows (8 per phase, 40 total).
  insert into public.questions (user_id, phase_id, axis, position, text, low_label, high_label) values
    -- Groundwork
    (p_user_id, gw_id, 'foundation', 0, 'Good to catch', 'Did Not Complete', 'Mastered'),
    (p_user_id, gw_id, 'foundation', 1, 'Stage 1 w/ Willing Submission (in a crisis, standing & walking)', 'Did Not Complete', 'Mastered'),
    (p_user_id, gw_id, 'foundation', 2, 'Horizontal Direction (standing & walking)', 'Did Not Complete', 'Mastered'),
    (p_user_id, gw_id, 'foundation', 3, 'Stage 2 w/ Willing Submission', 'Did Not Complete', 'Mastered'),
    (p_user_id, gw_id, 'foundation', 4, 'Stage 3 w/ Willing Submission', 'Did Not Complete', 'Mastered'),
    (p_user_id, gw_id, 'foundation', 5, 'Stage 4 w/ Willing Submission', 'Did Not Complete', 'Mastered'),
    (p_user_id, gw_id, 'foundation', 6, 'Lead w/ Willing Submission and Respect', 'Did Not Complete', 'Mastered'),
    (p_user_id, gw_id, 'foundation', 7, 'Pick up feet', 'Did Not Complete', 'Mastered'),
    -- Phase 1
    (p_user_id, p1_id, 'foundation', 0, 'Good to Catch (Review Groundwork)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p1_id, 'foundation', 1, 'Stand to Saddle and Accept Bridle', 'Did Not Complete', 'Mastered'),
    (p_user_id, p1_id, 'foundation', 2, 'Horizontal Direction & Stage 1 (on the ground, in and away from you)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p1_id, 'foundation', 3, 'Horizontal Direction & Stage 1 (on their side and on their back)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p1_id, 'foundation', 4, 'Stand to Get On', 'Did Not Complete', 'Mastered'),
    (p_user_id, p1_id, 'foundation', 5, 'Doubling Walking, Trotting and Loping (revelation w/in 3 steps from initial cue)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p1_id, 'foundation', 6, 'Move Out Soft In a Lope', 'Did Not Complete', 'Mastered'),
    (p_user_id, p1_id, 'foundation', 7, 'Stage 2 w/ Willing Submission (standing)', 'Did Not Complete', 'Mastered'),
    -- Phase 2
    (p_user_id, p2_id, 'foundation', 0, 'Review groundwork, Stand to Saddle, Accept Bridle (Prepare for rope, Stage 1 w/ Snaffle)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p2_id, 'foundation', 1, 'Horizontal Direction & Stage 1 (on the ground)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p2_id, 'foundation', 2, 'Stand to get on, Horizontal Direction & Stage 1 (on their side and on their back)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p2_id, 'foundation', 3, 'Doubling Walking, Trotting and Loping', 'Did Not Complete', 'Mastered'),
    (p_user_id, p2_id, 'foundation', 4, 'Stage 2 w/ Willing Submission (standing & walking)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p2_id, 'foundation', 5, 'Lope in a straight line outside', 'Did Not Complete', 'Mastered'),
    (p_user_id, p2_id, 'foundation', 6, 'Stage 3 w/ Willing Submission (on fence)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p2_id, 'foundation', 7, 'Horizontal Direction (walk and slow trot)', 'Did Not Complete', 'Mastered'),
    -- Phase 3
    (p_user_id, p3_id, 'foundation', 0, 'Review Ground Work & Phase 1 — Stage 1 & HD Standing, Double (Walk, Trot, Lope)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p3_id, 'foundation', 1, 'Lope in a Straight Line Outside', 'Did Not Complete', 'Mastered'),
    (p_user_id, p3_id, 'foundation', 2, 'Horizontal Direction (Slow and Extended Trot)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p3_id, 'foundation', 3, 'Stage 2 w/ Willing Submission (standing, walking, trotting)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p3_id, 'foundation', 4, 'Stage 3 w/ Willing Submission (open/close gate)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p3_id, 'foundation', 5, 'Stage 3 and 4 w/ Willing Submission (on fence)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p3_id, 'foundation', 6, 'Vertical Direction (walking and slow trot)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p3_id, 'foundation', 7, 'Accept Rope, Drag Log, Track Dummy — track cow if available', 'Did Not Complete', 'Mastered'),
    -- Phase 4
    (p_user_id, p4_id, 'foundation', 0, 'Review: Groundwork & Phase 1 — TQA Sale Horse Warm Up, or Ranch Horse Reality', 'Did Not Complete', 'Mastered'),
    (p_user_id, p4_id, 'foundation', 1, 'Horizontal Direction (standing, walking, trotting, loping)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p4_id, 'foundation', 2, 'Stage 2 w/ Willing Submission (standing, walking, trotting, loping)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p4_id, 'foundation', 3, 'Stage 3 w/ Willing Submission (not using fence)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p4_id, 'foundation', 4, 'Stage 4 w/ Willing Submission (HD into Stage 4, inside leg/outside leg)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p4_id, 'foundation', 5, 'Roll Backs on Fence (whatever speed you can do it correct)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p4_id, 'foundation', 6, 'Vertical Direction (walk, slow & extended trot)', 'Did Not Complete', 'Mastered'),
    (p_user_id, p4_id, 'foundation', 7, 'Drag & Rope Dummy (show 4 stages w/ WS & VD) — track and rope cow if available', 'Did Not Complete', 'Mastered');

  -- Temperament rows (6 per phase, 30 total).
  -- Groundwork order: Self-pres, Confidence, Willingness, Reaction-to-social-sep, Energy, Sensitivity.
  insert into public.questions (user_id, phase_id, axis, position, text, low_label, high_label) values
    (p_user_id, gw_id, 'temperament', 0, 'Self-preservation (fight or flight)',           'High',      'Low'),
    (p_user_id, gw_id, 'temperament', 1, 'Confidence',                                    'Low',       'High'),
    (p_user_id, gw_id, 'temperament', 2, 'Willingness (response to request)',             'Resistant', 'Willing'),
    (p_user_id, gw_id, 'temperament', 3, 'Reaction to social separation',                 'Calm',      'Nervous'),
    (p_user_id, gw_id, 'temperament', 4, 'Energy (motivation and determination)',         'Low',       'High'),
    (p_user_id, gw_id, 'temperament', 5, 'Sensitivity (response to light pressure)',      'Dull',      'Very Responsive');

  -- Phases 1–4: standard order Self-pres, Confidence, Energy, Sensitivity, Willingness, Reaction-to-social-sep.
  for i in 1..4 loop
    insert into public.questions (user_id, phase_id, axis, position, text, low_label, high_label)
    select p_user_id,
           case i
             when 1 then p1_id when 2 then p2_id when 3 then p3_id when 4 then p4_id
           end,
           'temperament', pos, txt, lo, hi
    from (values
      (0, 'Self-preservation (fight or flight)',           'High',      'Low'),
      (1, 'Confidence',                                    'Low',       'High'),
      (2, 'Energy (motivation and determination)',         'Low',       'High'),
      (3, 'Sensitivity (response to light pressure)',      'Dull',      'Very Responsive'),
      (4, 'Willingness (response to request)',             'Resistant', 'Willing'),
      (5, 'Reaction to social separation',                 'Calm',      'Nervous')
    ) as t(pos, txt, lo, hi);
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_canonical_template(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill: seed any existing auth.users that lack phases. Safe to re-run.
-- ---------------------------------------------------------------------------

do $$
declare
  u record;
begin
  for u in
    select id from auth.users
    where not exists (select 1 from public.phases p where p.user_id = auth.users.id)
  loop
    perform public.seed_canonical_template(u.id);
  end loop;
end $$;
