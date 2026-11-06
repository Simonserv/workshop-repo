-- ============================================================================
-- db/setup.sql — ONE-SHOT PROVISIONING SCRIPT (students run this on their OWN
-- Supabase project)  |  Spec: pos-catalog-site-core  |  Task 10
-- Target: Supabase (PostgreSQL)
-- ----------------------------------------------------------------------------
-- This bundles everything needed to stand up the database security model in a
-- single paste-and-run script, in the correct order:
--
--   1. Extensions + enum types + tables + new-user trigger + indexes  (schema)
--   2. Row Level Security: the current_user_role() helper + all policies (RLS)
--   3. approve_receipt(): the transactional receipt->APPROVED + user->MEMBER
--      function (the ONLY path that grants membership)
--
-- It is the student-facing superset of db/schema.sql (Task 3) + db/rls.sql
-- (Task 4). Those two files remain the authoritative per-task sources; this
-- file is assembled from them so a student pastes ONE file in the Supabase SQL
-- Editor (see docs/workshop/Session-2-Setup-Reference.md, Step 2).
--
-- IDEMPOTENT — safe to re-run on the same project:
--   * CREATE EXTENSION IF NOT EXISTS, CREATE TABLE IF NOT EXISTS
--   * guarded DO blocks for enum types
--   * CREATE OR REPLACE FUNCTION
--   * DROP TRIGGER / DROP POLICY IF EXISTS before each CREATE
--   * ALTER TABLE ... ENABLE ROW LEVEL SECURITY (a no-op if already enabled)
--
-- WHAT THIS FILE DOES NOT DO (deliberately, separate student steps):
--   * It does NOT create the private `receipts` Storage bucket — that is a
--     manual Storage step (Session 2, Step 3): create a bucket named exactly
--     `receipts` with Public turned OFF.
--   * It does NOT seed listings — run db/seed.sql (Session 2, Step 4).
--   * It does NOT assign roles — run db/seed-roles.sql after registering your
--     accounts (Session 3, Step 1).
--
-- RLS is the AUTHORITATIVE access boundary. Application-layer assertRole gives
-- 401/403 + UX only; the database decides access, using a role resolved
-- server-side from `profiles` via auth.uid(), never from client input.
-- ============================================================================


-- ############################################################################
-- PART 1 — SCHEMA (from db/schema.sql)
-- Tables, enum types, the new-user profile trigger, and indexes.
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Extensions — gen_random_uuid() is provided by pgcrypto (available on Supabase).
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- Enum types (guarded so re-running does not error). Values are spelled
-- EXACTLY as the design's data models require (uppercase).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('ADMIN', 'STAFF', 'USER');
  end if;

  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type membership_status as enum ('MEMBER', 'NON_MEMBER');
  end if;

  if not exists (select 1 from pg_type where typname = 'listing_category') then
    create type listing_category as enum ('CONSULTING', 'WEB_DEV', 'CUSTOM_SOFTWARE');
  end if;

  if not exists (select 1 from pg_type where typname = 'inquiry_type') then
    create type inquiry_type as enum ('DEMO', 'QUOTE', 'INQUIRE');
  end if;

  if not exists (select 1 from pg_type where typname = 'inquiry_status') then
    create type inquiry_status as enum ('NEW', 'IN_PROGRESS', 'CLOSED');
  end if;

  if not exists (select 1 from pg_type where typname = 'receipt_status') then
    create type receipt_status as enum ('PENDING', 'APPROVED', 'REJECTED');
  end if;

  if not exists (select 1 from pg_type where typname = 'donation_status') then
    create type donation_status as enum ('PENDING', 'VERIFIED', 'REJECTED');
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- Table: profiles — one row per authenticated user. id == auth.users.id.
-- A row is created automatically by the handle_new_user trigger below.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key
                      references auth.users (id) on delete cascade,
  email             text,
  role              user_role          not null default 'USER',
  membership_status membership_status  not null default 'NON_MEMBER',
  created_at        timestamptz        not null default now()
);


