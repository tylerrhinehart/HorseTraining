-- Synthetic-only transaction in the disposable database.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('31000000-0000-0000-0000-000000000001','readback-a@example.invalid',now()),
 ('31000000-0000-0000-0000-000000000002','readback-b@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select public.create_facility('Readback fixture');
create temporary table readback_ids(k text primary key,v uuid);
insert into readback_ids select 'facility',id from public.facilities where name='Readback fixture';
insert into readback_ids select 'phase',id from public.phases
where facility_id=(select v from readback_ids where k='facility') and program='foundation' and code='phase_1';
with h as(
 insert into public.horses(facility_id,name,training_type,current_phase_id)
 values((select v from readback_ids where k='facility'),'Readback synthetic horse','foundation',(select v from readback_ids where k='phase'))
 returning id
) insert into readback_ids select 'horse',id from h;
reset role;
update public.facilities set voice_enabled=true where id=(select v from readback_ids where k='facility');
insert into public.facility_memberships(facility_id,user_id,role)
values((select v from readback_ids where k='facility'),'31000000-0000-0000-0000-000000000002','trainer');
set local role authenticated;
do $$
declare
 d jsonb; did uuid; first_question uuid; second_question uuid; q uuid; ver bigint; turn uuid; n integer;
begin
 d:=public.create_ride_draft(
   (select v from readback_ids where k='facility'),(select v from readback_ids where k='horse'),
   (select v from readback_ids where k='phase'),gen_random_uuid());
 did:=(d->>'id')::uuid;
 insert into readback_ids values('draft',did);
 select id into first_question from public.questions where phase_id=(d->>'phase_id')::uuid and axis='foundation' and position=0;
 select id into second_question from public.questions where phase_id=(d->>'phase_id')::uuid and axis='foundation' and position=1;
 if public.authorize_ride_prompt(did,1,first_question,false) is distinct from
   jsonb_build_object('question_text','Good to Catch (Review Groundwork)') then
   raise exception 'The initial readback could not resolve the canonical question';
 end if;
 if public.get_ride_draft(did) is distinct from d then raise exception 'Readback mutated the draft'; end if;
 begin perform public.authorize_ride_prompt(did,1,second_question,true); raise exception 'Expected inactive question denial';
 exception when serialization_failure then null; end;
 begin perform public.authorize_ride_prompt(did,1,null,true); raise exception 'Expected premature completion denial';
 exception when serialization_failure then null; end;
 begin perform public.authorize_ride_prompt(did,2,first_question,true); raise exception 'Expected stale version denial';
 exception when serialization_failure then null; end;

 for n in 1..30 loop
   perform public.authorize_ride_prompt(did,1,first_question,true);
 end loop;
 begin perform public.authorize_ride_prompt(did,1,first_question,true); raise exception 'Expected readback rate limit';
 exception when program_limit_exceeded then null; end;
 perform public.authorize_ride_prompt(did,1,first_question,false);
 perform public.authorize_ride_transcription(did);

 for q in select id from public.questions where phase_id=(d->>'phase_id')::uuid and axis='foundation' order by position loop
   ver:=(d->>'version')::bigint;
   turn:=gen_random_uuid();
   perform public.bind_guided_turn(did,ver,q,turn);
   d:=public.confirm_guided_score(did,ver,turn,q,2::smallint,null,'{}',
     (d->'ratings')||jsonb_build_array(jsonb_build_object('question_id',q,'score',2)),null,null,null,'[]');
 end loop;
 ver:=(d->>'version')::bigint;
 if public.authorize_ride_prompt(did,ver,null,false) is distinct from '{"question_text":null}'::jsonb then
   raise exception 'Readback could not resolve the completed guided sequence';
 end if;
 begin perform public.authorize_ride_prompt(did,ver,q,false); raise exception 'Expected post-cursor question denial';
 exception when serialization_failure then null; end;
end $$;

select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000002',true);
do $$ begin
 begin perform public.authorize_ride_prompt((select v from readback_ids where k='draft'),9,null,true);
   raise exception 'Expected wrong-trainer denial';
 exception when insufficient_privilege then null; end;
 begin perform 1 from public.ride_prompt_limits; raise exception 'Expected private limit table denial';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.facilities set voice_enabled=false where id=(select v from readback_ids where k='facility');
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
do $$ begin
 begin perform public.authorize_ride_prompt((select v from readback_ids where k='draft'),9,null,false);
   raise exception 'Expected disabled facility denial';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: initial prompt, authoritative cursor, unchanged draft, bounded readback, completion, trainer isolation and facility switch' as result;
