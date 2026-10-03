-- Migration: training programs (Foundation / Foundation to Finish / Sale Horse).
--
-- schema.sql is a destructive rebuild, so this idempotent migration brings an
-- EXISTING Supabase project up to date without dropping data. Safe to re-run.
-- Run it once against the live database (the app cannot apply it).

-- ---------------------------------------------------------------------------
-- 1. New columns (existing rows backfill to the Foundation defaults).
-- ---------------------------------------------------------------------------

alter table public.horses
  add column if not exists training_type text not null default 'foundation',
  add column if not exists program_meta  jsonb not null default '{}'::jsonb;

alter table public.phases
  add column if not exists program text not null default 'foundation',
  add column if not exists scale   text not null default 'tqa';

alter table public.sessions
  add column if not exists rider text,
  add column if not exists bit   text,
  add column if not exists task_completions jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Constraint swaps (drop the old, add the new). Idempotent.
-- ---------------------------------------------------------------------------

alter table public.horses
  drop constraint if exists horses_training_type_check;
alter table public.horses
  add constraint horses_training_type_check
  check (training_type in ('foundation','foundation_to_finish','sale_horse'));

alter table public.phases
  drop constraint if exists phases_program_check;
alter table public.phases
  add constraint phases_program_check
  check (program in ('foundation','foundation_to_finish','sale_horse'));

alter table public.phases
  drop constraint if exists phases_scale_check;
alter table public.phases
  add constraint phases_scale_check
  check (scale in ('tqa','five'));

-- Codes are now program-scoped free text — drop the old 5-code restriction.
alter table public.phases drop constraint if exists phases_code_check;

-- Uniqueness now includes program.
alter table public.phases drop constraint if exists phases_user_id_code_key;
alter table public.phases drop constraint if exists phases_user_id_position_key;
alter table public.phases drop constraint if exists phases_user_id_program_code_key;
alter table public.phases drop constraint if exists phases_user_id_program_position_key;
alter table public.phases
  add constraint phases_user_id_program_code_key unique (user_id, program, code);
alter table public.phases
  add constraint phases_user_id_program_position_key unique (user_id, program, position);

-- Ratings: allow 1…5 (performance scale) alongside −3…+3.
alter table public.ratings drop constraint if exists ratings_score_check;
alter table public.ratings
  add constraint ratings_score_check check (score between -3 and 5);

-- ---------------------------------------------------------------------------
-- 3. Backfill the performance programs + Foundation videos for existing users.
--    Guarded so re-running is a no-op.
-- ---------------------------------------------------------------------------

do $$
declare
  u record;
  f2f_id uuid;
  sale_id uuid;
  gw_id uuid; p1_id uuid; p2_id uuid; p3_id uuid; p4_id uuid;