-- ----------------------------------------------------------------------------
-- Table: listings — public catalog entries. image_url is a site-relative path
-- under /images/ (the file is committed in public/images/).
-- ----------------------------------------------------------------------------
create table if not exists public.listings (
  id            uuid primary key default gen_random_uuid(),
  title         text              not null,
  category      listing_category  not null,
  description   text              not null,
  inquiry_type  inquiry_type      not null,
  image_url     text              not null,
  is_published  boolean           not null default false,
  created_at    timestamptz       not null default now()
);


-- ----------------------------------------------------------------------------
-- Table: inquiries — per-listing submissions. Anonymous allowed (owner_id
-- nullable). Persisted with status NEW.
-- ----------------------------------------------------------------------------
create table if not exists public.inquiries (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid           not null references public.listings (id) on delete cascade,
  owner_id         uuid           references public.profiles (id) on delete set null,
  customer_name    text           not null,
  customer_email   text           not null,
  customer_phone   text,
  project_details  text           not null,
  status           inquiry_status not null default 'NEW',
  handled_by       uuid           references public.profiles (id) on delete set null,
  created_at       timestamptz    not null default now()
);


-- ----------------------------------------------------------------------------
-- Table: membership_receipts — GCash receipts uploaded by authenticated users.
-- file_key is the PRIVATE storage key, never a public URL.
-- ----------------------------------------------------------------------------
create table if not exists public.membership_receipts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid           not null references public.profiles (id) on delete cascade,
  file_key     text           not null,
  status       receipt_status not null default 'PENDING',
  reviewed_by  uuid           references public.profiles (id) on delete set null,
  review_note  text,
  created_at   timestamptz    not null default now()
);


-- ----------------------------------------------------------------------------
-- Table: donations — donor info optional / anonymous allowed. amount must be
-- > 0. file_key is the PRIVATE receipt storage key.
-- ----------------------------------------------------------------------------
create table if not exists public.donations (
  id           uuid primary key default gen_random_uuid(),
  donor_name   text,
  donor_email  text,
  amount       numeric         not null check (amount > 0),
  file_key     text            not null,
  status       donation_status not null default 'PENDING',
  reviewed_by  uuid            references public.profiles (id) on delete set null,
  review_note  text,
  created_at   timestamptz     not null default now()
);


-- ----------------------------------------------------------------------------
-- Trigger: auto-create a profile on new auth user. Inserts a profiles row with
-- role USER and membership_status NON_MEMBER, carrying the new user's email.
-- SECURITY DEFINER so it can write to public.profiles regardless of role.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, membership_status)
  values (new.id, new.email, 'USER', 'NON_MEMBER')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- Indexes — status/publish filters used by dashboards and the catalog, plus
-- indexes on every foreign-key column.
-- ----------------------------------------------------------------------------
create index if not exists idx_inquiries_status           on public.inquiries (status);
create index if not exists idx_membership_receipts_status on public.membership_receipts (status);
create index if not exists idx_donations_status           on public.donations (status);
create index if not exists idx_listings_is_published      on public.listings (is_published);

create index if not exists idx_inquiries_listing_id            on public.inquiries (listing_id);
create index if not exists idx_inquiries_owner_id              on public.inquiries (owner_id);
create index if not exists idx_inquiries_handled_by            on public.inquiries (handled_by);
create index if not exists idx_membership_receipts_user_id     on public.membership_receipts (user_id);
create index if not exists idx_membership_receipts_reviewed_by on public.membership_receipts (reviewed_by);
create index if not exists idx_donations_reviewed_by           on public.donations (reviewed_by);


-- ############################################################################
-- PART 2 — ROW LEVEL SECURITY (from db/rls.sql)
-- The current_user_role() helper + all table policies. This is the
-- AUTHORITATIVE access boundary.
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Role-resolution helper — resolves the caller's role from `profiles` by
-- auth.uid(). Used inside every policy so the role is derived from the verified
-- session, NEVER from client input. SECURITY DEFINER + pinned search_path so it
-- reads `profiles` irrespective of the invoker's RLS (and does not recurse into
-- the profiles policies). Returns NULL for anon / no-profile callers.
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


-- ===== listings ============================================================
-- Read: published to anon/USER; ALL to STAFF/ADMIN. Write (insert/update,
-- incl. publish): ADMIN only.
alter table public.listings enable row level security;

drop policy if exists listings_read on public.listings;
create policy listings_read
  on public.listings
  for select
  using (
    is_published
    or public.current_user_role() in ('STAFF', 'ADMIN')
  );

