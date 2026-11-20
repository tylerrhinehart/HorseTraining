-- Disposable PostgreSQL only: run after tests/database/bootstrap.sql and supabase/schema.sql.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('91f00000-0000-4000-a000-000000000001','owner@tqa.test',now()),
 ('91f00000-0000-4000-a000-000000000002','trainer@tqa.test',now()),
 ('91f00000-0000-4000-a000-000000000003','outside@tqa.test',now()),
 ('91f00000-0000-4000-a000-000000000004','unverified@tqa.test',null),
 ('91f00000-0000-4000-a000-000000000005','platform@tqa.test',now());
insert into public.platform_super_admins(user_id) values ('91f00000-0000-4000-a000-000000000005');

set local role authenticated;
do $$
declare
  own constant uuid := '91f00000-0000-4000-a000-000000000001';
  trainer constant uuid := '91f00000-0000-4000-a000-000000000002';
  other constant uuid := '91f00000-0000-4000-a000-000000000003';
  unverified constant uuid := '91f00000-0000-4000-a000-000000000004';
  operator constant uuid := '91f00000-0000-4000-a000-000000000005';
  f uuid; g uuid; r uuid; phase uuid; next_phase uuid; other_phase uuid; horse uuid;
  token text; create_request uuid:=gen_random_uuid(); row_version timestamptz; count_before bigint;
begin
  perform set_config('request.jwt.claim.sub', unverified::text,true);
  begin
    perform public.create_facility('Must not exist');
    raise exception 'Unverified account created a facility';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', own::text,true);
  select id into f from public.create_facility('Cooperative',create_request);
  if (select id from public.create_facility('Cooperative',create_request)) is distinct from f then
    raise exception 'Facility create retry was not idempotent';
  end if;
  begin
    perform public.create_facility('Different facility',create_request);
    raise exception 'Expected different facility retry rejection';
  exception when raise_exception then
    if sqlerrm <> 'Facility creation request ID reused with different details' then raise; end if;
  end;
  select count(*) into count_before from public.phases where facility_id=f;
  if count_before < 7 then raise exception 'Canonical template was not seeded'; end if;
  select id into phase from public.phases where facility_id=f and code='phase_1';
  select id into next_phase from public.phases where facility_id=f and code='phase_2';
  insert into public.horses(facility_id,user_id,name,current_phase_id)
    values(f,other,'Cooperative horse',phase) returning id into horse;
  if (select user_id from public.horses where id=horse) is distinct from own then
    raise exception 'Author spoofing accepted';
  end if;
  select id,updated_at into r,row_version from public.create_session_with_ratings(horse,phase,now(),'original',null,null,'[]','[]');
  token := public.create_facility_invite(f,' TRAINER@TQA.TEST ','trainer');
  begin
    perform public.remove_facility_member(f,own);
    raise exception 'Last owner removed';
  exception when raise_exception then
    if sqlerrm <> 'A facility must retain an owner' then raise; end if;
  end;
  begin
    perform public.set_facility_member_role(f,own,'trainer');
    raise exception 'Last owner demoted';
  exception when raise_exception then
    if sqlerrm <> 'A facility must retain an owner' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', other::text,true);
  select id into g from public.create_facility('Other facility');
  select id into other_phase from public.phases where facility_id=g and code='phase_1';
  if exists(select 1 from public.horses where id=horse) then raise exception 'Outsider can read horse'; end if;
  if exists(select 1 from public.sessions where id=r) then raise exception 'Outsider can read ride'; end if;
  update public.horses set name='wrong' where id=horse;
  if found then raise exception 'Outsider can edit horse'; end if;
  begin
    perform public.redeem_facility_invite(token);
    raise exception 'Wrong email redeemed invite';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', trainer::text,true);
  perform public.redeem_facility_invite(token);
  if (select count(*) from public.phases where facility_id=f) <> count_before then
    raise exception 'Trainer signup reseeded templates';
  end if;
  begin
    perform public.redeem_facility_invite(token);
    raise exception 'Replayed invite accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_facility_invite(f,'friend@tqa.test','trainer');
    raise exception 'Trainer invited another member';
  exception when insufficient_privilege then null;
  end;
  perform public.update_ride_record(r,row_version,next_phase,now(),'shared correction',null,null,'[]','[]');
  if not exists(select 1 from public.sessions where id=r and notes='shared correction'
      and phase_id=next_phase and user_id=own and updated_by=trainer) then
    raise exception 'Trainer correction or attribution failed';
  end if;
  begin
    perform public.update_ride_record(r,row_version,phase,now(),'stale update',null,null,'[]','[]');
    raise exception 'Stale ride version edited';
  exception when raise_exception then
    if sqlerrm not like 'This ride changed%' then raise; end if;
  end;
  begin
    update public.horses set current_phase_id=other_phase where id=horse;
    raise exception 'Cross-facility phase assigned';
  exception when raise_exception then
    if sqlerrm <> 'Horse phase must belong to the same facility and training program' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', own::text,true);
  perform public.remove_facility_member(f,trainer);
  perform set_config('request.jwt.claim.sub', trainer::text,true);
  if exists(select 1 from public.horses where id=horse) then raise exception 'Removed trainer retained access'; end if;

  perform set_config('request.jwt.claim.sub', operator::text,true);
  perform set_config('request.jwt.claims','{"aal":"aal1"}',true);
  begin
    perform public.platform_list_facilities();
    raise exception 'Platform actor bypassed MFA';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims','{"aal":"aal2"}',true);
  if (select count(*) from public.platform_list_facilities()) < 2 then raise exception 'Platform inventory failed'; end if;
  if exists(select 1 from public.horses where id=horse) then raise exception 'Platform role implicitly reads training records'; end if;
  perform public.platform_set_facility_controls(f,'suspended',false,'Test safety suspension');
  if not exists(select 1 from public.platform_list_facility_audit(f)
    where actor_id=operator and after_state->>'status'='suspended') then raise exception 'No platform audit record'; end if;
  perform set_config('request.jwt.claim.sub', own::text,true);
  if exists(select 1 from public.horses where id=horse) then raise exception 'Suspended facility retained domain access'; end if;
  if not exists(select 1 from public.facilities where id=f and status='suspended') then
    raise exception 'Facility owner cannot see suspension status';
  end if;
  begin
    perform public.platform_set_facility_controls(f,'active',true,'Spoofed');
    raise exception 'Facility owner could change platform controls';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
delete from auth.users where id='91f00000-0000-4000-a000-000000000002';
do $$
begin
  if not exists(select 1 from public.sessions where notes='shared correction' and updated_by is null) then
    raise exception 'Account deletion removed or failed to scrub shared attribution';
  end if;
  begin
    delete from auth.users where id='91f00000-0000-4000-a000-000000000001';
    raise exception 'Auth deletion removed last facility owner';
  exception when raise_exception then
    if sqlerrm <> 'A facility must retain an owner' then raise; end if;
  end;
end $$;
rollback;
select 'facility isolation, invites, owner protection, ride correction, attribution, MFA and audit' as result;
