-- Disposable DB only. Requires bootstrap.sql, schema.sql, ride_drafts.sql.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-0000-0000-000000000001','draft-a@example.invalid',now()),
 ('20000000-0000-0000-0000-000000000002','draft-b@example.invalid',now());
create function public.test_draft_fail_rating() returns trigger language plpgsql as $$ begin
 if current_setting('tqa.test_fail_rating',true)='true' then raise exception 'Injected rating failure'; end if;
 return new;
end $$;
create trigger test_draft_failure before insert on public.ratings for each row execute function public.test_draft_fail_rating();
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select public.create_facility('Draft facility');
create temporary table draft_test_ids(k text primary key,v uuid);
insert into draft_test_ids select 'facility',id from public.facilities where name='Draft facility';
insert into draft_test_ids select 'phase',id from public.phases where facility_id=(select v from draft_test_ids where k='facility') and code='groundwork' and program='foundation';
insert into draft_test_ids select 'question',id from public.questions where phase_id=(select v from draft_test_ids where k='phase') order by position,id limit 1;
with h as (insert into public.horses(facility_id,name,training_type,current_phase_id) values((select v from draft_test_ids where k='facility'),'Draft horse','foundation',(select v from draft_test_ids where k='phase')) returning id)
insert into draft_test_ids select 'horse',id from h;
do $$ declare f uuid; h uuid; p uuid; q uuid; d jsonb; saved jsonb; fin jsonb; did uuid; req uuid:=gen_random_uuid(); resume_req uuid:=gen_random_uuid(); payload jsonb; count_before int;
begin
 select v into f from draft_test_ids where k='facility'; select v into h from draft_test_ids where k='horse'; select v into p from draft_test_ids where k='phase'; select v into q from draft_test_ids where k='question';
 d:=public.create_ride_draft(f,h,p,req); did:=(d->>'id')::uuid;
 insert into draft_test_ids values('draft',did);
 if public.create_ride_draft(f,h,p,req)<>d or (public.create_ride_draft(f,h,p,resume_req)->>'id')::uuid<>did then raise exception 'Create/resume not idempotent'; end if;
 begin perform public.create_ride_draft(f,h,(select id from public.phases where facility_id=f and program='sale_horse' limit 1),gen_random_uuid()); raise exception 'Expected invalid program'; exception when sqlstate '22023' then null; end;
 begin perform public.authorize_ride_transcription(did); raise exception 'Expected disabled voice'; exception when insufficient_privilege then null; end;
 begin perform public.save_ride_draft(did,99,gen_random_uuid(),null,'{}','[]',null,null,null,'[]'); raise exception 'Expected stale version'; exception when serialization_failure then null; end;
 payload:=jsonb_build_array(jsonb_build_object('question_id',q,'score',2,'comment','Confirmed score'));
 begin perform public.save_ride_draft(did,1,gen_random_uuid(),null,'{}',payload||payload,null,null,null,'[]'); raise exception 'Expected duplicate metric'; exception when sqlstate '22023' then null; end;
 begin perform public.save_ride_draft(did,1,gen_random_uuid(),null,'{}',jsonb_build_array(jsonb_build_object('question_id',q,'score',5)),null,null,null,'[]'); raise exception 'Expected invalid score'; exception when sqlstate '22023' then null; end;
 begin perform public.save_ride_draft(did,1,gen_random_uuid(),null,'{}',jsonb_build_array(jsonb_build_object('question_id',q,'score',1.5)),null,null,null,'[]'); raise exception 'Expected fractional score'; exception when sqlstate '22023' then null; end;
 req:=gen_random_uuid();
 saved:=public.save_ride_draft(did,1,req,'Ride notes','{"Warm-up":"Relaxed"}',payload,'2026-11-20 10:00Z','Trainer','Bit','[]');
 if saved->>'version'<>'2' or public.save_ride_draft(did,1,req,'Ride notes','{"Warm-up":"Relaxed"}',payload,'2026-11-20 10:00Z','Trainer','Bit','[]')<>saved then raise exception 'Save retry not stable'; end if;
 begin perform public.save_ride_draft(did,1,req,'Changed','{}',payload,null,null,null,'[]'); raise exception 'Expected reused ID rejection'; exception when raise_exception then if sqlerrm<>'Request ID reused' then raise; end if; end;
 begin perform public.finalize_ride_draft(did,1,gen_random_uuid()); raise exception 'Expected stale finalize'; exception when serialization_failure then null; end;
 select count(*) into count_before from public.sessions where horse_id=h;
 if count_before<>0 then raise exception 'Draft leaked to reports'; end if;
 perform set_config('tqa.test_fail_rating','true',true);
 begin perform public.finalize_ride_draft(did,2,gen_random_uuid()); raise exception 'Expected injected failure'; exception when raise_exception then if sqlerrm<>'Injected rating failure' then raise; end if; end;
 perform set_config('tqa.test_fail_rating','false',true);
 if exists(select 1 from public.sessions where horse_id=h) or public.get_ride_draft(did)->>'status'<>'draft' then raise exception 'Finalize failure was not atomic'; end if;
 req:=gen_random_uuid(); fin:=public.finalize_ride_draft(did,2,req);
 if public.create_ride_draft(f,h,p,resume_req)->>'id'<>did::text then raise exception 'Resumed create retry created new draft after finish'; end if;
 if fin->>'status'<>'completed' or public.finalize_ride_draft(did,2,req)<>fin or public.finalize_ride_draft(did,2,gen_random_uuid())<>fin then raise exception 'Finalize retry not stable'; end if;
 if (select count(*) from public.sessions where horse_id=h)<>1 or (select count(*) from public.ratings where session_id=(fin->>'session_id')::uuid)<>1 then raise exception 'Finalize duplicate or missing score'; end if;
 if not exists(select 1 from public.sessions where id=(fin->>'session_id')::uuid and user_id=auth.uid() and facility_id=f and notes=E'Ride notes\n\nWarm-up: Relaxed') then raise exception 'Attribution/notes lost'; end if;
 if not exists(select 1 from public.ratings r join public.questions q on q.id=r.question_id where r.session_id=(fin->>'session_id')::uuid and r.question_text_snapshot=q.text and r.axis_snapshot=q.axis and r.score=2) then raise exception 'Snapshot incorrect'; end if;
 begin perform public.discard_ride_draft(did,3,gen_random_uuid()); raise exception 'Expected closed draft'; exception when raise_exception then if sqlerrm<>'Draft is closed' then raise; end if; end;
 d:=public.create_ride_draft(f,h,p,gen_random_uuid()); insert into draft_test_ids values('active',(d->>'id')::uuid);
 begin update public.ride_drafts set version=999 where id=(d->>'id')::uuid; raise exception 'Expected direct write denial'; exception when insufficient_privilege then null; end;
 begin perform public._lock_ride_draft(did); raise exception 'Expected private helper denial'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Give B access to the SAME facility, proving drafts remain trainer-private.
