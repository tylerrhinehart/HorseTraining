-- Disposable PostgreSQL only. The fixture validates the additive migration.
begin;
insert into auth.users(id,email,email_confirmed_at) values
  ('92f00000-0000-4000-a000-000000000001','controls-owner@tqa.test',now()),
  ('92f00000-0000-4000-a000-000000000002','controls-operator@tqa.test',now());
insert into public.platform_super_admins(user_id) values ('92f00000-0000-4000-a000-000000000002');

set local role authenticated;
do $$
declare
  owner_id constant uuid := '92f00000-0000-4000-a000-000000000001';
  operator_id constant uuid := '92f00000-0000-4000-a000-000000000002';
  facility public.facilities;
  audit_count bigint;
begin
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', true);
  facility := public.create_facility('Controls fixture');
  begin
    perform public.platform_update_facility(facility.id, 'voice', true);
    raise exception 'A facility owner without the platform role could change controls';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.platform_list_facility_audit(facility.id);
    raise exception 'A facility owner without the platform role could read platform history';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', operator_id::text, true);
  perform set_config('request.jwt.claims', '{"aal":"aal1"}', true);
  begin
    perform public.platform_update_facility(facility.id, 'status', false);
    raise exception 'A platform operator without MFA could change controls';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.platform_list_facility_audit(facility.id);
    raise exception 'A platform operator without MFA could read platform history';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', '{"aal":"aal2"}', true);
  begin
    perform public.platform_update_facility(facility.id, 'unsupported', true);
    raise exception 'Invalid facility control accepted';
  exception when invalid_parameter_value then null;
  end;
  select * into facility from public.platform_update_facility(facility.id, 'voice', true);
  if not facility.voice_enabled or facility.status <> 'active' then
    raise exception 'Voice update failed or changed access status';
  end if;
  select * into facility from public.platform_update_facility(facility.id, 'status', false);
  if facility.status <> 'suspended' or not facility.voice_enabled then
    raise exception 'Suspension failed or overwrote the voice setting';
  end if;
  perform public.platform_update_facility(facility.id, 'status', false);
  if (select count(*) from public.platform_list_facility_audit(facility.id)) <> 2 then
    raise exception 'No-op retry created a duplicate audit entry';
  end if;
  select count(*) into audit_count from public.platform_list_facility_audit(facility.id)
  where actor_id = operator_id
    and ((reason = 'Voice enabled'
      and before_state = '{"status":"active","voice_enabled":false}'::jsonb
      and after_state = '{"status":"active","voice_enabled":true}'::jsonb)
      or (reason = 'Facility suspended'
      and before_state = '{"status":"active","voice_enabled":true}'::jsonb
      and after_state = '{"status":"suspended","voice_enabled":true}'::jsonb));
  if audit_count <> 2 then raise exception 'Incorrect automatic audit details'; end if;

  select * into facility from public.platform_update_facility(facility.id, 'voice', false);
  if facility.voice_enabled or facility.status <> 'suspended' then
    raise exception 'Disabling voice changed the suspended status';
  end if;
  select * into facility from public.platform_update_facility(facility.id, 'status', true);
  if facility.status <> 'active' or facility.voice_enabled then
    raise exception 'Reactivation overwrote the disabled voice setting';
  end if;
  perform public.platform_set_facility_controls(facility.id, 'active', true, 'Legacy client');
  if not exists(select 1 from public.platform_list_facility_audit(facility.id) where reason = 'Legacy client') then
    raise exception 'Legacy facility controls became incompatible';
  end if;
end $$;
reset role;

do $$
begin
  if has_function_privilege('anon', 'public.platform_update_facility(uuid,text,boolean)', 'execute') then
    raise exception 'Anonymous platform control function exposed';
  end if;
end $$;
rollback;
select 'PASS: independent facility controls, automatic audit, safe retry, platform role plus MFA, legacy client compatibility' as result;
