-- Only the disposable TQA fixture uses trusted synthetic actor headers.
create or replace function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif(current_setting('request.headers',true),'')::jsonb->>'x-tqa-test-user')::uuid;
$$;
