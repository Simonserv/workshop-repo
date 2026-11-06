# Task 3 — Create the database schema (profiles, listings, inquiries, membership_receipts, donations)

Status: completed
Requirements: 4.3, 5.1, 5.5, 6.2, 8.2, 9.2, 11.5

## What was built
The authoritative PostgreSQL schema (for Supabase) that students run against
their own Supabase project. SQL authoring only — no app code. Covers the five
tables from the design's Data Models, the enum types they use, the standard
Supabase new-user profile trigger, and the performance indexes.

Scope boundaries (deliberate):
- No RLS — `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` are Task 4.
- No seed data — that is Task 10 (`db/seed.sql`).
- No `approve_receipt()` function — that is Task 4.7.
- Task 10 will later bundle schema + RLS + approval function into `db/setup.sql`.

Design details honored:
- UUID primary keys with `gen_random_uuid()` (pgcrypto enabled).
- `profiles.id` equals `auth.users.id` via FK with `on delete cascade`.
- `timestamptz created_at default now()` on every table.
- Postgres ENUM types with values spelled EXACTLY as the design requires
  (uppercase): `user_role`, `membership_status`, `listing_category`,
  `inquiry_type`, `inquiry_status`, `receipt_status`, `donation_status`.
- `donations.amount numeric CHECK (amount > 0)`.
- `handle_new_user()` is `SECURITY DEFINER`, inserts into `public.profiles`
  (role `USER`, `membership_status` `NON_MEMBER`, email from the new auth user),
  wired as an `AFTER INSERT` trigger on `auth.users`.
- Idempotent for safe re-runs: `create extension if not exists`, guarded `DO`
  block for enum types, `create table if not exists`, `create or replace
  function`, `drop trigger if exists` before `create trigger`, and
  `create index if not exists`.

Indexes: status filters (`inquiries.status`, `membership_receipts.status`,
`donations.status`), `listings.is_published`, plus every FK column
(`inquiries.listing_id`, `inquiries.owner_id`, `inquiries.handled_by`,
`membership_receipts.user_id`, `membership_receipts.reviewed_by`,
`donations.reviewed_by`).

## Files
- db/schema.sql (new; created the db/ folder) — the authoritative schema.

## Verification
Static review only. There is no live database in this environment, and no
`psql` client is installed (confirmed via `Get-Command psql`), so the SQL was
not executed. No database was installed. The file was re-read and checked
field-by-field against the design.md Data Models: table columns, nullability,
enum value spelling, defaults, FK targets/cascade behavior, the `amount > 0`
check, the trigger/function, and the required index set all match.

Runtime verification against a real Supabase/Postgres instance is deferred to
when a student runs the provisioning SQL (Task 13.1, Session 2).
