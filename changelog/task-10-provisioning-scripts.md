# Task 10 — Ship the provisioning scripts and setup guide

Status: completed
Requirements: 2.1, 2.3, 6.2, 11.5, 13.1, 14.3, 14.4

## What was built

The student-facing provisioning scripts each student applies to their OWN
Supabase project (there is no shared backend). These bundle the instructor-built
schema + RLS into paste-and-run SQL and keep their names in sync with the
existing workshop guides in `docs/workshop/`.

### db/setup.sql (new) — one-shot provisioning

- Bundles, in order: schema (extensions, enum types, the five tables, the
  `handle_new_user` profile trigger, indexes) + RLS (`current_user_role()`
  helper and all table policies) + the transactional `approve_receipt()`
  function. It is the student-facing superset of `db/schema.sql` (Task 3) and
  `db/rls.sql` (Task 4), which remain the authoritative per-task sources.
- **Idempotent / re-runnable**: `create ... if not exists`, guarded `do` blocks
  for enum types, `create or replace function`, `drop ... if exists` before each
  trigger/policy, and `enable row level security` (a no-op if already on) — so a
  student can safely re-run it after a partial paste (the facilitator guide
  calls this out as the top time-sink).
- Deliberately does NOT create the Storage bucket, seed listings, or assign
  roles — those are separate steps, documented in the trailer and the guides.
  _Satisfies 6.2 (profile trigger / roles default), 2.1/2.3 (listing read RLS),
  13.1 (profiles RLS), 11.5 (image path shape in the listings table)._

### db/seed.sql (new) — sample listings

- Inserts the three PUBLISHED listings that mirror `content/listings.ts`
  (IT Strategy Consulting / INQUIRE, Business Website Build / QUOTE, Custom
  Inventory Management App / DEMO), each referencing an image already committed
  under `public/images/` (the three placeholder SVGs), plus ONE UNPUBLISHED
  draft (Cloud Migration Assessment). The draft is hidden from the public
  catalog by RLS but visible to Staff/Admin — data for the Session 3 publish
  demo and for seeing RLS decide visibility by role.
- **Idempotent**: every insert is guarded by `where not exists (… title = …)`,
  so re-running does not duplicate rows.
  _Satisfies 2.1/2.3 (published vs. draft under RLS), 11.5 (site-relative
  `/images/` image_url, no object storage for catalog images)._

### db/seed-roles.sql (new) — assign your own Admin/Staff

- Promotes ALREADY-REGISTERED accounts to ADMIN / STAFF by email (the third
  account stays USER, the trigger default). Documents the required order
  (register on the live site first, then run), since registration is what
  creates the `auth.users` + `profiles` rows the script updates.
- Explains WHY a direct `UPDATE` is the right provisioning path here: in the
  running app role changes go through the server-only service-role client (the
  only client RLS lets write `profiles.role`), and the Supabase SQL Editor runs
  as a privileged DB role that likewise bypasses RLS — the one-time equivalent.
  The app itself only ever changes roles through the guarded Admin dashboard
  (Task 9.5).
- Idempotent (re-setting the same roles) with a verification `SELECT` at the end.
  _Satisfies 13.1 (role assignment), 6.2 (roles model)._

### Consistency checks (no code change needed)

- **Private bucket name `receipts`** is consistent across code and docs:
  `RECEIPTS_BUCKET = "receipts"` and the `receipts/` key prefix in
  `lib/storage/receipts.ts`, the "create a bucket named exactly `receipts`
  (Public OFF)" step in the Session 2 guide, and the setup.sql trailer.
- **`.env.example`** already documents the three env vars with exposure scope
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` public;
  `SUPABASE_SERVICE_ROLE_KEY` server-only). No change required for 14.3/14.4.
- **Script names match the guides**: `db/setup.sql`, `db/seed.sql`, and
  `db/seed-roles.sql` are exactly the names referenced in
  `Session-2-Setup-Reference.md`, `Session-3-Setup-Reference.md`, and
  `Facilitator-Timing-Guide.md`.

## Files

- db/setup.sql (new) — schema + RLS + approve_receipt(), idempotent one-shot.
- db/seed.sql (new) — published + one unpublished sample listing, idempotent.
- db/seed-roles.sql (new) — promote registered accounts to Admin/Staff.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 10 done.

## Verification

- **Static review** against db/schema.sql + db/rls.sql: setup.sql reproduces the
  authoritative schema and policies verbatim (same enum spellings, same policy
  predicates, same `approve_receipt()` body with its SQLSTATE→HTTP mapping) and
  adds only re-run guards. seed.sql uses valid enum values
  (CONSULTING/WEB_DEV/CUSTOM_SOFTWARE, INQUIRE/QUOTE/DEMO) and `/images/` paths
  that match the three committed SVGs in `public/images/`.
- **Name/consistency grep**: confirmed the `receipts` bucket name in code and
  docs and the three script names across the workshop guides.

There is no live Supabase in this environment, so the SQL was not executed
against a database; correctness was verified by static review against the
authoritative Task 3/4 sources and the schema. Live execution is the student
step in Session 2/3 (Task 13.1 / Task 14.1), and setup.sql is idempotent so a
re-run recovers from a partial paste.
