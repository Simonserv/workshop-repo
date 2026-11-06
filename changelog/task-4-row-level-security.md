# Task 4 — Define Row Level Security policies (the authoritative access boundary)

Status: completed
Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 6.1, 6.3, 7.1, 7.2,
7.3, 7.4, 7.5, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.4, 11.1, 11.2, 11.3, 12.1, 12.2,
13.1, 13.2, 13.3

## What was built
The authoritative RLS layer (for Supabase) that students apply on top of the
Task 3 schema. SQL authoring only — no app code. A single new artifact,
`db/rls.sql`, layered on `db/schema.sql`, covering the role-resolution helper,
RLS + policies for all five tables, and the transactional approval function.
It is written to be idempotent so a student can safely re-run it against their
own Supabase project.

Subtasks delivered:
- 4.1 — `public.current_user_role()`: resolves the caller's role from
  `profiles` by `auth.uid()`. `SECURITY DEFINER` with a pinned `search_path`
  so it reads `profiles` irrespective of the invoker's RLS (which also avoids
  recursion with the profiles policies). Returns NULL for anonymous callers or
  callers without a profile, so policies treat "no role" as not STAFF/ADMIN.
  The role is therefore always server-resolved, never client-supplied.
- 4.2 — `listings`: RLS enabled. Read = published rows to anon/USER, all rows
  (incl. drafts) to STAFF/ADMIN. Insert and update (edit + publish/unpublish
  via `is_published`) restricted to ADMIN.
- 4.3 — `inquiries`: RLS enabled. Insert allowed for anon + authenticated
  (`with check (true)`). Read = owner (`owner_id = auth.uid()`) or STAFF/ADMIN.
  Update (status / handled_by triage) = STAFF/ADMIN only.
- 4.4 — `membership_receipts`: RLS enabled. Insert = authenticated user's own
  row and only as `PENDING`. Read = own or STAFF/ADMIN. Update (review) =
  STAFF/ADMIN only.
- 4.5 — `donations`: RLS enabled. Insert = anon allowed (`amount > 0` is left
  to the schema `CHECK`, not re-checked). Read = STAFF/ADMIN only. Update
  (verify/reject review) = STAFF/ADMIN only.
- 4.6 — `profiles`: RLS enabled. Read = own profile or ADMIN (all). Update
  (role assignment) = ADMIN only. No INSERT policy — rows are created by the
  Task 3 `handle_new_user()` `SECURITY DEFINER` trigger; the service-role
  client used for admin writes bypasses RLS.
- 4.7 — `public.approve_receipt(p_receipt_id uuid)`: a `SECURITY DEFINER`
  plpgsql function that mirrors the design's `approveReceipt` algorithm —
  STAFF/ADMIN guard (else 42501 → 403), 404 if the receipt is missing, 409 if
  it is not `PENDING` (review is terminal and single), then atomically sets
  receipt → `APPROVED` (recording `reviewed_by`) and the owning user →
  `MEMBER`. A `SELECT ... FOR UPDATE` row lock closes the concurrent
  double-approve race. The plpgsql body is a single transaction, so both
  writes commit together or not at all. This is the ONLY path that grants
  MEMBER (Correctness Property 1).

## Scope boundaries (deliberate)
- No application code — RLS is the authoritative boundary; application-layer
  `assertRole` (401/403, UX) is out of scope for this task (Task 5).
- No schema changes — `db/schema.sql` remains the source of truth for tables,
  enum types, the new-user trigger, and indexes; this file only adds RLS and
  the approval function it explicitly deferred to Task 4.
- No seed data — that is Task 10 (`db/seed.sql`).
- Separate artifact — Task 10 (NOT this task) later bundles schema + RLS +
  approval function into `db/setup.sql`; `db/rls.sql` is the standalone RLS
  output here, consistent with how `db/schema.sql` is organized.
- No explicit table GRANTs — Supabase grants `anon`/`authenticated` the base
  table privileges by default; RLS policies govern row access on top of those
  grants (schema.sql adds none either).

## Design details honored
- RLS is the authoritative access boundary (design: "Row Level Security (the
  authoritative boundary)").
- The role is resolved server-side from `profiles` via `auth.uid()`, never from
  client input (Requirements 6.1, 6.3, 7.1; Correctness Property 7).
- Enum values are uppercase exactly as in schema.sql (ADMIN/STAFF/USER,
  MEMBER/NON_MEMBER, PENDING/APPROVED/REJECTED).
- `approve_receipt()` matches the approveReceipt pseudocode including the
  non-PENDING 409 guard and the atomic receipt→APPROVED + user→MEMBER writes.
- Idempotent for safe re-runs: `create or replace function`,
  `alter table ... enable row level security` (no-op if already on), and
  `drop policy if exists` before each `create policy`.

## Files
- db/rls.sql (new) — the authoritative RLS layer: `current_user_role()` helper,
  RLS + policies for `listings`, `inquiries`, `membership_receipts`,
  `donations`, `profiles`, and the `approve_receipt()` approval function.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 4 and 4.1–4.7 done.

## Verification
Static review only. There is no live database in this environment and no
`psql` client installed (confirmed in Task 3), so the SQL was NOT executed and
no database was provisioned. Verification was a careful per-policy static
review of `db/rls.sql` against the schema in `db/schema.sql` and each cited
requirement:

- Every table (`profiles`, `listings`, `inquiries`, `membership_receipts`,
  `donations`) has `enable row level security` plus policies for each
  role/action.
- listings: published-to-all / all-to-STAFF/ADMIN read and ADMIN-only write
  match 2.1–2.3, 2.5, 3.1–3.3, 7.1, 11.1–11.3.
- inquiries: anon+authed insert, owner/STAFF/ADMIN read, STAFF/ADMIN update
  match 4.1, 4.2, 7.2–7.5, 12.1, 12.2.
- membership_receipts: own-PENDING insert, own/STAFF/ADMIN read, STAFF/ADMIN
  update match 7.2–7.4, 8.2, 8.5.
- donations: anon insert (amount>0 via CHECK), STAFF/ADMIN read/update match
  9.1, 9.2, 9.4, 7.3, 7.4.
- profiles: own/ADMIN read, ADMIN-only update match 7.1, 13.1–13.3.
- approve_receipt(): STAFF/ADMIN guard, 404/409 guards, and the atomic
  receipt→APPROVED + user→MEMBER updates match 8.3, 8.4 and Correctness
  Property 1. The role helper's SECURITY DEFINER avoids recursive policy
  evaluation on `profiles`.

Runtime verification against a real Supabase/Postgres instance is deferred to
when a student provisions their own Supabase project and runs the provisioning
SQL (Task 13.1, Session 2).
