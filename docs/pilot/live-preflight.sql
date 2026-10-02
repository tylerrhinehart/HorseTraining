-- Read-only. Capture output locally before any production DDL approval.
begin transaction read only;
select current_database(), current_user, version();
select pg_get_functiondef('public.update_session_with_ratings(uuid,timestamptz,text,text,text,jsonb,jsonb)'::regprocedure) as rollback_update_function;
select tablename, policyname, roles, cmd, qual, with_check from pg_policies where schemaname='public' order by tablename,policyname;
select c.relname, c.relrowsecurity, pg_get_constraintdef(k.oid) from pg_class c left join pg_constraint k on k.conrelid=c.oid where c.relnamespace='public'::regnamespace and c.relname in ('horses','phases','sessions','questions','ratings','resources','trifecta_evaluations','trifecta_scores') order by c.relname;
select 'horses_current_phase' check_name, count(*) violations from horses h where h.current_phase_id is not null and not exists(select 1 from phases p where p.id=h.current_phase_id and p.user_id=h.user_id and p.program=h.training_type)
union all select 'questions_phase', count(*) from questions q where not exists(select 1 from phases p where p.id=q.phase_id and p.user_id=q.user_id)
union all select 'sessions_ownership', count(*) from sessions s where not exists(select 1 from horses h join phases p on p.id=s.phase_id where h.id=s.horse_id and h.user_id=s.user_id and p.user_id=s.user_id)
union all select 'ratings_reference_scale', count(*) from ratings r where not exists(select 1 from sessions s join questions q on q.id=r.question_id join phases p on p.id=s.phase_id where s.id=r.session_id and s.user_id=r.user_id and q.user_id=r.user_id and q.phase_id=s.phase_id and q.axis=r.axis_snapshot and ((p.scale='tqa' and r.score between -3 and 3) or (p.scale='five' and r.score between 1 and 5)))
union all select 'evaluation_horse', count(*) from trifecta_evaluations e where not exists(select 1 from horses h where h.id=e.horse_id and h.user_id=e.user_id)
union all select 'evaluation_score', count(*) from trifecta_scores s where not exists(select 1 from trifecta_evaluations e where e.id=s.evaluation_id and e.user_id=s.user_id)
union all select 'resource_target', count(*) from resources r where (r.phase_id is not null and not exists(select 1 from phases p where p.id=r.phase_id and p.user_id=r.user_id)) or (r.question_id is not null and not exists(select 1 from questions q where q.id=r.question_id and q.user_id=r.user_id));
rollback;
