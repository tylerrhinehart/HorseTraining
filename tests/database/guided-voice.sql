-- Synthetic-only transaction in a new disposable database. Never production.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('30000000-0000-0000-0000-000000000001','guided-a@example.invalid',now()),
 ('30000000-0000-0000-0000-000000000002','guided-b@example.invalid',now());
create function public.test_guided_receipt_failure() returns trigger language plpgsql as $$ begin
 if current_setting('tqa.fail_guided_receipt',true)='true' and new.payload->>'op'='guided' then raise exception 'Injected receipt failure'; end if; return new; end $$;
create trigger guided_receipt_failure before insert on public.ride_draft_requests for each row execute function public.test_guided_receipt_failure();
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.create_facility('Guided fixture');
create temporary table guided_ids(k text primary key,v uuid);
insert into guided_ids select 'facility',id from public.facilities where name='Guided fixture';
insert into guided_ids select 'phase',id from public.phases where facility_id=(select v from guided_ids where k='facility') and program='foundation' and code='phase_1';
with h as(insert into public.horses(facility_id,name,training_type,current_phase_id) values((select v from guided_ids where k='facility'),'Guided synthetic horse','foundation',(select v from guided_ids where k='phase')) returning id)
insert into guided_ids select 'horse',id from h;
reset role;
update public.facilities set voice_enabled=true where id=(select v from guided_ids where k='facility');
insert into public.facility_memberships(facility_id,user_id,role) values((select v from guided_ids where k='facility'),'30000000-0000-0000-0000-000000000002','trainer');
set local role authenticated;
do $$ declare d jsonb; saved jsonb; retry jsonb; t uuid:=gen_random_uuid(); stale uuid:=gen_random_uuid(); q uuid; q2 uuid; payload jsonb; did uuid; ver bigint; i int;
begin
 d:=public.create_ride_draft((select v from guided_ids where k='facility'),(select v from guided_ids where k='horse'),(select v from guided_ids where k='phase'),gen_random_uuid()); did:=(d->>'id')::uuid;
 insert into guided_ids values('draft',did);
 select id into q from public.questions where phase_id=(select v from guided_ids where k='phase') and axis='foundation' order by position,id limit 1;
 select id into q2 from public.questions where phase_id=(select v from guided_ids where k='phase') and axis='foundation' order by position,id offset 1 limit 1;
 begin perform public.bind_guided_turn(did,1,q2,t); raise exception 'Expected wrong question'; exception when serialization_failure then null; end;
 perform public.bind_guided_turn(did,1,q,stale);
 perform public.bind_guided_turn(did,1,q,t);
 -- Another recording invalidates the previous turn before either provider may answer.
 begin perform public.authorize_guided_turn(did,1,q,stale,false); raise exception 'Expected stale turn'; exception when serialization_failure then null; end;
 if not public.authorize_guided_turn(did,1,q,t,true) then raise exception 'Authorization failed'; end if;
 if public.get_ride_draft(did)->>'guided_cursor'<>'0' or jsonb_array_length(public.get_ride_draft(did)->'ratings')<>0 then raise exception 'Binding advanced/wrote a score'; end if;
 payload:=jsonb_build_array(jsonb_build_object('question_id',q,'score',-2,'comment','synthetic manual note'));
 begin perform public.confirm_guided_score(did,1,t,q,2::smallint,null,'{}',payload,null,null,null,'[]'); raise exception 'Expected mismatched payload'; exception when raise_exception then if sqlerrm<>'Confirmed score missing from draft' then raise; end if; end;
 if public.get_ride_draft(did)->>'guided_cursor'<>'0' then raise exception 'Failed confirmation advanced'; end if;
 perform set_config('tqa.fail_guided_receipt','true',true);
 begin perform public.confirm_guided_score(did,1,t,q,-2::smallint,'Synthetic notes','{}',payload,null,'Trainer',null,'[]'); raise exception 'Expected injected receipt failure'; exception when raise_exception then if sqlerrm<>'Injected receipt failure' then raise; end if; end;
 perform set_config('tqa.fail_guided_receipt','false',true);
 if public.get_ride_draft(did)->>'guided_cursor'<>'0' or public.get_ride_draft(did)->>'version'<>'1' or public.get_ride_draft(did)->'ratings'<>'[]'::jsonb then raise exception 'Persistence failure did not roll back score and cursor'; end if;
 saved:=public.confirm_guided_score(did,1,t,q,-2::smallint,'Synthetic notes','{}',payload,null,'Trainer',null,'[]');
 if saved->>'guided_cursor'<>'1' or saved->>'version'<>'2' or saved->'ratings'<>payload then raise exception 'Score/cursor not atomic'; end if;
 if public.confirm_guided_score(did,1,t,q,-2::smallint,'Synthetic notes','{}',payload,null,'Trainer',null,'[]')<>saved then raise exception 'Exact retry changed state'; end if;
 begin perform public.confirm_guided_score(did,1,t,q,-1::smallint,'Synthetic notes','{}',payload,null,'Trainer',null,'[]'); raise exception 'Expected turn reuse'; exception when raise_exception then if sqlerrm<>'Turn ID reused' then raise; end if; end;
 begin perform public.bind_guided_turn(did,1,q2,gen_random_uuid()); raise exception 'Expected stale version'; exception when serialization_failure then null; end;
 begin perform public.authorize_guided_turn(did,1,q,t,false); raise exception 'Expected late response denial'; exception when serialization_failure then null; end;
 -- Re-fetch the durable next question/cursor. A historical retry never replays an old cursor.
 d:=public.get_ride_draft(did);
 if d->>'guided_cursor'<>'1' or (d->'guided_question_ids'->>1)::uuid<>q2 then raise exception 'Resume lost cursor'; end if;
 stale:=gen_random_uuid();perform public.bind_guided_turn(did,2,q2,stale);
 d:=public.confirm_guided_score(did,2,stale,q2,0::smallint,'Synthetic notes','{}',payload||jsonb_build_array(jsonb_build_object('question_id',q2,'score',0)),null,'Trainer',null,'[]');
 retry:=public.confirm_guided_score(did,1,t,q,-2::smallint,'Synthetic notes','{}',payload,null,'Trainer',null,'[]');
 if retry<>d or retry->>'guided_cursor'<>'2' then raise exception 'Historical retry regressed cursor'; end if;
 -- Finish the remaining sequence; no session is created until explicit final Save ride.
 for i in 3..jsonb_array_length(d->'guided_question_ids') loop
  q:=(d->'guided_question_ids'->>(i-1))::uuid;ver:=(d->>'version')::bigint;t:=gen_random_uuid();
  perform public.bind_guided_turn(did,ver,q,t);
  d:=public.confirm_guided_score(did,ver,t,q,3::smallint,null,'{}',(d->'ratings')||jsonb_build_array(jsonb_build_object('question_id',q,'score',3)),null,'Trainer',null,'[]');
 end loop;
 if exists(select 1 from public.sessions where horse_id=(select v from guided_ids where k='horse')) then raise exception 'Guided scoring finalized early'; end if;
 begin perform public.bind_guided_turn(did,(d->>'version')::bigint,q,gen_random_uuid()); raise exception 'Expected end of sequence'; exception when serialization_failure then null; end;
 d:=public.finalize_ride_draft(did,(d->>'version')::bigint,gen_random_uuid());
 if (select count(*) from public.sessions where horse_id=(select v from guided_ids where k='horse'))<>1 then raise exception 'Final ride missing'; end if;
 begin perform public.bind_guided_turn(did,(d->>'version')::bigint,q,gen_random_uuid()); raise exception 'Expected closed draft'; exception when raise_exception then if sqlerrm<>'Draft is closed' then raise; end if; end;
end $$;
-- Same facility does not grant access to another trainer's draft or voice turn table.
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
do $$ begin
 begin perform public.bind_guided_turn((select v from guided_ids where k='draft'),1,gen_random_uuid(),gen_random_uuid()); raise exception 'Expected trainer denial'; exception when insufficient_privilege then null; end;
 begin perform public.authorize_guided_turn((select v from guided_ids where k='draft'),1,gen_random_uuid(),gen_random_uuid(),true); raise exception 'Expected trainer denial'; exception when insufficient_privilege then null; end;
 begin perform public.confirm_guided_score((select v from guided_ids where k='draft'),1,gen_random_uuid(),gen_random_uuid(),1::smallint,null,'{}','[]',null,null,null,'[]'); raise exception 'Expected trainer denial'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.ride_voice_turns; raise exception 'Expected private table denial'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: guided binding, stale/late turns, atomic score/cursor, exact/historical retries, resume, full sequencing, explicit final save and trainer isolation' as result;