begin
  for u in select distinct user_id as id from public.phases loop
    -- Performance Horse Warm-Up phase for the two performance programs.
    if not exists (
      select 1 from public.phases
      where user_id = u.id and program = 'foundation_to_finish'
    ) then
      insert into public.phases (user_id, code, program, scale, position, name) values
        (u.id, 'performance_warmup', 'foundation_to_finish', 'five', 0, 'Performance Horse Warm-Up'),
        (u.id, 'performance_warmup', 'sale_horse',           'five', 0, 'Performance Horse Warm-Up');

      select id into f2f_id  from public.phases where user_id = u.id and program = 'foundation_to_finish' and code = 'performance_warmup';
      select id into sale_id from public.phases where user_id = u.id and program = 'sale_horse'           and code = 'performance_warmup';

      insert into public.questions (user_id, phase_id, axis, position, text, low_label, high_label)
      select u.id, pid, axis, pos, txt, lo, hi
      from (select unnest(array[f2f_id, sale_id]) as pid) phases
      cross join (values
        ('foundation',  0, 'Ground Work & Phase 1 Review', 'Very Poor', 'Excellent'),
        ('foundation',  1, 'HD & Stage 4 (Inside -> Outside Rein) — Snake Trails (Walk, Slow & Extended Trot, Lope)', 'Very Poor', 'Excellent'),
        ('foundation',  2, 'Vertical & Horizontal Direction — Walking, Slow Trot, Extended Trot, Loping', 'Very Poor', 'Excellent'),
        ('foundation',  3, 'Large Fasts and Small Slows — w/ Willing Submission and Vertical Direction', 'Very Poor', 'Excellent'),
        ('foundation',  4, 'Stage 2 w/ Willing Submission & Vertical Direction — Standing, Walking, Jigging, Trotting, Loping', 'Very Poor', 'Excellent'),
        ('foundation',  5, 'Stage 3 w/ Willing Submission & Vertical Direction — Standing, Walking, Jigging, Trotting, Loping', 'Very Poor', 'Excellent'),
        ('foundation',  6, 'Stage 4 w/ Willing Submission & Vertical Direction — Standing, Walking, Trotting, Rollbacks and Spins', 'Very Poor', 'Excellent'),
        ('foundation',  7, 'Task Completion — Pick One Job From the "Task Completion" Sheet', 'Very Poor', 'Excellent'),
        ('temperament', 0, 'Self-preservation (fight or flight)',           'Low',       'High'),
        ('temperament', 1, 'Confidence',                                    'Low',       'High'),
        ('temperament', 2, 'Sensitivity (response to light pressure)',      'Dull',      'Very Responsive'),
        ('temperament', 3, 'Energy (motivation and determination)',         'Low',       'High'),
        ('temperament', 4, 'Willingness (response to request)',             'Resistant', 'Willing'),
        ('temperament', 5, 'Reaction to social separation',                 'Calm',      'Nervous')
      ) as q(axis, pos, txt, lo, hi);
    end if;

    -- Foundation phase videos (only if none attached yet).
    select id into gw_id from public.phases where user_id = u.id and program = 'foundation' and code = 'groundwork';
    select id into p1_id from public.phases where user_id = u.id and program = 'foundation' and code = 'phase_1';
    select id into p2_id from public.phases where user_id = u.id and program = 'foundation' and code = 'phase_2';
    select id into p3_id from public.phases where user_id = u.id and program = 'foundation' and code = 'phase_3';
    select id into p4_id from public.phases where user_id = u.id and program = 'foundation' and code = 'phase_4';

    if gw_id is not null and not exists (
      select 1 from public.resources where phase_id = gw_id and kind = 'youtube'
    ) then
      insert into public.resources (user_id, phase_id, title, url, kind, position) values
        (u.id, gw_id, 'Groundwork video', 'https://youtu.be/QUP5XSe73oo', 'youtube', 0),
        (u.id, p1_id, 'Phase 1 video',    'https://youtu.be/97rDdcw5SJQ', 'youtube', 0),
        (u.id, p2_id, 'Phase 2 video',    'https://youtu.be/xvORqrG1BNY', 'youtube', 0),
        (u.id, p3_id, 'Phase 3 video',    'https://youtu.be/Je5RaMkXZPE', 'youtube', 0),
        (u.id, p4_id, 'Phase 4 video',    'https://www.youtube.com/watch?v=nFd0WHDvMPk', 'youtube', 0);
    end if;

    -- Performance programs: official score-sheet/warm-up doc (only if none yet).
    select id into f2f_id  from public.phases where user_id = u.id and program = 'foundation_to_finish' and code = 'performance_warmup';
    select id into sale_id from public.phases where user_id = u.id and program = 'sale_horse'           and code = 'performance_warmup';
    if f2f_id is not null and not exists (select 1 from public.resources where phase_id = f2f_id) then
      insert into public.resources (user_id, phase_id, title, url, kind, notes, position)
      select u.id, pid,
             'Foundation to Finish — Performance Horse score sheets & warm-up videos',
             'https://www.dropbox.com/scl/fi/4mbij1k3aj6f06wga4p8g/Sale-Horse-Ready-2024-All-Around-Performance-Horse.docx?rlkey=1iu0ofhaidt19d10k5ga4fedb&st=v603gncc&dl=0',
             'link',
             'Official document with the Performance Horse task-completion phases and warm-up. Warm-up video segments: Introduction, Ground Work, First Get On, Review of Vocab Words, Reining Cow Horse Warm-Up.',
             0
      from (select unnest(array[f2f_id, sale_id]) as pid) phases;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Atomic write RPCs. These make each session/rating (and trifecta eval/score)
