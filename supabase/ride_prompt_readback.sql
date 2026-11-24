-- Additive migration for facility-aware installations with guided_voice.sql.
begin;

create table if not exists public.ride_prompt_limits (
  trainer_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null
);
alter table public.ride_prompt_limits enable row level security;
revoke all on public.ride_prompt_limits from public, anon, authenticated;

create or replace function public.authorize_ride_prompt(
  p_draft_id uuid, p_expected_version bigint, p_question_id uuid, p_consume boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  d public.ride_drafts;
  active_question uuid;
  question_text text;
  requests integer;
  requested_at timestamptz := clock_timestamp();
begin
  d := public._lock_ride_draft(p_draft_id);
  if d.version is distinct from p_expected_version then
    raise exception 'Draft changed. Reload saved draft.' using errcode='40001';
  end if;
  active_question := public._guided_question(d);

  -- The first prompt may be read aloud before the microphone binds its turn.
  if d.guided_question_ids is null then
    select q.id into active_question from public.questions q
    where q.facility_id=d.facility_id and q.phase_id=d.phase_id and q.axis='foundation'
    order by q.position,q.id limit 1;
  end if;
  if active_question is distinct from p_question_id or
     (p_question_id is null and (d.guided_question_ids is null or
      cardinality(d.guided_question_ids)=0 or d.guided_cursor<>cardinality(d.guided_question_ids))) then
    raise exception 'Not the active readback prompt' using errcode='40001';
  end if;
  if p_question_id is not null then
    select q.text into question_text from public.questions q
    where q.id=p_question_id and q.facility_id=d.facility_id and q.phase_id=d.phase_id and q.axis='foundation';
    if not found then raise exception 'Readback question unavailable' using errcode='40001'; end if;
  end if;

  if p_consume then
    insert into public.ride_prompt_limits(trainer_id,window_start,request_count)
    values(auth.uid(),requested_at,1)
    on conflict(trainer_id) do update set
      request_count=case when ride_prompt_limits.window_start<requested_at-interval '1 minute'
        then 1 else ride_prompt_limits.request_count+1 end,
      window_start=case when ride_prompt_limits.window_start<requested_at-interval '1 minute'
        then requested_at else ride_prompt_limits.window_start end
    returning request_count into requests;
    if requests>30 then raise exception 'Readback rate limit reached' using errcode='54000'; end if;
  end if;
  return jsonb_build_object('question_text',question_text);
end $$;

revoke all on function public.authorize_ride_prompt(uuid,bigint,uuid,boolean) from public, anon;
grant execute on function public.authorize_ride_prompt(uuid,bigint,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
