-- After a real legacy->facility schema upgrade in the disposable fixture DB.
begin;
do $$ begin
 if (select count(*) from auth.users)<>2 or (select count(*) from tqa_legacy.horses)<>2 or exists(select 1 from public.horses) then raise exception 'Upgrade lost or exposed legacy records'; end if;
 if (select count(*) from public.profiles where display_name='Synthetic legacy trainer')<>2 then raise exception 'Profiles lost'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
create temporary table transition_test(k text primary key,v uuid);
do $$ declare s jsonb; f public.facilities; req uuid:=gen_random_uuid(); begin
 s:=public.facility_transition_status();
 if not (s->>'has_pending_data')::boolean or s->'counts'->>'horses'<>'1' or s->'counts'->>'sessions'<>'1' then raise exception 'Incorrect private legacy counts'; end if;
 begin perform 1 from tqa_legacy.horses; raise exception 'Archive exposed'; exception when insufficient_privilege then null; end;
 begin perform public._attach_legacy_facility(gen_random_uuid()); raise exception 'Private import helper exposed'; exception when insufficient_privilege then null; end;
 f:=public.create_facility('Legacy A facility',req);insert into transition_test values('a',f.id);
 if public.create_facility('Legacy A facility',req)<>f then raise exception 'Retry created a different facility'; end if;
 s:=public.facility_transition_status();if (s->>'has_pending_data')::boolean or s->>'completed_facility_id'<>f.id::text then raise exception 'Transition not completed'; end if;
 if (select count(*) from public.horses)<>1 or (select count(*) from public.sessions)<>1 or (select count(*) from public.ratings)<>1 then raise exception 'Import missing or duplicated records'; end if;
 f:=public.create_facility('Another A facility',gen_random_uuid());
 if exists(select 1 from public.horses where facility_id=f.id) then raise exception 'Legacy data imported twice'; end if;
end $$;
-- B sees only B's pending counts, never A's imported records.
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
do $$ begin
 if exists(select 1 from public.horses) or public.facility_transition_status()->'counts'->>'horses'<>'1' then raise exception 'Cross-user leak'; end if;
end $$;
reset role;
-- Verify every original field/ID/reference/snapshot, not just totals.
do $$ declare t text; n bigint; begin
 foreach t in array array['phases','questions','horses','sessions','ratings','trifecta_evaluations','trifecta_scores','resources'] loop
  execute format('select count(*) from tqa_legacy.%1$I s left join public.%1$I d on d.id=s.id where s.user_id=''50000000-0000-0000-0000-000000000001'' and ((to_jsonb(d)-''facility_id''-''updated_by'') is distinct from to_jsonb(s))',t) into n;
  if n<>0 then raise exception 'Legacy fields changed or missing for %',t; end if;
 end loop;
end $$;
create function public.fail_legacy_import() returns trigger language plpgsql as $$ begin
 if new.user_id='50000000-0000-0000-0000-000000000002' then raise exception 'Injected import failure'; end if;return new;end $$;
create trigger fail_legacy_import before insert on public.ratings for each row execute function public.fail_legacy_import();
set local role authenticated;
do $$ begin
 begin perform public.create_facility('Legacy B facility','60000000-0000-0000-0000-000000000001');raise exception 'Expected failure'; exception when raise_exception then if sqlerrm<>'Injected import failure' then raise; end if; end;
 if exists(select 1 from public.facilities) or exists(select 1 from public.horses) or not (public.facility_transition_status()->>'has_pending_data')::boolean then raise exception 'Failed import was partial'; end if;
end $$;
reset role;
drop trigger fail_legacy_import on public.ratings;
set local role authenticated;
select public.create_facility('Legacy B facility','60000000-0000-0000-0000-000000000001');
do $$ begin
 if (select count(*) from public.horses)<>1 or (select count(*) from public.ratings where score=-2)<>1 then raise exception 'Retry did not preserve signed score'; end if;
 if (select count(*) from public.phases)<>7 or not exists(select 1 from public.questions q join public.phases p on p.id=q.phase_id where p.code='phase_1' and p.program='foundation' and q.axis='foundation' and q.position=7) then raise exception 'Missing canonical defaults not filled'; end if;
 if exists(select 1 from public.horses where facility_id=(select v from transition_test where k='a')) then raise exception 'B read A facility'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from tqa_legacy.horses)<>2 or (select count(*) from public.horses)<>2 or (select count(*) from auth.users)<>2 then raise exception 'Archive/account/data preservation failed'; end if;
end $$;
commit;
select 'PASS: real legacy upgrade, preserved accounts/profiles/IDs/full historical fields, private setup, owner isolation, atomic rollback, retry and no duplicate import' as result;
