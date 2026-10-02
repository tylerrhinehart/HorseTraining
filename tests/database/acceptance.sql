-- Test identities are synthetic and exist only inside tqa_test.
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into horses(id,user_id,name,training_type,current_phase_id,program_meta)
select '10000000-0000-0000-0000-000000000001',auth.uid(),'Foundation Colt','foundation',id,'{"training_goals":["fence_work","heading"],"weekly_comments":{"2026-09-28":"First week"}}' from phases where code='groundwork' and program='foundation';
insert into horses(id,user_id,name,training_type,current_phase_id)
select '10000000-0000-0000-0000-000000000002',auth.uid(),'Performance Horse','foundation_to_finish',id from phases where program='foundation_to_finish';

do $$ declare h uuid := '10000000-0000-0000-0000-000000000001'; p uuid; q uuid; s sessions; before_count int; begin
 select id into p from phases where code='groundwork' and program='foundation';
 select id into q from questions where phase_id=p and axis='foundation' order by position limit 1;
 select * into s from public.create_session_with_ratings(h,p,'2026-10-02T15:35Z','First ride','Wade',null,'[]',jsonb_build_array(jsonb_build_object('question_id',q,'axis','foundation','question_text_snapshot','Original','score',2)));
 if (select count(*) from sessions where horse_id=h) <> 1 then raise exception 'Persistence failed'; end if;
 if (select rider from sessions where id=s.id) <> 'Wade' then raise exception 'Foundation rider not saved'; end if;
 select count(*) into before_count from sessions;
 begin
   perform public.create_session_with_ratings(h,p,now(),'Bad rating','Wade',null,'[]',jsonb_build_array(jsonb_build_object('question_id',q,'axis','foundation','question_text_snapshot','Original','score',5)));
   raise exception 'Expected rating rejection';
 exception when others then if sqlerrm = 'Expected rating rejection' then raise; end if; end;
 if (select count(*) from sessions) <> before_count then raise exception 'Failed creation orphaned session'; end if;
 begin
   perform public.update_session_with_ratings(s.id,null,'Should rollback',null,null,null,jsonb_build_array(jsonb_build_object('question_id',q,'axis','foundation','question_text_snapshot','Original','score',5)));
   raise exception 'Expected edit rejection';
 exception when others then if sqlerrm = 'Expected edit rejection' then raise; end if; end;
 if (select notes from sessions where id=s.id) <> 'First ride' or (select score from ratings where session_id=s.id) <> 2 then raise exception 'Failed edit destroyed saved data'; end if;
 if (select count(*) from sessions where horse_id='10000000-0000-0000-0000-000000000002') <> 0 then raise exception 'Cross-horse leakage'; end if;
end $$;

do $$ declare p uuid; q uuid; s sessions; begin
 select id into p from phases where program='foundation_to_finish';
 select id into q from questions where phase_id=p and axis='foundation' order by position limit 1;
 select * into s from public.create_session_with_ratings('10000000-0000-0000-0000-000000000002',p,now(),'Performance','Wade','bit_2','[{"job":"fence_work","phase":2},{"job":"heading","phase":3}]',jsonb_build_array(jsonb_build_object('question_id',q,'axis','foundation','question_text_snapshot','Performance','score',4)));
 if (select task_completions from sessions where id=s.id) <> '[{"job":"fence_work","phase":2},{"job":"heading","phase":3}]'::jsonb then raise exception 'Independent task persistence failed'; end if;
end $$;

reset role;
-- Simulate a new connection/account using persistent records, not module mocks.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$ declare p uuid; begin
 if exists(select 1 from horses) or exists(select 1 from sessions) or exists(select 1 from ratings) then raise exception 'Account RLS leaked data'; end if;
 select id into p from phases where program='foundation' and code='groundwork';
 begin
  perform public.create_session_with_ratings('10000000-0000-0000-0000-000000000001',p,now(),'Cross account',null,null,'[]','[]');
  raise exception 'Expected cross-account write rejection';
 exception when others then if sqlerrm='Expected cross-account write rejection' then raise; end if; end;
 begin
  perform public.update_session_with_ratings('90000000-0000-0000-0000-000000000001',null,null,null,null,null,'[]');
  raise exception 'Expected unavailable edit rejection';
 exception when others then if sqlerrm='Expected unavailable edit rejection' then raise; end if; end;
end $$;
reset role;
select 'PASS: persistent two-horse records, Foundation rider, independent performance tasks, atomic rollback, account RLS and inaccessible edit rejection' as result;
