-- Optional guided Temperament for existing facility-aware Phase 1 drafts.
begin;

create or replace function public._guided_temperament_remaining(d public.ride_drafts)
returns uuid[] language sql stable set search_path=public,pg_temp as $$
  select coalesce(array_agg(q.id order by q.position,q.id),'{}'::uuid[])
  from public.questions q
  where q.facility_id=d.facility_id and q.phase_id=d.phase_id and q.axis='temperament'
    and d.guided_cursor=cardinality(d.guided_question_ids) and d.guided_cursor>0
    and not exists (
      select 1 from public.questions prior where prior.id=any(d.guided_question_ids) and prior.axis='temperament'
    )
    and not exists (
      select 1 from jsonb_array_elements(d.ratings) rating where (rating->>'question_id')::uuid=q.id
    )
$$;
revoke all on function public._guided_temperament_remaining(public.ride_drafts) from public, anon, authenticated;

create or replace function public.begin_guided_temperament(
  p_draft_id uuid, p_expected_version bigint, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  d public.ride_drafts;
  prior public.ride_draft_requests;
  payload jsonb := jsonb_build_object('op','guided_temperament','version',p_expected_version);
  extra uuid[];
  result jsonb;
begin
  d := public._lock_ride_draft(p_draft_id);
  perform public._guided_question(d);
  if p_request_id is null then raise exception 'Request ID required'; end if;
  select * into prior from public.ride_draft_requests where draft_id=d.id and request_id=p_request_id;
  if found then
    if prior.payload is distinct from payload then raise exception 'Request ID reused'; end if;
    return to_jsonb(d);
  end if;
  if d.version is distinct from p_expected_version then
    raise exception 'Draft changed. Reload saved draft.' using errcode='40001';
  end if;
  extra := public._guided_temperament_remaining(d);
  if cardinality(extra)=0 then
    raise exception 'Temperament choices are unavailable for this draft' using errcode='40001';
  end if;
  update public.ride_drafts
    set guided_question_ids=d.guided_question_ids||extra, active_voice_turn=null, version=d.version+1, updated_at=now()
    where id=d.id returning * into d;
  result := to_jsonb(d);
  insert into public.ride_draft_requests values(d.id,p_request_id,payload,result);
  return result;
end $$;

create or replace function public.authorize_temperament_reply(
  p_draft_id uuid, p_expected_version bigint, p_consume boolean
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts;
begin
  d := public._lock_ride_draft(p_draft_id);
  perform public._guided_question(d);
  if d.version is distinct from p_expected_version or cardinality(public._guided_temperament_remaining(d))=0 then
    raise exception 'Temperament choice is unavailable or stale' using errcode='40001';
  end if;
  if p_consume then perform public.authorize_ride_transcription(d.id); end if;
  return true;
end $$;

revoke all on function public.begin_guided_temperament(uuid,bigint,uuid),
  public.authorize_temperament_reply(uuid,bigint,boolean) from public, anon;
grant execute on function public.begin_guided_temperament(uuid,bigint,uuid),
  public.authorize_temperament_reply(uuid,bigint,boolean) to authenticated;

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
    where q.id=p_question_id and q.facility_id=d.facility_id and q.phase_id=d.phase_id
      and q.axis in ('foundation','temperament');
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
  return jsonb_build_object('question_text',question_text) ||
    case when p_question_id is null and cardinality(public._guided_temperament_remaining(d))>0
      then '{"offer_temperament":true}'::jsonb else '{}'::jsonb end;
end $$;

revoke all on function public.authorize_ride_prompt(uuid,bigint,uuid,boolean) from public, anon;
grant execute on function public.authorize_ride_prompt(uuid,bigint,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
