-- TQA facility-owned schema. Initialize a fresh Supabase database only.
-- One transaction; existing app tables cause an error, never a drop or wipe.
begin;

create extension if not exists "pgcrypto";

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active','suspended')),
  voice_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.facility_memberships (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','trainer')),
  created_at timestamptz not null default now(),
  primary key (facility_id,user_id)
);
create index facility_memberships_user_idx on public.facility_memberships(user_id,facility_id);
create table public.facility_invitations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','trainer')),
  token_hash bytea not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);
create index facility_invitations_pending_idx on public.facility_invitations(facility_id,email)
  where redeemed_at is null and revoked_at is null;
create table public.facility_creation_requests (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  requested_name text not null,
  primary key (actor_id, request_id)
);
create table public.platform_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.platform_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  action text not null,
  reason text not null,
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.facilities enable row level security;
alter table public.facility_memberships enable row level security;
alter table public.facility_invitations enable row level security;
alter table public.facility_creation_requests enable row level security;
alter table public.platform_super_admins enable row level security;
alter table public.platform_audit_log enable row level security;
revoke all on public.facilities, public.facility_memberships, public.facility_invitations,
  public.facility_creation_requests, public.platform_super_admins, public.platform_audit_log from public, anon, authenticated;
grant select on public.facilities, public.facility_memberships to authenticated;

create function public.has_facility_access(p_facility_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.facility_memberships m
    join public.facilities f on f.id = m.facility_id
    where m.facility_id = p_facility_id and m.user_id = auth.uid()
      and f.status = 'active');
$$;
create function public.is_facility_manager(p_facility_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_facility_access(p_facility_id)
    and exists (select 1 from public.facility_memberships m
      where m.facility_id = p_facility_id and m.user_id = auth.uid()
        and m.role in ('owner','admin'));
$$;
revoke all on function public.has_facility_access(uuid), public.is_facility_manager(uuid) from public, anon;
grant execute on function public.has_facility_access(uuid), public.is_facility_manager(uuid) to authenticated;
create policy facility_read on public.facilities for select to authenticated
  using (id in (select m.facility_id from public.facility_memberships m where m.user_id = auth.uid()));
create policy memberships_read on public.facility_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_facility_manager(facility_id));

-- Serialize domain writes against facility suspension and membership changes.
create function public.lock_facility_access(p_facility_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.facilities where id=p_facility_id and status='active' for share;
  if not found or not public.has_facility_access(p_facility_id) then
    raise exception 'Facility not found or unavailable' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.lock_facility_access(uuid) from public, anon;
grant execute on function public.lock_facility_access(uuid) to authenticated;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- phases is defined before horses so that horses.current_phase_id can
-- reference it without a forward-reference issue.
create table public.phases (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  user_id uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  -- code is now program-scoped free text (e.g. 'groundwork', 'performance_warmup').
  code text not null,
  program text not null default 'foundation'
    check (program in ('foundation','foundation_to_finish','sale_horse')),
  -- scoring scale for this phase's questions: 'tqa' (−3…+3) or 'five' (1…5).
  scale text not null default 'tqa' check (scale in ('tqa','five')),
  position int not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (facility_id, id),
  unique (facility_id, program, code),
  unique (facility_id, program, position)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  user_id uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  phase_id uuid not null,
  foreign key (facility_id, phase_id) references public.phases(facility_id,id) on delete cascade,
  axis text not null check (axis in ('foundation','temperament')),
  position int not null,
  text text not null,
  low_label text not null,
  high_label text not null,
  created_at timestamptz not null default now(),
  unique (facility_id, id),
  unique (phase_id, axis, position)
);

create index questions_phase_idx on public.questions(phase_id);

create table public.horses (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  user_id uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  name text not null,
  breed text,
  dob date,
  sex text,
  color text,
  notes text,
  -- fields relocated from engagements:
  owner_name text,
  owner_contact text,
  arrival_date date,
  status text not null default 'in_training' check (status in ('in_training','complete','archived')),
  -- which program / set of score sheets this horse follows:
  training_type text not null default 'foundation'
    check (training_type in ('foundation','foundation_to_finish','sale_horse')),
  -- sale-horse target framing etc.: { target_market, price_low, price_high }
  program_meta jsonb not null default '{}'::jsonb,
  current_phase_id uuid,
  foreign key (facility_id, current_phase_id) references public.phases(facility_id,id) on delete set null (current_phase_id),
  -- existing tail:
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, id)
);

create index horses_facility_idx on public.horses(facility_id);
create index horses_status_idx on public.horses(facility_id, status);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  user_id uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  horse_id uuid not null,
  foreign key (facility_id, horse_id) references public.horses(facility_id,id) on delete cascade,
  phase_id uuid not null,
  foreign key (facility_id, phase_id) references public.phases(facility_id,id) on delete restrict,
  occurred_at timestamptz not null default now(),
  notes text,
  -- performance/sale programs only:
  rider text,
  bit text,
  task_completions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, id)
);

