-- Apply only to an isolated facility-aware pilot after ride_drafts.sql. No production apply.
begin;
alter table public.ride_drafts add column if not exists guided_question_ids uuid[];
alter table public.ride_drafts add column if not exists guided_cursor integer not null default 0 check(guided_cursor>=0);
alter table public.ride_drafts add column if not exists active_voice_turn uuid;
create table public.ride_voice_turns (
 draft_id uuid not null references public.ride_drafts(id) on delete cascade,
 turn_id uuid not null, question_id uuid not null references public.questions(id), version bigint not null,
 primary key(draft_id,turn_id)
);
alter table public.ride_voice_turns enable row level security;
revoke all on public.ride_voice_turns from public,anon,authenticated;

create function public._guided_question(p_draft public.ride_drafts) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_draft.status<>'draft' then raise exception 'Draft is closed'; end if;
 if not exists(select 1 from public.phases where id=p_draft.phase_id and program='foundation' and code='phase_1' and scale='tqa')
 or not exists(select 1 from public.facilities where id=p_draft.facility_id and voice_enabled) then
 raise exception 'Guided voice is unavailable' using errcode='42501'; end if;
 return p_draft.guided_question_ids[p_draft.guided_cursor+1];
end $$;
create function public.bind_guided_turn(p_draft_id uuid,p_expected_version bigint,p_question_id uuid,p_turn_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts; prior public.ride_voice_turns; q uuid;
begin
 d:=public._lock_ride_draft(p_draft_id);
 if d.version is distinct from p_expected_version then raise exception 'Draft changed. Reload saved draft.' using errcode='40001'; end if;
 if p_turn_id is null then raise exception 'Turn ID required'; end if;
 if d.guided_question_ids is null then
  select array_agg(id order by position,id) into d.guided_question_ids from public.questions where phase_id=d.phase_id and facility_id=d.facility_id and axis='foundation';
  update public.ride_drafts set guided_question_ids=d.guided_question_ids where id=d.id;
 end if;
 q:=public._guided_question(d);
 if q is null or q is distinct from p_question_id then raise exception 'Not the active question' using errcode='40001'; end if;
 select * into prior from public.ride_voice_turns where draft_id=d.id and turn_id=p_turn_id;
 if found then
  if (prior.version,prior.question_id) is distinct from (p_expected_version,p_question_id) or d.active_voice_turn is distinct from p_turn_id then raise exception 'Stale or reused turn' using errcode='40001'; end if;
 else
  insert into public.ride_voice_turns values(d.id,p_turn_id,q,d.version);
  update public.ride_drafts set active_voice_turn=p_turn_id where id=d.id;
 end if;
 return jsonb_build_object('draft_id',d.id,'question_id',q,'version',d.version,'turn_id',p_turn_id);
end $$;
create function public.authorize_guided_turn(p_draft_id uuid,p_expected_version bigint,p_question_id uuid,p_turn_id uuid,p_consume boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts;
begin
 d:=public._lock_ride_draft(p_draft_id);
 if d.version is distinct from p_expected_version or d.active_voice_turn is distinct from p_turn_id
 or public._guided_question(d) is distinct from p_question_id or p_question_id is null
 or not exists(select 1 from public.ride_voice_turns where draft_id=d.id and turn_id=p_turn_id and question_id=p_question_id and version=p_expected_version)
 then raise exception 'Stale voice turn' using errcode='40001'; end if;
 if p_consume then perform public.authorize_ride_transcription(d.id); end if;
 return true;
end $$;
-- Confirmed score and cursor advance share one lock/transaction/idempotency receipt.
-- This trainer-owned RPC also accepts manual entry; no model has write authority.
create function public.confirm_guided_score(p_draft_id uuid,p_expected_version bigint,p_turn_id uuid,p_question_id uuid,p_score smallint,
 p_notes text,p_stage_notes jsonb,p_ratings jsonb,p_occurred_at timestamptz,p_rider text,p_bit text,p_task_completions jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.ride_drafts; prior public.ride_draft_requests; payload jsonb; result jsonb;
begin
 d:=public._lock_ride_draft(p_draft_id);
 payload:=jsonb_build_object('op','guided','version',p_expected_version,'question',p_question_id,'score',p_score,'notes',p_notes,'stage_notes',p_stage_notes,'ratings',p_ratings,'occurred_at',p_occurred_at,'rider',p_rider,'bit',p_bit,'tasks',p_task_completions);
 if p_turn_id is null then raise exception 'Turn ID required'; end if;
 select * into prior from public.ride_draft_requests where draft_id=d.id and request_id=p_turn_id;
 if found then
  if prior.payload<>payload then raise exception 'Turn ID reused'; end if;
  -- Never replay an obsolete cursor/version snapshot after another tab advanced.
  return to_jsonb(d);
 end if;
 perform public.authorize_guided_turn(d.id,p_expected_version,p_question_id,p_turn_id,false);
 if p_score is null or p_score not between -3 and 3 then raise exception 'Invalid signed score'; end if;
 d.ratings:=coalesce(p_ratings,'[]'); d.notes:=p_notes; d.stage_notes:=coalesce(p_stage_notes,'{}');
 d.occurred_at:=coalesce(p_occurred_at,d.occurred_at); d.rider:=p_rider; d.bit:=p_bit; d.task_completions:=coalesce(p_task_completions,'[]');
 if not exists(select 1 from jsonb_array_elements(d.ratings) r where (r->>'question_id')::uuid=p_question_id and (r->>'score')::numeric=p_score) then raise exception 'Confirmed score missing from draft'; end if;
 perform public._validate_ride_draft(d);
 update public.ride_drafts set ratings=d.ratings,notes=d.notes,stage_notes=d.stage_notes,occurred_at=d.occurred_at,rider=d.rider,bit=d.bit,task_completions=d.task_completions,
 guided_cursor=guided_cursor+1,active_voice_turn=null,version=version+1,updated_at=now() where id=d.id returning * into d;
 result:=to_jsonb(d);
 insert into public.ride_draft_requests values(d.id,p_turn_id,payload,result);
 return result;
end $$;
revoke all on function public._guided_question(public.ride_drafts) from public,anon,authenticated;
revoke all on function public.bind_guided_turn(uuid,bigint,uuid,uuid),public.authorize_guided_turn(uuid,bigint,uuid,uuid,boolean),public.confirm_guided_score(uuid,bigint,uuid,uuid,smallint,text,jsonb,jsonb,timestamptz,text,text,jsonb) from public,anon;
grant execute on function public.bind_guided_turn(uuid,bigint,uuid,uuid),public.authorize_guided_turn(uuid,bigint,uuid,uuid,boolean),public.confirm_guided_score(uuid,bigint,uuid,uuid,smallint,text,jsonb,jsonb,timestamptz,text,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