--    write a single transaction so a malformed rating can't orphan a session.
--    create or replace ⇒ idempotent. Plain (invoker-rights) plpgsql — NO
--    security definer — so RLS still applies; auth.uid() is the signed-in user.
--    (Duplicated verbatim in supabase/schema.sql; keep in sync.)
-- ---------------------------------------------------------------------------

create or replace function public.create_session_with_ratings(
  p_horse_id uuid, p_phase_id uuid, p_occurred_at timestamptz, p_notes text,
  p_rider text, p_bit text, p_task_completions jsonb, p_ratings jsonb
) returns public.sessions language plpgsql as $$
declare v_session public.sessions;
begin
  insert into public.sessions (user_id, horse_id, phase_id, occurred_at, notes, rider, bit, task_completions)
  values (auth.uid(), p_horse_id, p_phase_id, coalesce(p_occurred_at, now()), p_notes, p_rider, p_bit, coalesce(p_task_completions, '[]'::jsonb))
  returning * into v_session;
  insert into public.ratings (user_id, session_id, question_id, axis_snapshot, question_text_snapshot, score, comment)
  select auth.uid(), v_session.id, (r->>'question_id')::uuid, r->>'axis',
         r->>'question_text_snapshot', (r->>'score')::smallint, nullif(r->>'comment','')
  from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) as r;
  return v_session;
end $$;

grant execute on function public.create_session_with_ratings(uuid, uuid, timestamptz, text, text, text, jsonb, jsonb) to authenticated;

-- Session edit: notes/rider/bit are set unconditionally (the client always
-- sends the full current form state, so null means "clear it"); occurred_at and
-- task_completions fall back to the existing value when null. When p_ratings is
-- non-null the whole rating set is replaced in the same transaction.
create or replace function public.update_session_with_ratings(
  p_session_id uuid, p_occurred_at timestamptz, p_notes text,
  p_rider text, p_bit text, p_task_completions jsonb, p_ratings jsonb
) returns void language plpgsql as $$
begin
  update public.sessions set
    occurred_at = coalesce(p_occurred_at, occurred_at),
    notes = p_notes,
    rider = p_rider,
    bit = p_bit,
    task_completions = coalesce(p_task_completions, task_completions)
  where id = p_session_id;
  if not found then raise exception 'Session not found or unavailable'; end if;
  if p_ratings is not null then
    delete from public.ratings where session_id = p_session_id;
    insert into public.ratings (user_id, session_id, question_id, axis_snapshot, question_text_snapshot, score, comment)
    select auth.uid(), p_session_id, (r->>'question_id')::uuid, r->>'axis',
           r->>'question_text_snapshot', (r->>'score')::smallint, nullif(r->>'comment','')
    from jsonb_array_elements(p_ratings) as r;
  end if;
end $$;

grant execute on function public.update_session_with_ratings(uuid, timestamptz, text, text, text, jsonb, jsonb) to authenticated;

-- Trifecta upsert: one evaluation per horse (unique(horse_id)); its scores are
-- fully replaced from the passed array in the same transaction.
create or replace function public.upsert_trifecta_with_scores(
  p_horse_id uuid, p_notes text, p_scores jsonb
) returns public.trifecta_evaluations language plpgsql as $$
declare v_eval public.trifecta_evaluations;
begin
  insert into public.trifecta_evaluations (user_id, horse_id, notes, evaluated_at)
  values (auth.uid(), p_horse_id, p_notes, now())
  on conflict (horse_id) do update
    set notes = excluded.notes, evaluated_at = excluded.evaluated_at
  returning * into v_eval;
  delete from public.trifecta_scores where evaluation_id = v_eval.id;
  insert into public.trifecta_scores (user_id, evaluation_id, axis, item_code, item_text_snapshot, score, comment)
  select auth.uid(), v_eval.id, s->>'axis', s->>'item_code',
         s->>'item_text_snapshot', (s->>'score')::smallint, nullif(s->>'comment','')
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as s;
  return v_eval;
end $$;

grant execute on function public.upsert_trifecta_with_scores(uuid, text, jsonb) to authenticated;

