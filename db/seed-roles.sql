-- ============================================================================
-- db/seed-roles.sql — ASSIGN YOUR OWN Admin / Staff roles (students run this)
-- Spec: pos-catalog-site-core  |  Task 10
-- Target: Supabase (PostgreSQL)
-- ----------------------------------------------------------------------------
-- Promotes accounts you ALREADY REGISTERED to Admin / Staff so you can see
-- every dashboard (Session 3, Step 1). Every new account starts as USER /
-- NON_MEMBER (set by the handle_new_user trigger in db/setup.sql); this script
-- changes the role for the emails you choose.
--
-- ORDER MATTERS — register first, then run this:
--   1. On your LIVE site, register the accounts you want (e.g. an admin email,
--      a staff email, and a regular user email). Registration creates the
--      auth.users row AND the matching public.profiles row (via the trigger).
--   2. Edit the two emails below to match the accounts you just registered.
--   3. Run this script in the Supabase SQL Editor.
--
-- Leave your third account as USER (no action needed — that is the default).
--
-- WHY THIS IS SAFE HERE: in the app, role changes go through the server-only
-- SERVICE-ROLE client (the only client allowed to write profiles.role under
-- RLS). The Supabase SQL Editor runs as a privileged database role that
-- likewise bypasses RLS, so a direct UPDATE here is the equivalent one-time
-- provisioning path. Do NOT expose this UPDATE to end users — the running app
-- only ever changes roles through the guarded Admin dashboard (Task 9.5).
--
-- IDEMPOTENT — safe to re-run; it simply re-sets the same roles. If an email
-- does not match a registered account, that row updates nothing (0 rows) — see
-- the verification query at the bottom to confirm what changed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Promote your ADMIN account.  <-- EDIT this email.
-- ----------------------------------------------------------------------------
update public.profiles
   set role = 'ADMIN'
 where id = (select id from auth.users where email = 'admin@example.com');

-- ----------------------------------------------------------------------------
-- 2) Promote your STAFF account.  <-- EDIT this email.
-- ----------------------------------------------------------------------------
update public.profiles
   set role = 'STAFF'
 where id = (select id from auth.users where email = 'staff@example.com');

-- ----------------------------------------------------------------------------
-- 3) (Optional) Verify the result. Run this SELECT to confirm the roles were
--    applied. Your third (USER) account should still show role = USER.
-- ----------------------------------------------------------------------------
select u.email, p.role, p.membership_status
  from public.profiles p
  join auth.users u on u.id = p.id
 order by p.role, u.email;
