// Generate a reviewable, atomic SQL upgrade; this script never connects to a DB.
// Supported source: the legacy per-user schema with program/ride-accuracy columns.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tables=['profiles','phases','questions','horses','sessions','ratings','trifecta_evaluations','trifecta_scores','resources'];
const functions=['create_session_with_ratings','handle_new_user','seed_canonical_template','touch_updated_at','update_ride_record','update_session_with_ratings','upsert_trifecta_with_scores','validate_owned_references'];
const quote=s=>`'${s.replaceAll("'","''")}'`;
const prefix=`begin;
set local lock_timeout='10s';
lock table auth.users in share row exclusive mode;
do $$ declare t text; f record; begin
 if to_regclass('public.facilities') is not null then raise exception 'Already facility-aware: apply facility_transition.sql only'; end if;
 if exists(select 1 from pg_namespace where nspname='tqa_legacy') then raise exception 'Legacy archive already exists; inspect before proceeding'; end if;
 if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal and tgname<>'on_auth_user_created') then raise exception 'Unrecognized Auth triggers; upgrade cancelled'; end if;
 if exists(select 1 from pg_class where relnamespace='public'::regnamespace and relkind in ('v','m')) then raise exception 'Unrecognized public views; upgrade cancelled'; end if;
 if exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname not in (${[...functions,'rls_auto_enable'].map(quote).join(',')}) and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')) then raise exception 'Unrecognized public functions; upgrade cancelled'; end if;
 if exists(select 1 from pg_tables where schemaname='public' and tablename not in (${[...tables,'tqas'].map(quote).join(',')})) then raise exception 'Unrecognized public tables; upgrade cancelled'; end if;
 foreach t in array array[${tables.map(quote).join(',')}] loop
  if to_regclass('public.'||t) is null then raise exception 'Required legacy table missing: %',t; end if;
  execute format('lock table public.%I in access exclusive mode',t);
 end loop;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='phases' and column_name='program')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='horses' and column_name='program_meta') then raise exception 'Apply the reviewed legacy program migration first'; end if;
 if to_regclass('public.tqas') is not null then
  execute 'lock table public.tqas in access exclusive mode';
  if exists(select 1 from public.tqas) then raise exception 'Nonempty obsolete tqas table needs a reviewed mapping; no data was changed'; end if;
 end if;
end $$;
create schema tqa_legacy;
revoke all on schema tqa_legacy from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
do $$ declare t text; f record; begin
 foreach t in array array[${tables.map(quote).join(',')},'tqas'] loop
  if to_regclass('public.'||t) is not null then execute format('alter table public.%I set schema tqa_legacy',t); end if;
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in (${functions.map(quote).join(',')}) loop
  execute format('alter function %s set schema tqa_legacy',f.signature);
 end loop;
end $$;
revoke all on all tables in schema tqa_legacy from public,anon,authenticated;
revoke all on all sequences in schema tqa_legacy from public,anon,authenticated;
revoke all on all functions in schema tqa_legacy from public,anon,authenticated;
`;
const strip=s=>s.replace(/^\s*(begin|commit);\s*$/gmi,'');
const files=['schema.sql','ride_drafts.sql','guided_voice.sql','facility_transition.sql','platform_access_status.sql','platform_facility_controls.sql'];
const body=files.map(f=>`\n-- ${f}\n`+strip(fs.readFileSync(path.join(root,'supabase',f),'utf8'))).join('\n');
const suffix=`
-- Preserve every Auth account and its original profile. Training rows remain
-- private in tqa_legacy until that same verified user creates their facility.
insert into public.profiles(id,display_name,created_at)
select id,display_name,created_at from tqa_legacy.profiles;
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;
notify pgrst,'reload schema';
commit;
`;
process.stdout.write('-- NON-DESTRUCTIVE LEGACY FACILITY UPGRADE. Review before applying.\n'+prefix+body+suffix);
