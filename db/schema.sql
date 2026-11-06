-- ============================================================================
-- Database schema: Three-Tier Catalog & Membership Website (Workshop Build)
-- Spec: pos-catalog-site-core  |  Task 3 — Create the database schema
-- Target: Supabase (PostgreSQL)
-- ----------------------------------------------------------------------------
-- This file is the AUTHORITATIVE schema. It defines tables, enum types, the
-- new-user profile trigger, and indexes ONLY.
--
--   * Row Level Security (ENABLE ROW LEVEL SECURITY / CREATE POLICY) is NOT
--     defined here — that is Task 4. RLS is the authoritative access boundary
--     and is layered on top of this schema.
--   * Seed data is NOT here — that is Task 10 (db/seed.sql).
--   * Task 10 later bundles schema + RLS + the approval function into
--     db/setup.sql.
--
-- Written to be idempotent where reasonable (IF NOT EXISTS for extensions and
-- tables, guarded DO blocks for enum types, CREATE OR REPLACE FUNCTION, and
-- DROP TRIGGER IF EXISTS before CREATE TRIGGER) so a student can safely re-run
-- it against their own Supabase project.
--
-- Requirements covered: 4.3, 5.1, 5.5, 6.2, 8.2, 9.2, 11.5
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Extensions
-- gen_random_uuid() is provided by pgcrypto (available on Supabase).
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- Enum types (guarded so re-running does not error)
-- Values are spelled EXACTLY as the design's data models require (uppercase).
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
-- Table: profiles
-- One row per authenticated user. id == auth.users.id (FK, cascade on delete).
-- A row is created automatically by the handle_new_user trigger below.
-- Requirements: 5.1, 5.5, 6.2
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
-- Table: listings
-- Public catalog entries. image_url is a site-relative path under /images/.
-- Requirements: 11.5
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
-- Table: inquiries
-- Per-listing inquiry submissions. Anonymous submissions allowed
-- (owner_id is nullable). Persisted with status NEW.
-- Requirements: 4.3
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
-- Table: membership_receipts
-- GCash receipts uploaded by authenticated users for membership approval.
-- file_key is the PRIVATE storage key, never a public URL.
-- Requirements: 8.2
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
-- Table: donations
-- Donation submissions (donor info optional / anonymous allowed).
-- amount must be > 0. file_key is the PRIVATE receipt storage key.
-- Requirements: 9.2
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
-- Trigger: auto-create a profile on new auth user
-- Standard Supabase handle_new_user AFTER INSERT trigger on auth.users.
-- Inserts a profiles row with role USER and membership_status NON_MEMBER,
-- carrying the new user's email. SECURITY DEFINER so it can write to
-- public.profiles regardless of the inserting role.
-- Requirements: 5.5, 6.2
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
-- Indexes
-- Status / publish filters used by dashboards and the catalog, plus indexes
-- on every foreign-key column.
-- ----------------------------------------------------------------------------

-- Frequent filter columns
create index if not exists idx_inquiries_status           on public.inquiries (status);
create index if not exists idx_membership_receipts_status on public.membership_receipts (status);
create index if not exists idx_donations_status           on public.donations (status);
create index if not exists idx_listings_is_published      on public.listings (is_published);

-- Foreign-key columns
create index if not exists idx_inquiries_listing_id            on public.inquiries (listing_id);
create index if not exists idx_inquiries_owner_id              on public.inquiries (owner_id);
create index if not exists idx_inquiries_handled_by            on public.inquiries (handled_by);
create index if not exists idx_membership_receipts_user_id     on public.membership_receipts (user_id);
create index if not exists idx_membership_receipts_reviewed_by on public.membership_receipts (reviewed_by);
create index if not exists idx_donations_reviewed_by           on public.donations (reviewed_by);


-- ============================================================================
-- NOTE: Row Level Security is intentionally NOT defined in this file.
-- Task 4 enables RLS and defines all policies (the authoritative access
-- boundary). Task 4.7 adds the transactional approve_receipt() function.
-- ============================================================================
