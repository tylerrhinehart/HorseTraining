-- Uses the synthetic trainer from acceptance.sql. All test records are rolled back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
do $$ declare
  h uuid; p uuid; next_p uuid; performance_p uuid; q uuid; ride sessions; old_scores jsonb;
begin
  select id into strict p from phases where program = 'foundation' and code = 'groundwork';
  select id into strict next_p from phases where program = 'foundation' and code = 'phase_1';
  select id into strict performance_p from phases where program = 'foundation_to_finish';
  select id into strict q from questions where phase_id = p order by position, id limit 1;
  insert into horses(facility_id, user_id, name, training_type, current_phase_id)
    values((select facility_id from phases where id=next_p), auth.uid(), 'Phase correction fixture', 'foundation', next_p) returning id into h;
  old_scores := jsonb_build_array(jsonb_build_object('question_id', q, 'axis',
    (select axis from questions where id = q), 'question_text_snapshot', 'Original question', 'score', 0));
  select * into ride from public.create_session_with_ratings(h,p,now(),'Original notes',null,null,'[]',old_scores);
  begin
    perform public.update_ride_record(ride.id,ride.updated_at,next_p,now(),'Wrong question',null,null,'[]',old_scores);
    raise exception 'Expected question rejection';
  exception when others then
    if sqlerrm = 'Expected question rejection' then raise; end if;
  end;
  begin
    perform public.update_ride_record(ride.id,ride.updated_at,performance_p,now(),'Wrong program',null,null,'[]','[]');
    raise exception 'Expected program rejection';
  exception when others then
    if sqlerrm = 'Expected program rejection' then raise; end if;
  end;
  if not exists (select 1 from sessions where id = ride.id and phase_id = p and notes = 'Original notes')
     or not exists (select 1 from ratings where session_id = ride.id and question_id = q and score = 0)
  then raise exception 'Rejected correction modified the saved ride'; end if;
end $$;
rollback;