drop policy if exists listings_insert on public.listings;
create policy listings_insert
  on public.listings
  for insert
  with check (public.current_user_role() = 'ADMIN');

drop policy if exists listings_update on public.listings;
create policy listings_update
  on public.listings
  for update
  using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');


-- ===== inquiries ===========================================================
-- Insert: anon + authenticated. Read: USER sees own; STAFF/ADMIN all.
-- Update (status / handled_by): STAFF/ADMIN only.
alter table public.inquiries enable row level security;

drop policy if exists inquiries_insert on public.inquiries;
create policy inquiries_insert
  on public.inquiries
  for insert
  with check (true);

drop policy if exists inquiries_read on public.inquiries;
create policy inquiries_read
  on public.inquiries
  for select
  using (
    owner_id = auth.uid()
    or public.current_user_role() in ('STAFF', 'ADMIN')
  );

drop policy if exists inquiries_update on public.inquiries;
create policy inquiries_update
  on public.inquiries
  for update
  using (public.current_user_role() in ('STAFF', 'ADMIN'))
  with check (public.current_user_role() in ('STAFF', 'ADMIN'));


-- ===== membership_receipts =================================================
-- Insert: authenticated user inserts its OWN receipt, only as PENDING.
-- Read: USER own; STAFF/ADMIN all. Update (review): STAFF/ADMIN only.
alter table public.membership_receipts enable row level security;

drop policy if exists membership_receipts_insert on public.membership_receipts;
create policy membership_receipts_insert
  on public.membership_receipts
  for insert
  with check (
    user_id = auth.uid()
    and status = 'PENDING'
  );

drop policy if exists membership_receipts_read on public.membership_receipts;
create policy membership_receipts_read
  on public.membership_receipts
  for select
  using (
    user_id = auth.uid()
    or public.current_user_role() in ('STAFF', 'ADMIN')
  );

drop policy if exists membership_receipts_update on public.membership_receipts;
create policy membership_receipts_update
  on public.membership_receipts
  for update
  using (public.current_user_role() in ('STAFF', 'ADMIN'))
  with check (public.current_user_role() in ('STAFF', 'ADMIN'));


-- ===== donations ===========================================================
-- Insert: anon allowed (amount > 0 enforced by the schema CHECK).
-- Read: STAFF/ADMIN only. Update (review): STAFF/ADMIN only.
alter table public.donations enable row level security;

drop policy if exists donations_insert on public.donations;
create policy donations_insert
  on public.donations
  for insert
  with check (true);

drop policy if exists donations_read on public.donations;
create policy donations_read
  on public.donations
  for select
  using (public.current_user_role() in ('STAFF', 'ADMIN'));

drop policy if exists donations_update on public.donations;
create policy donations_update
  on public.donations
  for update
  using (public.current_user_role() in ('STAFF', 'ADMIN'))
  with check (public.current_user_role() in ('STAFF', 'ADMIN'));


-- ===== profiles ============================================================
-- Read: a member reads own; ADMIN reads all. Update: ADMIN only (role
-- assignment via the service-role client). Rows are created by the
-- handle_new_user() trigger, so no INSERT policy is needed for registration.
alter table public.profiles enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read
  on public.profiles
  for select
  using (
    id = auth.uid()
    or public.current_user_role() = 'ADMIN'
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
  on public.profiles
  for update
  using (public.current_user_role() = 'ADMIN')
  with check (public.current_user_role() = 'ADMIN');


-- ############################################################################
-- PART 3 — approve_receipt(): transactional membership approval
-- Sets the receipt to APPROVED and the owning user's membership_status to
-- MEMBER in a SINGLE atomic transaction. The ONLY path that grants MEMBER
-- (Correctness Property 1). STAFF/ADMIN only; 404 if absent; 409 if not
-- PENDING (review is terminal and single).
-- ############################################################################
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


-- ============================================================================
-- DONE. Next steps (separate, manual):
--   * Storage: create a PRIVATE bucket named exactly `receipts` (Public OFF).
--   * Run db/seed.sql to insert sample listings.
--   * Register your accounts, then run db/seed-roles.sql to set Admin/Staff.
-- ============================================================================
