-- Additive migration. Apply AFTER the facility-aware schema/migration. Never stores audio/transcripts.
-- Draft writes are RPC-only; existing manual session/report paths are unchanged.
begin;
create table if not exists public.ride_drafts (
 id uuid primary key default gen_random_uuid(),
 facility_id uuid not null references public.facilities(id),
 trainer_id uuid not null references auth.users(id),
 horse_id uuid not null references public.horses(id),
 phase_id uuid not null references public.phases(id),
 create_request_id uuid not null,
 status text not null default 'draft' check(status in ('draft','completed','discarded')),
 version bigint not null default 1,
 notes text, stage_notes jsonb not null default '{}'::jsonb,
 ratings jsonb not null default '[]'::jsonb,
 occurred_at timestamptz not null default now(), rider text, bit text,
 task_completions jsonb not null default '[]'::jsonb,
 session_id uuid unique references public.sessions(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(trainer_id,create_request_id),
 check(jsonb_typeof(stage_notes)='object'), check(jsonb_typeof(ratings)='array'),
 check(jsonb_typeof(task_completions)='array'),
 check((status='completed') = (session_id is not null))
);
create unique index if not exists ride_drafts_one_active on public.ride_drafts(trainer_id,facility_id,horse_id,phase_id) where status='draft';
create table if not exists public.ride_draft_create_requests (
 trainer_id uuid not null references auth.users(id), request_id uuid not null,
 draft_id uuid not null references public.ride_drafts(id),
 primary key(trainer_id,request_id)
);
create table if not exists public.ride_draft_requests (
 draft_id uuid not null references public.ride_drafts(id) on delete cascade,
 request_id uuid not null, payload jsonb not null, response jsonb not null,
 primary key(draft_id,request_id)
);
create table if not exists public.ride_transcription_limits (
 trainer_id uuid primary key references auth.users(id),
 window_start timestamptz not null, request_count integer not null
);
alter table public.ride_drafts enable row level security;
alter table public.ride_draft_requests enable row level security;
alter table public.ride_draft_create_requests enable row level security;
alter table public.ride_transcription_limits enable row level security;
revoke all on public.ride_drafts,public.ride_draft_requests,public.ride_draft_create_requests,public.ride_transcription_limits from public,anon,authenticated;

-- Private helper locks authorization/context rows until the RPC transaction ends.
create or replace function public._authorize_ride_context(p_facility_id uuid,p_horse_id uuid,p_phase_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform public.lock_facility_access(p_facility_id);
 perform 1 from public.horses h join public.phases p on p.id=p_phase_id
 where h.id=p_horse_id and h.facility_id=p_facility_id and p.facility_id=p_facility_id and h.training_type=p.program for share of h,p;
 if not found then raise exception 'Horse and phase must match facility and program' using errcode='22023'; end if;
end $$;
create or replace function public._lock_ride_draft(p_draft_id uuid)
returns public.ride_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts;
begin
 select * into d from public.ride_drafts where id=p_draft_id and trainer_id=auth.uid() for update;
 if not found then raise exception 'Draft unavailable' using errcode='42501'; end if;
 perform public._authorize_ride_context(d.facility_id,d.horse_id,d.phase_id);
 return d;
end $$;
create or replace function public._validate_ride_draft(p_draft public.ride_drafts)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb; q public.questions; v_scale text; seen uuid[] := '{}'; qid uuid; n numeric; kv record;
begin
 if jsonb_typeof(p_draft.ratings) is distinct from 'array' or jsonb_array_length(p_draft.ratings)>200
 or jsonb_typeof(p_draft.stage_notes) is distinct from 'object'
 or jsonb_typeof(p_draft.task_completions) is distinct from 'array'
 or length(coalesce(p_draft.notes,''))>20000 or pg_column_size(p_draft.stage_notes)>50000
 or pg_column_size(p_draft.task_completions)>50000 then raise exception 'Invalid draft payload' using errcode='22023'; end if;
 for kv in select * from jsonb_each(p_draft.stage_notes) loop
  if jsonb_typeof(kv.value)<>'string' or length(kv.key)>100 or length(kv.value #>> '{}')>10000 then raise exception 'Invalid stage note' using errcode='22023'; end if;
 end loop;
 select scale into v_scale from public.phases where id=p_draft.phase_id;
 for r in select * from jsonb_array_elements(p_draft.ratings) loop
  if jsonb_typeof(r)<>'object' or exists(select 1 from jsonb_object_keys(r) k where k not in ('question_id','score','comment')) then raise exception 'Invalid rating fields' using errcode='22023'; end if;
  qid := (r->>'question_id')::uuid;
  if qid is null or qid=any(seen) then raise exception 'Each metric may be rated once' using errcode='22023'; end if;
  seen := array_append(seen,qid);
  select * into q from public.questions where id=qid and phase_id=p_draft.phase_id and facility_id=p_draft.facility_id for share;
  if not found then raise exception 'Metric does not belong to draft phase' using errcode='22023'; end if;
  if jsonb_typeof(r->'score') is distinct from 'number' then raise exception 'Score must be numeric' using errcode='22023'; end if;
  n := (r->>'score')::numeric;
  if n<>trunc(n) or not ((v_scale='tqa' and n between -3 and 3) or (v_scale='five' and n between 1 and 5)) then raise exception 'Score outside phase scale' using errcode='22023'; end if;
  if length(coalesce(r->>'comment',''))>10000 then raise exception 'Comment too long' using errcode='22023'; end if;
 end loop;
end $$;
create or replace function public.create_ride_draft(p_facility_id uuid,p_horse_id uuid,p_phase_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts;
begin
 perform public._authorize_ride_context(p_facility_id,p_horse_id,p_phase_id);
 if p_request_id is null then raise exception 'Request ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select rd.* into d from public.ride_drafts rd join public.ride_draft_create_requests cr on cr.draft_id=rd.id where cr.trainer_id=auth.uid() and cr.request_id=p_request_id;
 if found then
  if (d.facility_id,d.horse_id,d.phase_id) is distinct from (p_facility_id,p_horse_id,p_phase_id) then raise exception 'Request ID reused'; end if;
  return to_jsonb(d);
 end if;
 select * into d from public.ride_drafts where trainer_id=auth.uid() and facility_id=p_facility_id and horse_id=p_horse_id and phase_id=p_phase_id and status='draft';
 if found then
  insert into public.ride_draft_create_requests values(auth.uid(),p_request_id,d.id);
  return to_jsonb(d);
 end if;
 insert into public.ride_drafts(facility_id,trainer_id,horse_id,phase_id,create_request_id)
 values(p_facility_id,auth.uid(),p_horse_id,p_phase_id,p_request_id) returning * into d;
 insert into public.ride_draft_create_requests values(auth.uid(),p_request_id,d.id);
 return to_jsonb(d);
end $$;
create or replace function public.get_ride_draft(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return to_jsonb(public._lock_ride_draft(p_draft_id)); end $$;
create or replace function public.save_ride_draft(p_draft_id uuid,p_expected_version bigint,p_request_id uuid,p_notes text,p_stage_notes jsonb,p_ratings jsonb,p_occurred_at timestamptz,p_rider text,p_bit text,p_task_completions jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts; prior public.ride_draft_requests; payload jsonb; result jsonb;
begin
 d := public._lock_ride_draft(p_draft_id);
 payload := jsonb_build_object('op','save','version',p_expected_version,'notes',p_notes,'stage_notes',p_stage_notes,'ratings',p_ratings,'occurred_at',p_occurred_at,'rider',p_rider,'bit',p_bit,'tasks',p_task_completions);
 if p_request_id is null then raise exception 'Request ID required'; end if;
 select * into prior from public.ride_draft_requests where draft_id=d.id and request_id=p_request_id;
 if found then
  if prior.payload<>payload then raise exception 'Request ID reused'; end if;
  return prior.response;
 end if;
 if d.status<>'draft' then raise exception 'Draft is closed'; end if;
 if d.version is distinct from p_expected_version then raise exception 'Draft changed. Reload before saving.' using errcode='40001'; end if;
 d.notes:=p_notes; d.stage_notes:=coalesce(p_stage_notes,'{}'); d.ratings:=coalesce(p_ratings,'[]');
 d.occurred_at:=coalesce(p_occurred_at,d.occurred_at); d.rider:=p_rider; d.bit:=p_bit; d.task_completions:=coalesce(p_task_completions,'[]');
 perform public._validate_ride_draft(d);
 update public.ride_drafts set notes=d.notes,stage_notes=d.stage_notes,ratings=d.ratings,occurred_at=d.occurred_at,rider=d.rider,bit=d.bit,task_completions=d.task_completions,version=version+1,updated_at=now() where id=d.id returning * into d;
 result:=to_jsonb(d);
 insert into public.ride_draft_requests values(d.id,p_request_id,payload,result);
 return result;
end $$;
create or replace function public.finalize_ride_draft(p_draft_id uuid,p_expected_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts; prior public.ride_draft_requests; payload jsonb; result jsonb; sid uuid; final_notes text;
begin
 d:=public._lock_ride_draft(p_draft_id);
 payload:=jsonb_build_object('op','finalize','version',p_expected_version);
 if p_request_id is null then raise exception 'Request ID required'; end if;
 select * into prior from public.ride_draft_requests where draft_id=d.id and request_id=p_request_id;
 if found then
  if prior.payload<>payload then raise exception 'Request ID reused'; end if;
  return prior.response;
 end if;
 if d.status='completed' then return to_jsonb(d); end if;
 if d.status<>'draft' then raise exception 'Draft is closed'; end if;
 if d.version is distinct from p_expected_version then raise exception 'Draft changed. Reload before finishing.' using errcode='40001'; end if;
 perform public._validate_ride_draft(d);
 final_notes:=concat_ws(E'\n\n',nullif(d.notes,''),(select string_agg(key||': '||value,E'\n' order by key) from jsonb_each_text(d.stage_notes)));
 insert into public.sessions(facility_id,user_id,horse_id,phase_id,occurred_at,notes,rider,bit,task_completions)
 values(d.facility_id,d.trainer_id,d.horse_id,d.phase_id,d.occurred_at,nullif(final_notes,''),d.rider,d.bit,d.task_completions) returning id into sid;
 insert into public.ratings(facility_id,user_id,session_id,question_id,axis_snapshot,question_text_snapshot,score,comment)
 select d.facility_id,d.trainer_id,sid,q.id,q.axis,q.text,(r->>'score')::smallint,nullif(r->>'comment','') from jsonb_array_elements(d.ratings) r join public.questions q on q.id=(r->>'question_id')::uuid;
 update public.ride_drafts set status='completed',session_id=sid,version=version+1,updated_at=now() where id=d.id returning * into d;
 result:=to_jsonb(d);
 insert into public.ride_draft_requests values(d.id,p_request_id,payload,result);
 return result;
end $$;
create or replace function public.discard_ride_draft(p_draft_id uuid,p_expected_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts; prior public.ride_draft_requests; payload jsonb; result jsonb;
begin
 d:=public._lock_ride_draft(p_draft_id);
 payload:=jsonb_build_object('op','discard','version',p_expected_version);
 if p_request_id is null then raise exception 'Request ID required'; end if;
 select * into prior from public.ride_draft_requests where draft_id=d.id and request_id=p_request_id;
 if found then
  if prior.payload<>payload then raise exception 'Request ID reused'; end if;
  return prior.response;
 end if;
 if d.status='discarded' then return to_jsonb(d); end if;
 if d.status<>'draft' then raise exception 'Draft is closed'; end if;
 if d.version is distinct from p_expected_version then raise exception 'Draft changed. Reload before discarding.' using errcode='40001'; end if;
 update public.ride_drafts set status='discarded',version=version+1,updated_at=now() where id=d.id returning * into d;
 result:=to_jsonb(d); insert into public.ride_draft_requests values(d.id,p_request_id,payload,result); return result;
end $$;
create or replace function public.authorize_ride_transcription(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts; n int;
begin
 d:=public._lock_ride_draft(p_draft_id);
 if d.status<>'draft' then raise exception 'Draft is closed'; end if;
 if not exists(select 1 from public.facilities where id=d.facility_id and voice_enabled) then raise exception 'Voice is disabled for this facility' using errcode='42501'; end if;
 insert into public.ride_transcription_limits(trainer_id,window_start,request_count) values(auth.uid(),clock_timestamp(),1)
 on conflict(trainer_id) do update set
 request_count=case when ride_transcription_limits.window_start<clock_timestamp()-interval '1 minute' then 1 else ride_transcription_limits.request_count+1 end,
 window_start=case when ride_transcription_limits.window_start<clock_timestamp()-interval '1 minute' then clock_timestamp() else ride_transcription_limits.window_start end
 returning request_count into n;
 if n>20 then raise exception 'Transcription rate limit reached' using errcode='54000'; end if;
 return true;
end $$;
-- Functions are EXECUTE-public by default. Close every private helper explicitly.
revoke all on function public._authorize_ride_context(uuid,uuid,uuid),public._lock_ride_draft(uuid),public._validate_ride_draft(public.ride_drafts) from public,anon,authenticated;
revoke all on function public.create_ride_draft(uuid,uuid,uuid,uuid),public.get_ride_draft(uuid),public.save_ride_draft(uuid,bigint,uuid,text,jsonb,jsonb,timestamptz,text,text,jsonb),public.finalize_ride_draft(uuid,bigint,uuid),public.discard_ride_draft(uuid,bigint,uuid),public.authorize_ride_transcription(uuid) from public,anon;
grant execute on function public.create_ride_draft(uuid,uuid,uuid,uuid),public.get_ride_draft(uuid),public.save_ride_draft(uuid,bigint,uuid,text,jsonb,jsonb,timestamptz,text,text,jsonb),public.finalize_ride_draft(uuid,bigint,uuid),public.discard_ride_draft(uuid,bigint,uuid),public.authorize_ride_transcription(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
