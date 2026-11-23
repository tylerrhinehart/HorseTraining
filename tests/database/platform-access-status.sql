begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
do $$ begin
 if (public.platform_access_status()->>'assigned')::boolean or not (public.platform_access_status()->>'mfa_verified')::boolean or public.platform_is_super_admin() then raise exception 'MFA must not grant the platform role'; end if;
end $$;
reset role;
insert into public.platform_super_admins(user_id) values('00000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
do $$ begin
 if not (public.platform_access_status()->>'assigned')::boolean or (public.platform_access_status()->>'mfa_verified')::boolean or public.platform_is_super_admin() then raise exception 'Role without MFA must remain denied'; end if;
end $$;
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
do $$ begin
 if not (public.platform_access_status()->>'assigned')::boolean or not public.platform_is_super_admin() then raise exception 'Role plus MFA should allow controls'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.platform_access_status()','execute') then raise exception 'Anonymous status access exposed'; end if;
end $$;
rollback;
select 'PASS: own-account platform role and MFA status remain separate; no authorization bypass' as result;
