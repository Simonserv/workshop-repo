-- ============================================================================
-- Row Level Security: Three-Tier Catalog & Membership Website (Workshop Build)
-- Spec: pos-catalog-site-core  |  Task 4 — Define Row Level Security policies
-- Target: Supabase (PostgreSQL)
-- ----------------------------------------------------------------------------
-- RLS is the AUTHORITATIVE access boundary for this platform. Application-layer
-- role checks (assertRole) exist only for 401/403 responses and UX; the final
-- guarantee lives here, in the database. This file is layered ON TOP of
-- db/schema.sql (Task 3), which defines the tables, enum types, the new-user
-- profile trigger, and indexes but deliberately defers RLS and the approval
-- function to this task.
--
-- The caller's role is ALWAYS resolved server-side from `profiles` keyed by
-- auth.uid() (see public.current_user_role() below), never from client input.
--
-- Contents:
--   * 4.1  current_user_role() helper (role resolved from profiles)
--   * 4.2  listings   — RLS + read/write policies
--   * 4.3  inquiries  — RLS + insert/read/update policies
--   * 4.4  membership_receipts — RLS + insert/read/update policies
--   * 4.5  donations  — RLS + insert/read/update policies
--   * 4.6  profiles   — RLS + read/update policies
--   * 4.7  approve_receipt() — transactional receipt->APPROVED + user->MEMBER
--
-- Idempotent for safe re-runs (matching schema.sql conventions):
--   CREATE OR REPLACE FUNCTION, ALTER TABLE ... ENABLE ROW LEVEL SECURITY
--   (a no-op if already enabled), and DROP POLICY IF EXISTS before each
--   CREATE POLICY.
--
-- Enum values are uppercase exactly as in schema.sql
-- (ADMIN/STAFF/USER, MEMBER/NON_MEMBER, PENDING/APPROVED/REJECTED, ...).
--
-- Requirements covered: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 6.1,
-- 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.4, 11.1,
-- 11.2, 11.3, 12.1, 12.2, 13.1, 13.2, 13.3
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 4.1  Role-resolution helper
-- Resolves the caller's role from `profiles` by auth.uid(). Used inside every
-- policy so the role is derived from the verified session, NEVER from client
-- input (Requirements 6.1, 6.3, 7.1).
--
-- SECURITY DEFINER + a pinned search_path so the function reads `profiles`
-- irrespective of the invoker's RLS. This also prevents infinite recursion:
-- the profiles policies call this helper, and because it runs as definer it
-- does not itself re-trigger those policies.
--
-- Returns NULL for an anonymous caller (no auth.uid()) or a caller with no
-- profiles row; policies therefore treat "no role" as "not STAFF/ADMIN".
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;


-- ============================================================================
-- 4.2  listings
-- Read: published rows to anon/USER; ALL rows (published + unpublished) to
--       STAFF/ADMIN.
-- Write (insert/update, incl. publish via is_published): ADMIN only.
-- Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 7.1, 11.1, 11.2, 11.3
-- ============================================================================
alter table public.listings enable row level security;

-- Read: published visible to everyone; STAFF/ADMIN additionally see drafts.
drop policy if exists listings_read on public.listings;
create policy listings_read
  on public.listings
  for select
  using (
    is_published
    or public.current_user_role() in ('STAFF', 'ADMIN')
  );

-- Insert: ADMIN only.
drop policy if exists listings_insert on public.listings;
create policy listings_insert
  on public.listings
  for insert
  with check (public.current_user_role() = 'ADMIN');

-- Update (edit + publish/unpublish): ADMIN only.
drop policy if exists listings_update on public.listings;
create policy listings_update
  on public.listings
  for update
  using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');


-- ============================================================================
-- 4.3  inquiries
-- Insert: anonymous AND authenticated submitters (public submission).
-- Read:   USER reads only rows it owns (owner_id = auth.uid());
--         STAFF/ADMIN read all.
-- Update: status / handled_by changes — STAFF/ADMIN only.
-- Requirements: 4.1, 4.2, 7.2, 7.3, 7.4, 7.5, 12.1, 12.2
-- ============================================================================
alter table public.inquiries enable row level security;

-- Insert: no authentication required (anon + authenticated both allowed).
drop policy if exists inquiries_insert on public.inquiries;
create policy inquiries_insert
  on public.inquiries
  for insert
  with check (true);

-- Read: owner (authenticated USER) sees own; STAFF/ADMIN see all.
-- Anonymous / non-owning USERs are denied (owner_id = auth.uid() is false/null).
drop policy if exists inquiries_read on public.inquiries;
create policy inquiries_read
  on public.inquiries
  for select
  using (
    owner_id = auth.uid()
    or public.current_user_role() in ('STAFF', 'ADMIN')
  );

-- Update (status / handled_by triage): STAFF/ADMIN only.
drop policy if exists inquiries_update on public.inquiries;
create policy inquiries_update
  on public.inquiries
  for update
  using (public.current_user_role() in ('STAFF', 'ADMIN'))
  with check (public.current_user_role() in ('STAFF', 'ADMIN'));


-- ============================================================================
-- 4.4  membership_receipts
-- Insert: authenticated user inserts its OWN receipt, and only as PENDING.
-- Read:   USER reads own; STAFF/ADMIN read all.
-- Update: review (status / reviewed_by / review_note) — STAFF/ADMIN only.
-- Requirements: 7.2, 7.3, 7.4, 8.2, 8.3, 8.5
-- ============================================================================
alter table public.membership_receipts enable row level security;

-- Insert: the authenticated user may only create a receipt for themselves,
-- and it must start PENDING (status is granted only through review / the
-- approve_receipt() function below).
drop policy if exists membership_receipts_insert on public.membership_receipts;
create policy membership_receipts_insert
  on public.membership_receipts
  for insert
  with check (
    user_id = auth.uid()
    and status = 'PENDING'
  );

