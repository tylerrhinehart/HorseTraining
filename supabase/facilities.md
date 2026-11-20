# Fresh TQA facility database

Run `supabase/schema.sql` once against a **new Supabase database without TQA tables or existing TQA Auth users**, then apply the separately documented ride-draft schema if using that feature. It initializes in one transaction and does not drop application tables. The older per-user migration SQL is not part of this installation. No legacy migration or reset is required or supported by this setup.

## App calls and access

- With email confirmation on, create the Auth user and complete confirmation before calling `create_facility(p_name,p_request_id)` or `redeem_facility_invite(p_token)`. Both return a row from `facilities`. Creating a facility creates its owner and seeds the canonical program once in the same transaction; joining does not reseed it. Reuse a request UUID when retrying facility creation to avoid re-creating a workspace after a lost response.
- A facility owner can call `create_facility_invite(p_facility_id,p_email,p_role)` for a trainer or admin. An admin can invite a trainer only. The call returns a raw, single-use token; do not log it, include it in telemetry, or store it in analytics. It expires after seven days and can only be redeemed by a confirmed Supabase user with the matching email while the inviter is still authorized. Reissue for the same email invalidates earlier pending tokens, subject to the admin/owner role rules.
- Users can read their memberships and facility metadata (including suspended status). Managers can read the roster for a facility they actively manage. Owners can change membership role; owners can remove members and admins can remove trainers. An owner cannot be removed or demoted if that would leave no owner, including if an Auth deletion would cascade into the last owner membership.
- Actual training records belong to a facility. Their original actor is `user_id`, and `updated_by` indicates the last editing actor. Account deletion clears attribution that references the deleted account without deleting shared training records. Ownership and author are immutable through the client. After a removal or suspension, ongoing writes serialize against the facility lock; the next access check will reject the revoked write.
- Explicitly scope client queries to the active facility even if a trainer belongs to more than one. RLS, not a client query filter, enforces membership. IDs for domain records never imply membership by themselves. The existing ride/assessment RPCs derive facility from the supplied parent record and preserve the version guard on corrections. For direct horse and resource inserts, pass `facility_id`; the database sets actor attribution. Only managers can mutate reference resources.

## Platform control

Provision platform staff through a trusted database administrator path for a separately controlled, verified Supabase account. There is no client enrollment or self-promotion path for this table. Register the intended account ID through the SQL editor or privileged administration tooling, never from the browser client or Vite config:

```sql
insert into public.platform_super_admins (user_id)
values ('<verified-staff-auth-user-uuid>');
```

Platform functions require the account to exist in that table **and** a Supabase JWT at `aal2`. Enroll and verify MFA through Supabase Auth, then refresh the current session before attempting platform access. Platform role alone does not grant training-record visibility. `platform_list_facilities` provides the facility inventory; `platform_set_facility_controls` sets active/suspended status and the voice flag with a required reason and an atomic before/after audit entry. `platform_list_facility_audit` supplies up to the latest 100 audit entries for a facility. Voice is disabled by default, and facility controls are not writable through the normal app client.

## Focused verification

On a disposable PostgreSQL database with the repository's test Auth stub, load `tests/database/bootstrap.sql`, `supabase/schema.sql`, then `supabase/tests/facilities.sql`. The focused fixture rolls its data back. Never point the test fixture at production.