-- Ownership and phase/scale integrity (also available as migration_integrity.sql).
-- Additive ownership/score integrity migration. No historical data is rewritten.
-- Review and back up an existing project before applying; tested locally only.
create or replace function public.validate_owned_references()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'horses' then
    if new.current_phase_id is not null and not exists (select 1 from phases where id = new.current_phase_id and user_id = new.user_id and program = new.training_type) then
      raise exception 'Horse phase must belong to the same owner and training program';
    end if;
  elsif tg_table_name = 'questions' then
    if not exists (select 1 from phases where id = new.phase_id and user_id = new.user_id) then raise exception 'Question phase owner mismatch'; end if;
  elsif tg_table_name = 'sessions' then
    if not exists (select 1 from horses h join phases p on p.id = new.phase_id where h.id = new.horse_id and h.user_id = new.user_id and p.user_id = new.user_id) then
      raise exception 'Session horse and phase must belong to the same owner';
    end if;
    if tg_op = 'INSERT' and not exists (select 1 from horses h join phases p on p.id = new.phase_id where h.id = new.horse_id and h.training_type = p.program) then
      raise exception 'New session phase must match the horse training program';
    end if;
    -- A historical session may retain its old program after a horse changes programs.
  elsif tg_table_name = 'ratings' then
    if not exists (select 1 from sessions s join questions q on q.id = new.question_id join phases p on p.id = s.phase_id where s.id = new.session_id and s.user_id = new.user_id and q.user_id = new.user_id and q.phase_id = s.phase_id and q.axis = new.axis_snapshot and ((p.scale = 'tqa' and new.score between -3 and 3) or (p.scale = 'five' and new.score between 1 and 5))) then
      raise exception 'Rating owner, phase, axis or scale mismatch';
    end if;
  elsif tg_table_name = 'trifecta_evaluations' then
    if not exists (select 1 from horses where id = new.horse_id and user_id = new.user_id) then raise exception 'Evaluation horse owner mismatch'; end if;
  elsif tg_table_name = 'trifecta_scores' then
    if not exists (select 1 from trifecta_evaluations where id = new.evaluation_id and user_id = new.user_id) then raise exception 'Evaluation score owner mismatch'; end if;
  elsif tg_table_name = 'resources' then
    if new.phase_id is not null and not exists (select 1 from phases where id = new.phase_id and user_id = new.user_id) then raise exception 'Resource phase owner mismatch'; end if;
    if new.question_id is not null and not exists (select 1 from questions where id = new.question_id and user_id = new.user_id) then raise exception 'Resource question owner mismatch'; end if;
  end if;
  return new;
end;
$$;

do $$ declare target text; begin
  foreach target in array array['horses','questions','sessions','ratings','trifecta_evaluations','trifecta_scores','resources'] loop
    execute format('drop trigger if exists validate_owned_references on public.%I', target);
    execute format('create trigger validate_owned_references before insert or update on public.%I for each row execute function public.validate_owned_references()', target);
  end loop;
end $$;

-- Reject inaccessible/missing edits instead of returning a false success.
create or replace function public.update_session_with_ratings(
  p_session_id uuid, p_occurred_at timestamptz, p_notes text,
  p_rider text, p_bit text, p_task_completions jsonb, p_ratings jsonb
) returns void language plpgsql as $$
begin
  update public.sessions set
    occurred_at = coalesce(p_occurred_at, occurred_at),
    notes = p_notes,
    rider = p_rider,
    bit = p_bit,
    task_completions = coalesce(p_task_completions, task_completions)
  where id = p_session_id;
  if not found then raise exception 'Session not found or unavailable'; end if;
  if p_ratings is not null then
    delete from public.ratings where session_id = p_session_id;
    insert into public.ratings (user_id, session_id, question_id, axis_snapshot, question_text_snapshot, score, comment)
    select auth.uid(), p_session_id, (r->>'question_id')::uuid, r->>'axis',
           r->>'question_text_snapshot', (r->>'score')::smallint, nullif(r->>'comment','')
    from jsonb_array_elements(p_ratings) as r;
  end if;
end $$;

grant execute on function public.update_session_with_ratings(uuid, timestamptz, text, text, text, jsonb, jsonb) to authenticated;
