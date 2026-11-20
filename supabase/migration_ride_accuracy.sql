-- Atomic edit of a ride and its question set, including historical Foundation rides.
create or replace function public.update_ride_record(
  p_session_id uuid, p_expected_updated_at timestamptz, p_phase_id uuid,
  p_occurred_at timestamptz, p_notes text, p_rider text, p_bit text,
  p_task_completions jsonb, p_ratings jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  saved public.sessions;
begin
  select * into saved from public.sessions
    where id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception 'Ride not found or unavailable'; end if;
  if saved.updated_at is distinct from p_expected_updated_at then
    raise exception 'This ride changed since you opened it. Reload the ride to review the latest version.';
  end if;
  if p_phase_id is not null and p_phase_id <> saved.phase_id then
    if not exists (
      select 1 from public.phases old_phase join public.phases new_phase
        on new_phase.user_id = old_phase.user_id and new_phase.program = old_phase.program
      where old_phase.id = saved.phase_id and old_phase.user_id = saved.user_id
        and old_phase.program = 'foundation' and new_phase.id = p_phase_id
    ) then raise exception 'Choose a Foundation phase belonging to this trainer'; end if;
    if jsonb_typeof(p_ratings) is distinct from 'array' then
      raise exception 'A phase correction requires a replacement score sheet';
    end if;
    update public.sessions set phase_id = p_phase_id where id = saved.id;
  end if;
  perform public.update_session_with_ratings(saved.id, p_occurred_at, p_notes, p_rider, p_bit, p_task_completions, p_ratings);
end $$;
revoke all on function public.update_ride_record(uuid,timestamptz,uuid,timestamptz,text,text,text,jsonb,jsonb) from public;
grant execute on function public.update_ride_record(uuid,timestamptz,uuid,timestamptz,text,text,text,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
