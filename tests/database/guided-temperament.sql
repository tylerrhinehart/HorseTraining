-- Synthetic-only transaction in the disposable database.
begin;
insert into auth.users(id,email,email_confirmed_at) values
  ('32000000-0000-0000-0000-000000000001','temperament-owner@example.invalid',now()),
  ('32000000-0000-0000-0000-000000000002','temperament-other@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','32000000-0000-0000-0000-000000000001',true);
select public.create_facility('Temperament fixture');
reset role;
update public.facilities set voice_enabled=true where name='Temperament fixture';
insert into public.facility_memberships(facility_id,user_id,role)
select id,'32000000-0000-0000-0000-000000000002','trainer' from public.facilities where name='Temperament fixture';

set local role authenticated;
do $$
declare
  d jsonb; original jsonb; did uuid; facility uuid; phase uuid; horse uuid; q uuid; manual_q uuid;
  ver bigint; offer_version bigint; turn uuid; begin_request uuid := gen_random_uuid();
  temperament_queue jsonb; authored_label text;
begin
  select id into facility from public.facilities where name='Temperament fixture';
  select id into phase from public.phases where facility_id=facility and program='foundation' and code='phase_1';
  insert into public.horses(facility_id,name,training_type,current_phase_id)
    values(facility,'Temperament synthetic horse','foundation',phase) returning id into horse;
  d := public.create_ride_draft(facility,horse,phase,gen_random_uuid());
  did := (d->>'id')::uuid;
  begin perform public.begin_guided_temperament(did,1,begin_request); raise exception 'Expected early start denial';
  exception when serialization_failure then null; end;
  begin perform public.authorize_temperament_reply(did,1,true); raise exception 'Expected early spoken offer denial';
  exception when serialization_failure then null; end;

  select id into manual_q from public.questions where phase_id=phase and axis='temperament' and position=0;
  for q in select id from public.questions where phase_id=phase and axis='foundation' order by position,id loop
    ver := (d->>'version')::bigint;
    turn := gen_random_uuid();
    perform public.bind_guided_turn(did,ver,q,turn);
    d := public.confirm_guided_score(did,ver,turn,q,2::smallint,'Foundation note','{}',
      (d->'ratings')||jsonb_build_array(jsonb_build_object('question_id',q,'score',2)) ||
      case when ver=1 then jsonb_build_array(jsonb_build_object('question_id',manual_q,'score',-1)) else '[]'::jsonb end,
      null,null,null,'[]');
  end loop;
  original := d;
  offer_version := (d->>'version')::bigint;
  if public.authorize_ride_prompt(did,offer_version,null,false)->>'offer_temperament' is distinct from 'true' then
    raise exception 'Completed Foundation did not authorize the offer';
  end if;
  perform public.authorize_temperament_reply(did,offer_version,true);
  if public.get_ride_draft(did) is distinct from original then raise exception 'Offer changed draft data'; end if;

  perform set_config('request.jwt.claim.sub','32000000-0000-0000-0000-000000000002',true);
  begin perform public.begin_guided_temperament(did,offer_version,begin_request); raise exception 'Expected wrong trainer denial';
  exception when insufficient_privilege then null; end;
  begin perform public.authorize_temperament_reply(did,offer_version,true); raise exception 'Expected wrong trainer audio denial';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','32000000-0000-0000-0000-000000000001',true);

  d := public.begin_guided_temperament(did,offer_version,begin_request);
  select jsonb_agg(id order by position,id) into temperament_queue from public.questions
    where phase_id=phase and axis='temperament' and id<>manual_q;
  if jsonb_array_length(temperament_queue)<>5 or
    d->'guided_question_ids' is distinct from ((original->'guided_question_ids') || temperament_queue) or
    d->'ratings' is distinct from original->'ratings' or d->>'notes' is distinct from original->>'notes' or
    d->>'guided_cursor' is distinct from original->>'guided_cursor' or (d->>'version')::bigint<>offer_version+1 then
    raise exception 'Temperament start lost data, repeated a saved rating, or changed the cursor';
  end if;
  if public.begin_guided_temperament(did,offer_version,begin_request) is distinct from d then
    raise exception 'Retry did not return the current guided draft';
  end if;
  begin perform public.authorize_temperament_reply(did,offer_version,false); raise exception 'Expected stale spoken offer denial';
  exception when serialization_failure then null; end;
  begin perform public.begin_guided_temperament(did,offer_version+1,gen_random_uuid()); raise exception 'Expected duplicate start denial';
  exception when serialization_failure then null; end;

  for q in select id from public.questions where phase_id=phase and axis='temperament' and id<>manual_q order by position,id loop
    ver := (d->>'version')::bigint;
    select text into authored_label from public.questions where id=q;
    if public.authorize_ride_prompt(did,ver,q,false)->>'question_text' is distinct from authored_label then
      raise exception 'Temperament readback could not resolve the active question';
    end if;
    turn := gen_random_uuid();
    perform public.bind_guided_turn(did,ver,q,turn);
    d := public.confirm_guided_score(did,ver,turn,q,0::smallint,'Foundation note','{}',
      (d->'ratings')||jsonb_build_array(jsonb_build_object('question_id',q,'score',0)),null,null,null,'[]');
  end loop;
  if (d->>'guided_cursor')::integer<>13 or jsonb_array_length(d->'ratings')<>14 or
    d->>'session_id' is not null or
    (public.authorize_ride_prompt(did,(d->>'version')::bigint,null,false) ? 'offer_temperament') then
    raise exception 'Temperament completion repeated the offer or published early';
  end if;
end $$;
reset role;
rollback;
select 'PASS: optional Temperament, draft resume, trainer isolation, guarded voice, and idempotent transition' as result;