create index sessions_horse_idx on public.sessions(horse_id, occurred_at desc);
create index sessions_phase_idx on public.sessions(phase_id);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  user_id uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  session_id uuid not null,
  foreign key (facility_id, session_id) references public.sessions(facility_id,id) on delete cascade,
  question_id uuid not null,
  foreign key (facility_id, question_id) references public.questions(facility_id,id) on delete restrict,
  axis_snapshot text not null check (axis_snapshot in ('foundation','temperament')),
  question_text_snapshot text not null,
  -- −3…+3 on the TQA scale, or 1…5 on the performance scale.
  score smallint not null check (score between -3 and 5),
  comment text,
  unique (session_id, question_id)
);

create index ratings_session_idx on public.ratings(session_id);
create index ratings_question_idx on public.ratings(question_id);

create table public.trifecta_evaluations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  user_id uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  horse_id uuid not null,
  foreign key (facility_id, horse_id) references public.horses(facility_id,id) on delete cascade,
  evaluated_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, id),
  unique (horse_id)
);

create table public.trifecta_scores (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  user_id uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  evaluation_id uuid not null,
  foreign key (facility_id, evaluation_id) references public.trifecta_evaluations(facility_id,id) on delete cascade,
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
  facility_id uuid not null references public.facilities(id) on delete restrict,
  user_id uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  phase_id uuid,
  foreign key (facility_id, phase_id) references public.phases(facility_id,id) on delete cascade,
  question_id uuid,
  foreign key (facility_id, question_id) references public.questions(facility_id,id) on delete cascade,
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
-- Row Level Security: actor-owned profile, facility-owned domain records.
-- ---------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.horses                enable row level security;
alter table public.phases                enable row level security;
alter table public.questions             enable row level security;
alter table public.sessions              enable row level security;
alter table public.ratings               enable row level security;
alter table public.trifecta_evaluations  enable row level security;
alter table public.trifecta_scores       enable row level security;
alter table public.resources             enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select, update(display_name) on public.profiles to authenticated;
create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Domain reads/writes always start with active membership. Keep reference and
-- template catalogs read-only to ordinary members, editable only by managers where allowed.
do $$
declare tbl text;
begin
  foreach tbl in array array['horses','phases','questions','sessions','ratings',
    'trifecta_evaluations','trifecta_scores','resources'] loop
    execute format('revoke all on public.%I from public, anon, authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('create policy facility_read on public.%I for select to authenticated
      using (public.has_facility_access(facility_id))',tbl);
    if tbl not in ('phases','questions') then
      execute format('grant insert, update, delete on public.%I to authenticated',tbl);
      if tbl = 'resources' then
        execute format('create policy facility_write on public.%I for all to authenticated
          using (public.is_facility_manager(facility_id)) with check (public.is_facility_manager(facility_id))',tbl);
      else
        execute format('create policy facility_write on public.%I for all to authenticated
          using (public.has_facility_access(facility_id)) with check (public.has_facility_access(facility_id))',tbl);
      end if;
    end if;
  end loop;
end $$;

-- Enforce attribution on writes; facility IDs cannot be moved even if the actor
-- belongs to both facilities. FK SET NULL on account deletion preserves rows.
create function public.guard_facility_attribution() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Foreign-key maintenance uses nested triggers and must be able to remove
  -- obsolete attribution after an Auth account is deleted.
  if tg_op = 'UPDATE' and (new.facility_id is distinct from old.facility_id
    or (new.user_id is distinct from old.user_id
        and not (new.user_id is null and pg_trigger_depth() > 1))) then
    raise exception 'Facility and author are immutable';
  end if;
  if auth.uid() is not null and pg_trigger_depth() = 1 then
    if tg_op = 'DELETE' then
      perform public.lock_facility_access(old.facility_id);
      if tg_table_name='resources' and not public.is_facility_manager(old.facility_id) then
        raise exception 'Only a facility manager may manage resources' using errcode='42501';
      end if;
      return old;
    end if;
    perform public.lock_facility_access(new.facility_id);
    if tg_table_name='resources' and not public.is_facility_manager(new.facility_id) then
      raise exception 'Only a facility manager may manage resources' using errcode='42501';
    end if;
    if tg_op = 'INSERT' then new.user_id := auth.uid(); end if;
    new.updated_by := auth.uid();
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
do $$ declare tbl text; begin
  foreach tbl in array array['horses','phases','questions','sessions','ratings',
    'trifecta_evaluations','trifecta_scores','resources'] loop
    execute format('create trigger guard_facility_attribution before insert or update or delete on public.%I
      for each row execute function public.guard_facility_attribution()',tbl);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- updated_at maintenance.
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

create trigger touch_horses                before update on public.horses                for each row execute function public.touch_updated_at();
create trigger touch_sessions              before update on public.sessions              for each row execute function public.touch_updated_at();
create trigger touch_trifecta_evaluations  before update on public.trifecta_evaluations  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Canonical template seed: Foundation phases/questions, the
-- Performance Horse Warm-Up for the two performance programs, and the
-- Foundation phase videos.
--
-- This block is the SQL counterpart of src/content/tqa-template.ts and
-- src/content/performance-template.ts. Keep them in sync if either is edited.
-- Idempotent for a facility; called only during verified facility creation.
-- ---------------------------------------------------------------------------

create or replace function public.seed_canonical_template(p_facility_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gw_id  uuid;
  p1_id  uuid;
  p2_id  uuid;
  p3_id  uuid;
  p4_id  uuid;
  f2f_id uuid;
  sale_id uuid;
  existing_phase_count int;
begin
  select count(*) into existing_phase_count from public.phases where facility_id = p_facility_id;
  if existing_phase_count > 0 then
    return;
  end if;

  insert into public.phases (facility_id, code, position, name) values
    (p_facility_id, 'groundwork', 0, 'Groundwork'),
    (p_facility_id, 'phase_1',    1, 'Phase 1'),
    (p_facility_id, 'phase_2',    2, 'Phase 2'),
    (p_facility_id, 'phase_3',    3, 'Phase 3'),
    (p_facility_id, 'phase_4',    4, 'Phase 4');

  select id into gw_id from public.phases where facility_id = p_facility_id and code = 'groundwork';
  select id into p1_id from public.phases where facility_id = p_facility_id and code = 'phase_1';
  select id into p2_id from public.phases where facility_id = p_facility_id and code = 'phase_2';
  select id into p3_id from public.phases where facility_id = p_facility_id and code = 'phase_3';
  select id into p4_id from public.phases where facility_id = p_facility_id and code = 'phase_4';

  -- Foundation rows (8 per phase, 40 total).
  insert into public.questions (facility_id, phase_id, axis, position, text, low_label, high_label) values
    -- Groundwork
    (p_facility_id, gw_id, 'foundation', 0, 'Good to catch', 'Did Not Complete', 'Mastered'),
    (p_facility_id, gw_id, 'foundation', 1, 'Stage 1 w/ Willing Submission (in a crisis, standing & walking)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, gw_id, 'foundation', 2, 'Horizontal Direction (standing & walking)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, gw_id, 'foundation', 3, 'Stage 2 w/ Willing Submission', 'Did Not Complete', 'Mastered'),
    (p_facility_id, gw_id, 'foundation', 4, 'Stage 3 w/ Willing Submission', 'Did Not Complete', 'Mastered'),
    (p_facility_id, gw_id, 'foundation', 5, 'Stage 4 w/ Willing Submission', 'Did Not Complete', 'Mastered'),
    (p_facility_id, gw_id, 'foundation', 6, 'Lead w/ Willing Submission and Respect', 'Did Not Complete', 'Mastered'),
    (p_facility_id, gw_id, 'foundation', 7, 'Pick up feet', 'Did Not Complete', 'Mastered'),
    -- Phase 1
    (p_facility_id, p1_id, 'foundation', 0, 'Good to Catch (Review Groundwork)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p1_id, 'foundation', 1, 'Stand to Saddle and Accept Bridle', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p1_id, 'foundation', 2, 'Horizontal Direction & Stage 1 (on the ground, in and away from you)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p1_id, 'foundation', 3, 'Horizontal Direction & Stage 1 (on their side and on their back)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p1_id, 'foundation', 4, 'Stand to Get On', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p1_id, 'foundation', 5, 'Doubling Walking, Trotting and Loping (revelation w/in 3 steps from initial cue)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p1_id, 'foundation', 6, 'Move Out Soft In a Lope', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p1_id, 'foundation', 7, 'Stage 2 w/ Willing Submission (standing)', 'Did Not Complete', 'Mastered'),
    -- Phase 2
    (p_facility_id, p2_id, 'foundation', 0, 'Review groundwork, Stand to Saddle, Accept Bridle (Prepare for rope, Stage 1 w/ Snaffle)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p2_id, 'foundation', 1, 'Horizontal Direction & Stage 1 (on the ground)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p2_id, 'foundation', 2, 'Stand to get on, Horizontal Direction & Stage 1 (on their side and on their back)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p2_id, 'foundation', 3, 'Doubling Walking, Trotting and Loping', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p2_id, 'foundation', 4, 'Stage 2 w/ Willing Submission (standing & walking)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p2_id, 'foundation', 5, 'Lope in a straight line outside', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p2_id, 'foundation', 6, 'Stage 3 w/ Willing Submission (on fence)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p2_id, 'foundation', 7, 'Horizontal Direction (walk and slow trot)', 'Did Not Complete', 'Mastered'),
    -- Phase 3
    (p_facility_id, p3_id, 'foundation', 0, 'Review Ground Work & Phase 1 — Stage 1 & HD Standing, Double (Walk, Trot, Lope)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p3_id, 'foundation', 1, 'Lope in a Straight Line Outside', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p3_id, 'foundation', 2, 'Horizontal Direction (Slow and Extended Trot)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p3_id, 'foundation', 3, 'Stage 2 w/ Willing Submission (standing, walking, trotting)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p3_id, 'foundation', 4, 'Stage 3 w/ Willing Submission (open/close gate)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p3_id, 'foundation', 5, 'Stage 3 and 4 w/ Willing Submission (on fence)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p3_id, 'foundation', 6, 'Vertical Direction (walking and slow trot)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p3_id, 'foundation', 7, 'Accept Rope, Drag Log, Track Dummy — track cow if available', 'Did Not Complete', 'Mastered'),
    -- Phase 4
    (p_facility_id, p4_id, 'foundation', 0, 'Review: Groundwork & Phase 1 — TQA Sale Horse Warm Up, or Ranch Horse Reality', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p4_id, 'foundation', 1, 'Horizontal Direction (standing, walking, trotting, loping)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p4_id, 'foundation', 2, 'Stage 2 w/ Willing Submission (standing, walking, trotting, loping)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p4_id, 'foundation', 3, 'Stage 3 w/ Willing Submission (not using fence)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p4_id, 'foundation', 4, 'Stage 4 w/ Willing Submission (HD into Stage 4, inside leg/outside leg)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p4_id, 'foundation', 5, 'Roll Backs on Fence (whatever speed you can do it correct)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p4_id, 'foundation', 6, 'Vertical Direction (walk, slow & extended trot)', 'Did Not Complete', 'Mastered'),
    (p_facility_id, p4_id, 'foundation', 7, 'Drag & Rope Dummy (show 4 stages w/ WS & VD) — track and rope cow if available', 'Did Not Complete', 'Mastered');

  -- Temperament rows (6 per phase, 30 total).
  -- Groundwork order: Self-pres, Confidence, Willingness, Reaction-to-social-sep, Energy, Sensitivity.
  insert into public.questions (facility_id, phase_id, axis, position, text, low_label, high_label) values
    (p_facility_id, gw_id, 'temperament', 0, 'Self-preservation (fight or flight)',           'High',      'Low'),
    (p_facility_id, gw_id, 'temperament', 1, 'Confidence',                                    'Low',       'High'),
    (p_facility_id, gw_id, 'temperament', 2, 'Willingness (response to request)',             'Resistant', 'Willing'),
    (p_facility_id, gw_id, 'temperament', 3, 'Reaction to social separation',                 'Calm',      'Nervous'),
    (p_facility_id, gw_id, 'temperament', 4, 'Energy (motivation and determination)',         'Low',       'High'),
    (p_facility_id, gw_id, 'temperament', 5, 'Sensitivity (response to light pressure)',      'Dull',      'Very Responsive');

  -- Phases 1–4: standard order Self-pres, Confidence, Energy, Sensitivity, Willingness, Reaction-to-social-sep.
  for i in 1..4 loop
    insert into public.questions (facility_id, phase_id, axis, position, text, low_label, high_label)
    select p_facility_id,
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

  -- -------------------------------------------------------------------------
  -- Foundation phase videos (per Wade Black's email). Phase-level resources.
  -- -------------------------------------------------------------------------
  insert into public.resources (facility_id, phase_id, title, url, kind, position) values
    (p_facility_id, gw_id, 'Groundwork video', 'https://youtu.be/QUP5XSe73oo', 'youtube', 0),
    (p_facility_id, p1_id, 'Phase 1 video',    'https://youtu.be/97rDdcw5SJQ', 'youtube', 0),
    (p_facility_id, p2_id, 'Phase 2 video',    'https://youtu.be/xvORqrG1BNY', 'youtube', 0),
    (p_facility_id, p3_id, 'Phase 3 video',    'https://youtu.be/Je5RaMkXZPE', 'youtube', 0),
    (p_facility_id, p4_id, 'Phase 4 video',    'https://www.youtube.com/watch?v=nFd0WHDvMPk', 'youtube', 0);

  -- -------------------------------------------------------------------------
  -- Performance Horse Warm-Up — one phase each for the Foundation to Finish
  -- and Sale Horse programs. Scored 1…5. Verbatim from the TQA All-Around
  -- Performance Horse Warm-Up sheet (mirrors src/content/performance-template.ts).
  -- -------------------------------------------------------------------------
  insert into public.phases (facility_id, code, program, scale, position, name) values
    (p_facility_id, 'performance_warmup', 'foundation_to_finish', 'five', 0, 'Performance Horse Warm-Up'),
    (p_facility_id, 'performance_warmup', 'sale_horse',           'five', 0, 'Performance Horse Warm-Up');

  select id into f2f_id  from public.phases where facility_id = p_facility_id and program = 'foundation_to_finish' and code = 'performance_warmup';
  select id into sale_id from public.phases where facility_id = p_facility_id and program = 'sale_horse'           and code = 'performance_warmup';

  insert into public.questions (facility_id, phase_id, axis, position, text, low_label, high_label)
  select p_facility_id, pid, axis, pos, txt, lo, hi
  from (select unnest(array[f2f_id, sale_id]) as pid) phases
  cross join (values
    ('foundation',  0, 'Ground Work & Phase 1 Review', 'Very Poor', 'Excellent'),
    ('foundation',  1, 'HD & Stage 4 (Inside -> Outside Rein) — Snake Trails (Walk, Slow & Extended Trot, Lope)', 'Very Poor', 'Excellent'),
    ('foundation',  2, 'Vertical & Horizontal Direction — Walking, Slow Trot, Extended Trot, Loping', 'Very Poor', 'Excellent'),
    ('foundation',  3, 'Large Fasts and Small Slows — w/ Willing Submission and Vertical Direction', 'Very Poor', 'Excellent'),
    ('foundation',  4, 'Stage 2 w/ Willing Submission & Vertical Direction — Standing, Walking, Jigging, Trotting, Loping', 'Very Poor', 'Excellent'),
    ('foundation',  5, 'Stage 3 w/ Willing Submission & Vertical Direction — Standing, Walking, Jigging, Trotting, Loping', 'Very Poor', 'Excellent'),
    ('foundation',  6, 'Stage 4 w/ Willing Submission & Vertical Direction — Standing, Walking, Trotting, Rollbacks and Spins', 'Very Poor', 'Excellent'),
    ('foundation',  7, 'Task Completion — Select the jobs and phases worked today', 'Very Poor', 'Excellent'),
    ('temperament', 0, 'Self-preservation (fight or flight)',           'Low',       'High'),
    ('temperament', 1, 'Confidence',                                    'Low',       'High'),
    ('temperament', 2, 'Sensitivity (response to light pressure)',      'Dull',      'Very Responsive'),
    ('temperament', 3, 'Energy (motivation and determination)',         'Low',       'High'),
    ('temperament', 4, 'Willingness (response to request)',             'Resistant', 'Willing'),
    ('temperament', 5, 'Reaction to social separation',                 'Calm',      'Nervous')
  ) as q(axis, pos, txt, lo, hi);

  -- Official source document for the performance programs (holds the score
  -- sheet plus the warm-up videos). Titled "Foundation to Finish / Performance
  -- Horse" per Wade's request, not "TQA Warm-Up".
  insert into public.resources (facility_id, phase_id, title, url, kind, notes, position)
  select p_facility_id, pid,
         'Foundation to Finish — Performance Horse score sheets & warm-up videos',
         'https://www.dropbox.com/scl/fi/4mbij1k3aj6f06wga4p8g/Sale-Horse-Ready-2024-All-Around-Performance-Horse.docx?rlkey=1iu0ofhaidt19d10k5ga4fedb&st=v603gncc&dl=0',
         'link',
         'Official document with the Performance Horse task-completion phases and warm-up. Warm-up video segments: Introduction, Ground Work, First Get On, Review of Vocab Words, Reining Cow Horse Warm-Up.',
         0
  from (select unnest(array[f2f_id, sale_id]) as pid) phases;
end;
$$;

revoke all on function public.seed_canonical_template(uuid) from public, anon, authenticated;

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Verified email comes from Auth, not editable JWT user metadata.
create function public.verified_facility_email() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_email text;
begin
  select lower(btrim(u.email)) into v_email from auth.users u
  where u.id=auth.uid() and u.email_confirmed_at is not null;
  if coalesce(v_email,'') = '' then
    raise exception 'Verify your email first' using errcode='42501';
  end if;
  return v_email;
end;
$$;
revoke all on function public.verified_facility_email() from public, anon, authenticated;

create function public.create_facility(p_name text,p_request_id uuid default null) returns public.facilities
language plpgsql security definer set search_path = '' as $$
declare v_row public.facilities; v_actor uuid := auth.uid();
  v_request public.facility_creation_requests; v_name text := btrim(p_name);
begin
  perform public.verified_facility_email();
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || p_request_id::text, 0));
    select * into v_request from public.facility_creation_requests
      where actor_id=v_actor and request_id=p_request_id;
    if found then
      if v_request.requested_name is distinct from v_name then
        raise exception 'Facility creation request ID reused with different details';
      end if;
      if not exists(select 1 from public.facility_memberships
        where facility_id=v_request.facility_id and user_id=v_actor) then
        raise exception 'Facility not found or unavailable' using errcode='42501';
      end if;
      select * into v_row from public.facilities where id=v_request.facility_id;
      return v_row;
    end if;
  end if;
  insert into public.facilities(name) values (v_name) returning * into v_row;
  insert into public.facility_memberships(facility_id,user_id,role)
    values(v_row.id,v_actor,'owner');
  perform public.seed_canonical_template(v_row.id);
  if p_request_id is not null then
    insert into public.facility_creation_requests(actor_id,request_id,facility_id,requested_name)
      values(v_actor,p_request_id,v_row.id,v_name);
  end if;
  return v_row;
end;
$$;

create function public.create_facility_invite(p_facility_id uuid,p_email text,p_role text default 'trainer')
returns text language plpgsql security definer set search_path = '' as $$
declare v_role text; v_email text := lower(btrim(p_email));
  v_token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
begin
  perform 1 from public.facilities where id=p_facility_id and status='active' for update;
  if not found then raise exception 'Facility not found or unavailable' using errcode='42501'; end if;
  select m.role into v_role from public.facility_memberships m where m.facility_id=p_facility_id and m.user_id=auth.uid();
  if not coalesce(v_role='owner' or (v_role='admin' and p_role='trainer'),false) then
    raise exception 'Not permitted to invite this role' using errcode='42501';
  end if;
  if p_role is null or p_role not in ('admin','trainer') or v_email is null
    or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Use a valid email and invitation role';
  end if;
  if exists (select 1 from public.facility_memberships m join auth.users u on u.id=m.user_id
      where m.facility_id=p_facility_id and lower(btrim(u.email))=v_email) then
    raise exception 'This account already belongs to the facility';
  end if;
  -- Admins must not be able to revoke an owner-created invitation to admin.
  if v_role='admin' and exists(select 1 from public.facility_invitations i
    where i.facility_id=p_facility_id and i.email=v_email and i.role='admin'
      and i.redeemed_at is null and i.revoked_at is null and i.expires_at>now()) then
    raise exception 'An owner must manage the existing invitation' using errcode='42501';
  end if;
  update public.facility_invitations i set revoked_at=now()
  where i.facility_id=p_facility_id and i.email=v_email
    and i.redeemed_at is null and i.revoked_at is null;
  insert into public.facility_invitations(facility_id,email,role,token_hash,created_by)
    values(p_facility_id,v_email,p_role,sha256(convert_to(v_token,'UTF8')),auth.uid());
  return v_token;
end;
$$;

create function public.redeem_facility_invite(p_token text) returns public.facilities
language plpgsql security definer set search_path = '' as $$
declare v_invite public.facility_invitations; v_row public.facilities;
  v_email text := public.verified_facility_email();
  v_hash bytea;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation is invalid or expired' using errcode='42501';
  end if;
  v_hash := sha256(convert_to(p_token,'UTF8'));
  select * into v_invite from public.facility_invitations where token_hash=v_hash;
  if not found or v_invite.email<>v_email then
    raise exception 'Invitation is invalid or expired' using errcode='42501';
  end if;
  select * into v_row from public.facilities where id=v_invite.facility_id and status='active' for update;
  if not found or not exists(select 1 from public.facility_memberships m
      where m.facility_id=v_row.id and m.user_id=v_invite.created_by and
      (m.role='owner' or (m.role='admin' and v_invite.role='trainer'))) then
    raise exception 'Invitation is invalid or expired' using errcode='42501';
  end if;
  update public.facility_invitations i set redeemed_at=now(), redeemed_by=auth.uid()
    where i.id=v_invite.id and i.expires_at>now() and i.revoked_at is null and i.redeemed_at is null;
  if not found then raise exception 'Invitation is invalid or expired' using errcode='42501'; end if;
  insert into public.facility_memberships(facility_id,user_id,role)
    values(v_row.id,auth.uid(),v_invite.role) on conflict (facility_id,user_id) do nothing;
  return v_row;
end;
$$;

-- Serialize membership changes and refuse orphaning even on Auth user deletion.
create function public.guard_last_facility_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and (new.facility_id<>old.facility_id or new.user_id<>old.user_id) then
    raise exception 'Facility membership identity is immutable';
  end if;
  if old.role='owner' and (tg_op='DELETE' or new.role<>'owner') then
    perform 1 from public.facilities where id=old.facility_id for update;
    if found and not exists(select 1 from public.facility_memberships m
      where m.facility_id=old.facility_id and m.user_id<>old.user_id and m.role='owner') then
      raise exception 'A facility must retain an owner';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_last_facility_owner() from public, anon, authenticated;
create trigger guard_last_facility_owner before update or delete on public.facility_memberships
  for each row execute function public.guard_last_facility_owner();

create function public.set_facility_member_role(p_facility_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.facilities where id=p_facility_id and status='active' for update;
  if not found or not exists(select 1 from public.facility_memberships m
      where m.facility_id=p_facility_id and m.user_id=auth.uid() and m.role='owner') then
    raise exception 'Only a facility owner may change roles' using errcode='42501';
  end if;
  update public.facility_memberships set role=p_role where facility_id=p_facility_id and user_id=p_user_id;
  if not found then raise exception 'Member not found'; end if;
end;
$$;

create function public.remove_facility_member(p_facility_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  perform 1 from public.facilities where id=p_facility_id and status='active' for update;
  if not found then raise exception 'Facility not found or unavailable' using errcode='42501'; end if;
  select m.role into v_role from public.facility_memberships m where m.facility_id=p_facility_id and m.user_id=auth.uid();
  delete from public.facility_memberships m where m.facility_id=p_facility_id and m.user_id=p_user_id
    and (v_role='owner' or (v_role='admin' and m.role='trainer'));
  if not found then raise exception 'Member not found or removal not permitted' using errcode='42501'; end if;
end;
$$;

create function public.platform_is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal'='aal2',false)
    and exists(select 1 from public.platform_super_admins a where a.user_id=auth.uid());
$$;
create function public.platform_list_facilities() returns setof public.facilities
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.platform_is_super_admin() then raise exception 'Platform access requires admin MFA' using errcode='42501'; end if;
  return query select f.* from public.facilities f order by f.created_at desc,f.id;
end;
$$;
create function public.platform_set_facility_controls(p_facility_id uuid,p_status text,p_voice_enabled boolean,p_reason text)
returns public.facilities language plpgsql security definer set search_path = '' as $$
declare v_before public.facilities; v_after public.facilities;
begin
  if not public.platform_is_super_admin() then raise exception 'Platform access requires admin MFA' using errcode='42501'; end if;
  if p_status is null or p_status not in ('active','suspended') or p_voice_enabled is null
    or coalesce(length(btrim(p_reason)),0) not between 1 and 500 then
    raise exception 'Valid status, voice setting and reason are required';
  end if;
  select * into v_before from public.facilities where id=p_facility_id for update;
  if not found then raise exception 'Facility not found'; end if;
  update public.facilities set status=p_status,voice_enabled=p_voice_enabled where id=p_facility_id
    returning * into v_after;
  insert into public.platform_audit_log(actor_id,facility_id,action,reason,before_state,after_state)
  values(auth.uid(),p_facility_id,'set_facility_controls',btrim(p_reason),
    jsonb_build_object('status',v_before.status,'voice_enabled',v_before.voice_enabled),
    jsonb_build_object('status',v_after.status,'voice_enabled',v_after.voice_enabled));
  return v_after;
end;
$$;
create function public.platform_list_facility_audit(p_facility_id uuid)
returns setof public.platform_audit_log language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.platform_is_super_admin() then raise exception 'Platform access requires admin MFA' using errcode='42501'; end if;
  return query select a.* from public.platform_audit_log a where a.facility_id=p_facility_id order by a.id desc limit 100;
end;
$$;

revoke all on function public.create_facility(text,uuid), public.create_facility_invite(uuid,text,text),
  public.redeem_facility_invite(text), public.set_facility_member_role(uuid,uuid,text),
  public.remove_facility_member(uuid,uuid), public.platform_is_super_admin(),
  public.platform_list_facilities(), public.platform_set_facility_controls(uuid,text,boolean,text),
  public.platform_list_facility_audit(uuid) from public, anon;
grant execute on function public.create_facility(text,uuid), public.create_facility_invite(uuid,text,text),
  public.redeem_facility_invite(text), public.set_facility_member_role(uuid,uuid,text),
  public.remove_facility_member(uuid,uuid), public.platform_is_super_admin(),
  public.platform_list_facilities(), public.platform_set_facility_controls(uuid,text,boolean,text),
  public.platform_list_facility_audit(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Atomic write RPCs. Session + rating writes (and trifecta eval + scores) are
-- multi-statement; wrapping them in a plpgsql function makes each one a single
-- transaction so a malformed rating can never leave an orphan session behind.
--
-- Plain (invoker-rights) language plpgsql — NO security definer — so the
-- caller's RLS policies still apply; auth.uid() is the signed-in user.
-- The legacy migrations are not compatible with this fresh facility schema.
-- ---------------------------------------------------------------------------

create or replace function public.create_session_with_ratings(
  p_horse_id uuid, p_phase_id uuid, p_occurred_at timestamptz, p_notes text,
  p_rider text, p_bit text, p_task_completions jsonb, p_ratings jsonb
) returns public.sessions language plpgsql as $$
declare v_session public.sessions;
begin
  insert into public.sessions (facility_id, horse_id, phase_id, occurred_at, notes, rider, bit, task_completions)
  select h.facility_id, h.id, p_phase_id, coalesce(p_occurred_at, now()), p_notes, p_rider, p_bit, coalesce(p_task_completions, '[]'::jsonb)
  from public.horses h where h.id = p_horse_id and h.status = 'in_training'
  returning * into v_session;
  if not found then raise exception 'Horse not found or unavailable'; end if;
  insert into public.ratings (facility_id, session_id, question_id, axis_snapshot, question_text_snapshot, score, comment)
  select v_session.facility_id, v_session.id, (r->>'question_id')::uuid, r->>'axis',
         r->>'question_text_snapshot', (r->>'score')::smallint, nullif(r->>'comment','')
  from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) as r;
  return v_session;
end $$;

grant execute on function public.create_session_with_ratings(uuid, uuid, timestamptz, text, text, text, jsonb, jsonb) to authenticated;

-- Session edit: notes/rider/bit are set unconditionally (the client always
-- sends the full current form state, so null means "clear it"); occurred_at and
-- task_completions fall back to the existing value when null. When p_ratings is
-- non-null the whole rating set is replaced in the same transaction.
-- Trifecta upsert: one evaluation per horse (unique(horse_id)); its scores are
-- fully replaced from the passed array in the same transaction.
create or replace function public.upsert_trifecta_with_scores(
  p_horse_id uuid, p_notes text, p_scores jsonb
) returns public.trifecta_evaluations language plpgsql as $$
declare v_eval public.trifecta_evaluations;
begin
  insert into public.trifecta_evaluations (facility_id, horse_id, notes, evaluated_at)
  select h.facility_id, h.id, p_notes, now() from public.horses h where h.id = p_horse_id
  on conflict (horse_id) do update
    set notes = excluded.notes, evaluated_at = excluded.evaluated_at
  returning * into v_eval;
  if not found then raise exception 'Horse not found or unavailable'; end if;
  delete from public.trifecta_scores where evaluation_id = v_eval.id;
  insert into public.trifecta_scores (facility_id, evaluation_id, axis, item_code, item_text_snapshot, score, comment)
  select v_eval.facility_id, v_eval.id, s->>'axis', s->>'item_code',
         s->>'item_text_snapshot', (s->>'score')::smallint, nullif(s->>'comment','')
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s;
  return v_eval;
end $$;

grant execute on function public.upsert_trifecta_with_scores(uuid, text, jsonb) to authenticated;

-- Preserve facility, phase, program, and score-scale reference integrity.
create or replace function public.validate_owned_references()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'horses' then
    if new.current_phase_id is not null and not exists (select 1 from phases where id = new.current_phase_id and facility_id = new.facility_id and program = new.training_type) then
      raise exception 'Horse phase must belong to the same facility and training program';
    end if;
  elsif tg_table_name = 'questions' then
    if not exists (select 1 from phases where id = new.phase_id and facility_id = new.facility_id) then raise exception 'Question phase facility mismatch'; end if;
  elsif tg_table_name = 'sessions' then
    if not exists (select 1 from horses h join phases p on p.id = new.phase_id where h.id = new.horse_id and h.facility_id = new.facility_id and p.facility_id = new.facility_id) then
      raise exception 'Session horse and phase must belong to the same facility';
    end if;
    if tg_op = 'INSERT' and not exists (select 1 from horses h join phases p on p.id = new.phase_id where h.id = new.horse_id and h.training_type = p.program) then
      raise exception 'New session phase must match the horse training program';
    end if;
    -- A historical session may retain its old program after a horse changes programs.
  elsif tg_table_name = 'ratings' then
    if not exists (select 1 from sessions s join questions q on q.id = new.question_id join phases p on p.id = s.phase_id where s.id = new.session_id and s.facility_id = new.facility_id and q.facility_id = new.facility_id and q.phase_id = s.phase_id and q.axis = new.axis_snapshot and ((p.scale = 'tqa' and new.score between -3 and 3) or (p.scale = 'five' and new.score between 1 and 5))) then
      raise exception 'Rating facility, phase, axis or scale mismatch';
    end if;
  elsif tg_table_name = 'trifecta_evaluations' then
    if not exists (select 1 from horses where id = new.horse_id and facility_id = new.facility_id) then raise exception 'Evaluation horse facility mismatch'; end if;
  elsif tg_table_name = 'trifecta_scores' then
    if not exists (select 1 from trifecta_evaluations where id = new.evaluation_id and facility_id = new.facility_id) then raise exception 'Evaluation score facility mismatch'; end if;
  elsif tg_table_name = 'resources' then
    if new.phase_id is not null and not exists (select 1 from phases where id = new.phase_id and facility_id = new.facility_id) then raise exception 'Resource phase facility mismatch'; end if;
    if new.question_id is not null and not exists (select 1 from questions where id = new.question_id and facility_id = new.facility_id) then raise exception 'Resource question facility mismatch'; end if;
  end if;
  return new;
end;
$$;

do $$ declare target text; begin
  foreach target in array array['horses','questions','sessions','ratings','trifecta_evaluations','trifecta_scores','resources'] loop
    execute format('create trigger validate_owned_references before insert or update on public.%I for each row execute function public.validate_owned_references()', target);
  end loop;
end $$;

-- Reject inaccessible/missing edits instead of returning a false success.
create or replace function public.update_session_with_ratings(
  p_session_id uuid, p_occurred_at timestamptz, p_notes text,
  p_rider text, p_bit text, p_task_completions jsonb, p_ratings jsonb
) returns void language plpgsql as $$
declare v_facility uuid;
begin
  update public.sessions set
    occurred_at = coalesce(p_occurred_at, occurred_at),
    notes = p_notes,
    rider = p_rider,
    bit = p_bit,
    task_completions = coalesce(p_task_completions, task_completions)
  where id = p_session_id returning facility_id into v_facility;
  if not found then raise exception 'Session not found or unavailable'; end if;
  if p_ratings is not null then
    delete from public.ratings where session_id = p_session_id;
    insert into public.ratings (facility_id, session_id, question_id, axis_snapshot, question_text_snapshot, score, comment)
    select v_facility, p_session_id, (r->>'question_id')::uuid, r->>'axis',
           r->>'question_text_snapshot', (r->>'score')::smallint, nullif(r->>'comment','')
    from jsonb_array_elements(p_ratings) as r;
  end if;
end $$;

grant execute on function public.update_session_with_ratings(uuid, timestamptz, text, text, text, jsonb, jsonb) to authenticated;
-- Atomic edit of a ride and its question set, including historical Foundation rides.
create or replace function public.update_ride_record(
  p_session_id uuid, p_expected_updated_at timestamptz, p_phase_id uuid,
  p_occurred_at timestamptz, p_notes text, p_rider text, p_bit text,
  p_task_completions jsonb, p_ratings jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  saved public.sessions;
begin
  select * into saved from public.sessions
    where id = p_session_id for update;
  if not found then raise exception 'Ride not found or unavailable'; end if;
  if saved.updated_at is distinct from p_expected_updated_at then
    raise exception 'This ride changed since you opened it. Reload the ride to review the latest version.';
  end if;
  if p_phase_id is not null and p_phase_id <> saved.phase_id then
    if not exists (
      select 1 from public.phases old_phase join public.phases new_phase
        on new_phase.facility_id = old_phase.facility_id and new_phase.program = old_phase.program
      where old_phase.id = saved.phase_id and old_phase.facility_id = saved.facility_id
        and old_phase.program = 'foundation' and new_phase.id = p_phase_id
    ) then raise exception 'Choose a Foundation phase belonging to this facility'; end if;
    if jsonb_typeof(p_ratings) is distinct from 'array' then
      raise exception 'A phase correction requires a replacement score sheet';
    end if;
    update public.sessions set phase_id = p_phase_id where id = saved.id;
  end if;
  perform public.update_session_with_ratings(saved.id, p_occurred_at, p_notes, p_rider, p_bit, p_task_completions, p_ratings);
end $$;
revoke all on function public.update_ride_record(uuid,timestamptz,uuid,timestamptz,text,text,text,jsonb,jsonb) from public;
grant execute on function public.update_ride_record(uuid,timestamptz,uuid,timestamptz,text,text,text,jsonb,jsonb) to authenticated;
revoke all on function public.create_session_with_ratings(uuid,uuid,timestamptz,text,text,text,jsonb,jsonb),
  public.update_session_with_ratings(uuid,timestamptz,text,text,text,jsonb,jsonb),
  public.upsert_trifecta_with_scores(uuid,text,jsonb),
  public.update_ride_record(uuid,timestamptz,uuid,timestamptz,text,text,text,jsonb,jsonb)
  from public, anon;

notify pgrst, 'reload schema';

commit;