-- Read: owning USER sees own; STAFF/ADMIN see all.
drop policy if exists membership_receipts_read on public.membership_receipts;
create policy membership_receipts_read
  on public.membership_receipts
  for select
  using (
    user_id = auth.uid()
    or public.current_user_role() in ('STAFF', 'ADMIN')
  );

-- Update (review): STAFF/ADMIN only. Transactional approval that also flips
-- the user to MEMBER goes through approve_receipt() (4.7); this policy covers
-- rejection and other status/reviewer writes performed by STAFF/ADMIN.
drop policy if exists membership_receipts_update on public.membership_receipts;
create policy membership_receipts_update
  on public.membership_receipts
  for update
  using (public.current_user_role() in ('STAFF', 'ADMIN'))
  with check (public.current_user_role() in ('STAFF', 'ADMIN'));


-- ============================================================================
-- 4.5  donations
-- Insert: anonymous allowed (amount > 0 is enforced by the schema CHECK).
-- Read:   STAFF/ADMIN only; everyone else none.
-- Update: review (status / reviewed_by / review_note) — STAFF/ADMIN only.
-- Requirements: 9.1, 9.2, 9.4, 7.3, 7.4
-- ============================================================================
alter table public.donations enable row level security;

-- Insert: no authentication required. amount > 0 is guaranteed by the
-- CHECK (amount > 0) constraint in schema.sql, so it is not re-checked here.
drop policy if exists donations_insert on public.donations;
create policy donations_insert
  on public.donations
  for insert
  with check (true);

-- Read: STAFF/ADMIN only (donations carry no owner; anon/USER get nothing).
drop policy if exists donations_read on public.donations;
create policy donations_read
  on public.donations
  for select
  using (public.current_user_role() in ('STAFF', 'ADMIN'));

-- Update (verify / reject review): STAFF/ADMIN only.
drop policy if exists donations_update on public.donations;
create policy donations_update
  on public.donations
  for update
  using (public.current_user_role() in ('STAFF', 'ADMIN'))
  with check (public.current_user_role() in ('STAFF', 'ADMIN'));


-- ============================================================================
-- 4.6  profiles
-- Read:   a member reads only their OWN profile; ADMIN reads all.
-- Update: role changes are ADMIN only (performed via the service-role client).
-- Requirements: 7.1, 13.1, 13.2, 13.3
--
-- NOTE: profiles rows are created by the handle_new_user() trigger
-- (SECURITY DEFINER, Task 3), so no INSERT policy is needed for normal
-- registration. The service-role client bypasses RLS entirely for the few
-- privileged admin writes; these policies constrain ordinary (anon/authed)
-- clients where RLS applies.
-- ============================================================================
alter table public.profiles enable row level security;

-- Read: own profile for any authenticated member; ADMIN sees all.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read
  on public.profiles
  for select
  using (
    id = auth.uid()
    or public.current_user_role() = 'ADMIN'
  );

-- Update: ADMIN only (role assignment). The server performs role changes with
-- the service-role client; this policy ensures that via the RLS-governed path
-- only an ADMIN may update a profile.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update
  on public.profiles
  for update
  using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');


-- ============================================================================
-- 4.7  approve_receipt() — transactional membership approval
-- Sets the receipt to APPROVED and the owning user's membership_status to
-- MEMBER in a SINGLE atomic transaction. This is the ONLY path that grants
-- MEMBER (Correctness Property 1; Requirements 8.3, 8.4).
--
-- Mirrors the design's approveReceipt algorithm:
--   * caller must be STAFF/ADMIN (resolved server-side, never client-supplied)
--   * 404 if the receipt does not exist
--   * 409 if the receipt is not PENDING (review is terminal and single)
--   * on success: receipt.status -> APPROVED, receipt.reviewed_by -> caller,
--     owning user.membership_status -> MEMBER
--
-- SECURITY DEFINER so the single atomic write succeeds under one role; the
-- STAFF/ADMIN guard inside the body keeps it from being an escalation path.
-- A plpgsql function body is one transaction, so both updates commit together
-- or not at all.
-- ============================================================================
create or replace function public.approve_receipt(p_receipt_id uuid)
returns public.membership_receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role := public.current_user_role();
  v_receipt     public.membership_receipts;
begin
  -- Authorize: STAFF/ADMIN only (role is server-resolved, not client-supplied).
  if v_caller_role is null or v_caller_role not in ('STAFF', 'ADMIN') then
    raise exception 'Forbidden: only STAFF or ADMIN may approve receipts'
      using errcode = '42501';  -- insufficient_privilege (-> 403)
  end if;

  -- Lock the receipt row so concurrent reviews cannot both pass the guard.
  select * into v_receipt
  from public.membership_receipts
  where id = p_receipt_id
  for update;

  -- 404: no such receipt.
  if not found then
    raise exception 'Receipt % not found', p_receipt_id
      using errcode = 'no_data_found';  -- P0002 (-> 404 in the app layer)
  end if;

  -- 409: already reviewed (review is terminal and single).
  if v_receipt.status <> 'PENDING' then
    raise exception 'Receipt % is not PENDING (already reviewed)', p_receipt_id
      using errcode = '23505';  -- unique_violation, mapped to 409 Conflict
  end if;

  -- Atomic: receipt -> APPROVED (record reviewer) and owning user -> MEMBER.
  update public.membership_receipts
    set status      = 'APPROVED',
        reviewed_by = auth.uid()
    where id = p_receipt_id
    returning * into v_receipt;

  update public.profiles
    set membership_status = 'MEMBER'
    where id = v_receipt.user_id;

  return v_receipt;
end;
$$;
