-- Add single-control updates to existing platform installations. The existing
-- four-argument RPC remains available to clients during the rollout.
begin;

create or replace function public.platform_update_facility(
  p_facility_id uuid,
  p_control text,
  p_enabled boolean
)
returns public.facilities
language plpgsql security definer set search_path = '' as $$
declare
  current_facility public.facilities;
  next_status text;
  next_voice boolean;
  audit_reason text;
begin
  if not public.platform_is_super_admin() then
    raise exception 'Platform access requires admin MFA' using errcode = '42501';
  end if;
  if p_control is null or p_control not in ('status', 'voice') or p_enabled is null then
    raise exception 'Valid facility control and setting are required' using errcode = '22023';
  end if;

  select * into current_facility from public.facilities where id = p_facility_id for update;
  if not found then raise exception 'Facility not found'; end if;

  next_status := current_facility.status;
  next_voice := current_facility.voice_enabled;
  if p_control = 'status' then
    next_status := case when p_enabled then 'active' else 'suspended' end;
    audit_reason := case when p_enabled then 'Facility reactivated' else 'Facility suspended' end;
  else
    next_voice := p_enabled;
    audit_reason := case when p_enabled then 'Voice enabled' else 'Voice disabled' end;
  end if;

  -- Retrying a successful command leaves both controls and its audit trail intact.
  if (next_status, next_voice) = (current_facility.status, current_facility.voice_enabled) then
    return current_facility;
  end if;

  -- The row lock keeps the independent control stable through the shared write.
  return public.platform_set_facility_controls(p_facility_id, next_status, next_voice, audit_reason);
end;
$$;

revoke all on function public.platform_update_facility(uuid,text,boolean) from public, anon;
grant execute on function public.platform_update_facility(uuid,text,boolean) to authenticated;
notify pgrst, 'reload schema';

commit;
