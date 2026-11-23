-- Own-account access diagnostics only; this does not grant any platform role.
begin;
create or replace function public.platform_access_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return jsonb_build_object(
  'assigned',exists(select 1 from public.platform_super_admins where user_id=auth.uid()),
  'mfa_verified',coalesce(auth.jwt()->>'aal'='aal2',false)
 );
end $$;
revoke all on function public.platform_access_status() from public,anon;
grant execute on function public.platform_access_status() to authenticated;
notify pgrst,'reload schema';
commit;
