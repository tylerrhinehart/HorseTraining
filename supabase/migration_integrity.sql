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
