-- Additive facility onboarding/import support. Safe for existing facility installs.
-- Legacy upgrades must use scripts/build-facility-upgrade.mjs, never schema.sql alone.
begin;
create table if not exists public.facility_transitions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 facility_id uuid not null references public.facilities(id) on delete restrict,
 completed_at timestamptz not null default now(),
 imported_counts jsonb not null
);
alter table public.facility_transitions enable row level security;
revoke all on public.facility_transitions from public,anon,authenticated;

create or replace function public._legacy_facility_counts(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t text; n bigint; result jsonb:='{}';
begin
 foreach t in array array['phases','questions','horses','sessions','ratings','trifecta_evaluations','trifecta_scores','resources'] loop
  n:=0;
  if to_regclass('tqa_legacy.'||t) is not null then
   execute format('select count(*) from tqa_legacy.%I where user_id=$1',t) into n using p_user;
  end if;
  result:=result||jsonb_build_object(t,n);
 end loop;
 return result;
end $$;
revoke all on function public._legacy_facility_counts(uuid) from public,anon,authenticated;

create or replace function public.facility_transition_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare counts jsonb; completed uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select facility_id into completed from public.facility_transitions where user_id=auth.uid();
 counts:=case when completed is not null then '{}'::jsonb else public._legacy_facility_counts(auth.uid()) end;
 return jsonb_build_object('counts',counts,'has_pending_data',completed is null and exists(select 1 from jsonb_each_text(counts) e where e.value::bigint>0),'completed_facility_id',completed);
end $$;
revoke all on function public.facility_transition_status() from public,anon;
grant execute on function public.facility_transition_status() to authenticated;

create or replace function public._attach_legacy_facility(p_facility uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); counts jsonb; t text; expected bigint; actual bigint;
 template_phases jsonb; template_questions jsonb; template_resources jsonb; item jsonb; mapped_phase uuid;
begin
 -- Called only inside creation of a brand-new owned facility. No caller-supplied owner.
 if exists(select 1 from public.facility_transitions where user_id=actor) then return; end if;
 counts:=public._legacy_facility_counts(actor);
 if not exists(select 1 from jsonb_each_text(counts) e where e.value::bigint>0) then return; end if;
 if not exists(select 1 from public.facilities f join public.facility_memberships m on m.facility_id=f.id
 where f.id=p_facility and m.user_id=actor and m.role='owner' and f.created_at=transaction_timestamp()) then raise exception 'New owned facility required'; end if;
 if exists(select 1 from jsonb_each_text(counts) e where e.value::bigint>0) then
  if exists(select 1 from public.horses where facility_id=p_facility) then raise exception 'Import target must be new'; end if;
  -- Retain freshly generated canonical templates in memory. Replace only these
  -- never-published templates with original IDs/text, then fill missing defaults.
  select coalesce(jsonb_agg(to_jsonb(p)),'[]') into template_phases from public.phases p where facility_id=p_facility;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into template_questions from public.questions q where facility_id=p_facility;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into template_resources from public.resources r where facility_id=p_facility;
  delete from public.resources where facility_id=p_facility;
  delete from public.questions where facility_id=p_facility;
  delete from public.phases where facility_id=p_facility;
  foreach t in array array['phases','questions','horses','sessions','ratings','trifecta_evaluations','trifecta_scores','resources'] loop
   expected:=(counts->>t)::bigint;
   if expected>0 then
    execute format('insert into public.%1$I select (jsonb_populate_record(null::public.%1$I,to_jsonb(s)||jsonb_build_object(''facility_id'',$1,''updated_by'',$2))).* from tqa_legacy.%1$I s where s.user_id=$2',t) using p_facility,actor;
    get diagnostics actual=row_count;
    if actual<>expected then raise exception 'Legacy import count mismatch for %',t; end if;
   end if;
  end loop;
  -- Preserve legacy IDs, custom labels and snapshots. Add only missing rubric
  -- positions/programs; a conflicting custom phase aborts rather than rewriting it.
  for item in select * from jsonb_array_elements(template_phases) loop
   if not exists(select 1 from public.phases where facility_id=p_facility and program=item->>'program' and code=item->>'code') then
    insert into public.phases select (jsonb_populate_record(null::public.phases,item)).*;
   end if;
  end loop;
  for item in select * from jsonb_array_elements(template_questions) loop
   select p.id into mapped_phase from public.phases p join jsonb_array_elements(template_phases) old on (old->>'id')::uuid=(item->>'phase_id')::uuid
   where p.facility_id=p_facility and p.program=old->>'program' and p.code=old->>'code';
   if not exists(select 1 from public.questions where phase_id=mapped_phase and axis=item->>'axis' and position=(item->>'position')::int) then
    insert into public.questions select (jsonb_populate_record(null::public.questions,item||jsonb_build_object('phase_id',mapped_phase))).*;
   end if;
  end loop;
  for item in select * from jsonb_array_elements(template_resources) loop
   select p.id into mapped_phase from public.phases p join jsonb_array_elements(template_phases) old on (old->>'id')::uuid=(item->>'phase_id')::uuid
   where p.facility_id=p_facility and p.program=old->>'program' and p.code=old->>'code';
   if not exists(select 1 from public.resources where facility_id=p_facility and phase_id=mapped_phase and url=item->>'url') then
    insert into public.resources select (jsonb_populate_record(null::public.resources,item||jsonb_build_object('phase_id',mapped_phase))).*;
   end if;
  end loop;
 end if;
 insert into public.facility_transitions(user_id,facility_id,imported_counts) values(actor,p_facility,counts);
end $$;
revoke all on function public._attach_legacy_facility(uuid) from public,anon,authenticated;

-- Preserve the tested creation/invitation behavior; wrap creation atomically.
do $$ begin
 if to_regprocedure('public._create_facility_base(text,uuid)') is null then
  alter function public.create_facility(text,uuid) rename to _create_facility_base;
 end if;
end $$;
revoke all on function public._create_facility_base(text,uuid) from public,anon,authenticated;
create or replace function public.create_facility(p_name text,p_request_id uuid default null) returns public.facilities
language plpgsql security definer set search_path='' as $$
declare f public.facilities;
begin
 perform public.verified_facility_email();
 perform pg_advisory_xact_lock(hashtextextended('facility-transition:'||auth.uid()::text,0));
 f:=public._create_facility_base(p_name,p_request_id);
 perform public._attach_legacy_facility(f.id);
 return f;
end $$;
revoke all on function public.create_facility(text,uuid) from public,anon;
grant execute on function public.create_facility(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
