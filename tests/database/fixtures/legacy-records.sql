-- All records are synthetic; no production export is used.
insert into auth.users(id,email,email_confirmed_at) values
 ('50000000-0000-0000-0000-000000000001','legacy-a@example.invalid',now()),
 ('50000000-0000-0000-0000-000000000002','legacy-b@example.invalid',now());
do $$ declare u uuid; p uuid; q uuid; h uuid; begin
 foreach u in array array['50000000-0000-0000-0000-000000000001'::uuid,'50000000-0000-0000-0000-000000000002'::uuid] loop
  perform set_config('request.jwt.claim.sub',u::text,true);
  update public.profiles set display_name='Synthetic legacy trainer' where id=u;
  select id into p from public.phases where user_id=u and program='foundation' and code='phase_1';
  select id into q from public.questions where user_id=u and phase_id=p and axis='foundation' order by position limit 1;
  update public.questions set text='Custom legacy metric',low_label='Custom low',high_label='Custom high' where id=q;
  insert into public.horses(user_id,name,owner_name,owner_contact,training_type,current_phase_id,program_meta,notes)
  values(u,'Synthetic legacy horse','Synthetic owner','example.invalid','foundation',p,'{"training_goals":["fence_work"],"weekly_comments":{"2026-05-18":"Original weekly note"}}','Original horse notes') returning id into h;
  perform public.create_session_with_ratings(h,p,'2026-05-20T15:00Z','Original ride notes','Synthetic rider',null,'[]',jsonb_build_array(jsonb_build_object('question_id',q,'axis','foundation','question_text_snapshot','Historical metric snapshot','score',-2,'comment','Original comment')));
  perform public.upsert_trifecta_with_scores(h,'Original evaluation',jsonb_build_array(jsonb_build_object('axis','foundation','item_code','legacy_item','item_text_snapshot','Legacy evaluation snapshot','score',2,'comment','Evaluation comment')));
  insert into public.resources(user_id,phase_id,title,url,kind,notes,position) values(u,p,'Custom legacy resource','https://example.invalid/custom','link','Original resource note',99);
 end loop;
end $$;
-- B has a partial older reference catalog; missing defaults must be filled without
-- overwriting B's surviving custom question text or original historical IDs.
delete from public.phases where user_id='50000000-0000-0000-0000-000000000002' and program='sale_horse';
delete from public.questions where user_id='50000000-0000-0000-0000-000000000002' and axis='foundation' and position=7 and phase_id in (select id from public.phases where user_id='50000000-0000-0000-0000-000000000002' and code='phase_1' and program='foundation');