insert into public.facility_memberships(facility_id,user_id,role) values((select v from draft_test_ids where k='facility'),'20000000-0000-0000-0000-000000000002','trainer');
update public.facilities set voice_enabled=true where id=(select v from draft_test_ids where k='facility');
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
select public.create_facility('Other draft facility');
do $$ declare other_f uuid; other_p uuid; begin
 select id into other_f from public.facilities where name='Other draft facility';
 select id into other_p from public.phases where facility_id=other_f and program='foundation' and code='groundwork';
 begin perform public.create_ride_draft(other_f,(select v from draft_test_ids where k='horse'),other_p,gen_random_uuid()); raise exception 'Expected cross facility horse denial'; exception when sqlstate '22023' then null; end;
 begin perform public.get_ride_draft((select v from draft_test_ids where k='active')); raise exception 'Expected trainer isolation'; exception when insufficient_privilege then null; end;
 begin perform public.authorize_ride_transcription((select v from draft_test_ids where k='active')); raise exception 'Expected transcription isolation'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
do $$ declare i int; d uuid; result jsonb; req uuid:=gen_random_uuid(); begin
 select v into d from draft_test_ids where k='active';
 for i in 1..20 loop perform public.authorize_ride_transcription(d); end loop;
 begin perform public.authorize_ride_transcription(d); raise exception 'Expected transcription rate limit'; exception when program_limit_exceeded then null; end;
 result:=public.discard_ride_draft(d,1,req);
 if result->>'status'<>'discarded' or public.discard_ride_draft(d,1,req)<>result then raise exception 'Discard retry not stable'; end if;
 begin perform public.authorize_ride_transcription(d); raise exception 'Expected closed transcription'; exception when raise_exception then if sqlerrm<>'Draft is closed' then raise; end if; end;
end $$;
reset role;
update public.facilities set status='suspended' where id=(select v from draft_test_ids where k='facility');
set local role authenticated;
do $$ begin
 begin perform public.get_ride_draft((select v from draft_test_ids where k='draft')); raise exception 'Expected suspended facility denial'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.facilities set status='active' where id=(select v from draft_test_ids where k='facility');
update public.facility_memberships set role='owner' where facility_id=(select v from draft_test_ids where k='facility') and user_id='20000000-0000-0000-0000-000000000002';
delete from public.facility_memberships where facility_id=(select v from draft_test_ids where k='facility') and user_id='20000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin
 begin perform public.get_ride_draft((select v from draft_test_ids where k='draft')); raise exception 'Expected removed member denial'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: draft RPCs, isolation, score validation, versions, idempotency, atomic finalize, report separation, private writes, voice authorization and rate limits' as result;
