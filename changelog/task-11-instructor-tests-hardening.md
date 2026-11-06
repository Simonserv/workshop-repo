# Task 11 — Instructor test + hardening pass (optional, off student critical path)

Status: completed
Requirements: all Correctness Properties; 14.1–14.7

> These tests are instructor-maintained and OPTIONAL. Students never see or run
> them; nothing in `docs/workshop/` was added or changed. Everything runs in CI
> with NO Supabase instance and NO network.

## Test framework

- **Vitest 3** (`vitest run` via the new `npm test` script) + **fast-check 3**
  for property-based tests. Both added as devDependencies.
- `vitest.config.ts` wires two things so the server-only app modules import
  cleanly under plain Node:
  - `@/…` → repo root (matching `tsconfig` `paths`).
  - `server-only` → a local no-op stub (`tests/stubs/server-only.ts`). This does
    NOT weaken the guarantee: `next build` still fails if a `server-only` module
    is pulled into a Client Component.
- `tests/helpers/supabase-mock.ts` — a small controllable fake Supabase client
  (auth/getUser, the `.from().select/insert/update` chain, `.rpc`, and storage)
  so the REAL domain modules run against scripted responses, no live DB.
- `tests/helpers/sql.ts` — reads + lightly parses `db/rls.sql` / `db/setup.sql`
  so RLS checks are SQL-policy-level assertions, never a DB connection.

## What was tested

### `tests/properties.test.ts` — the seven Correctness Properties

From design.md "Correctness Properties" (one block each):

1. **Membership only by approval** — `approveReceipt` is the sole granting path
   and calls the atomic `approve_receipt()` RPC; no app module writes
   `membership_status` (only the SQL function does). _(8.3, 8.4)_
2. **Privileged access always authorized** — missing session → 401, wrong role
   → 403 for a privileged action; RLS predicates confirm privileged tables are
   Staff/Admin-only. _(6, 7, 12.5, 14.1, 14.2)_
3. **Receipts never publicly reachable** — `getReceiptViewUrl` mints a
   short-lived (~300 s) signed URL; the storage client never uses
   `getPublicUrl`. _(10)_
4. **Inquiry integrity** — the inquiry route persists ONLY when the listing is
   published; unpublished/missing → 400 with no insert. _(4.3)_
5. **Review terminal + single** — verify/reject on a non-PENDING donation → 409;
   `approve_receipt()` raises the 409-mapped error on non-PENDING. _(8.6, 9.9)_
6. **Donation amount validity** — any amount ≤ 0 / non-numeric → 400 with no
   upload/insert; schema CHECK `amount > 0` asserted. _(9.2)_
7. **RBAC trusts the DB** — `getRoleFromSession` reads `profiles.role` by the
   verified user id; every role-gated RLS policy uses `current_user_role()`.
   _(6.1, 7)_

### `tests/auth-and-errors.test.ts` — 401/403, validation, 409 paths

- `assertRole` and the domain functions: absent/expired session → **401**,
  insufficient role → **403**, authorized → ok.
- Input validation: inquiry field-level 400s (name/email/details, malformed
  body, missing listingId), donation amount/file 400s, non-`/images/` image_url,
  invalid role, invalid inquiry status, empty rejection reason.
- Review **409 on non-PENDING** for receipts and donations, plus the
  `approve_receipt()` SQLSTATE → HTTP mapping (23505→409, P0002→404, 42501→403).

### `tests/secrets-and-rls.test.ts` — secret exposure + RLS denial

- **Criterion 3 (secrets):** a static scan of all source files proves ONLY
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` use the
  `NEXT_PUBLIC_` prefix, and `SUPABASE_SERVICE_ROLE_KEY` is never prefixed
  public; the key is read through a function in a `server-only` module. An
  OPTIONAL `.next` client-bundle scan runs when a build is present and asserts
  no client chunk contains the service-role key name.
- **Criterion 4 (RLS denies forbidden rows), SQL-policy-level ONLY:** parses the
  policies to assert RLS is enabled on every table; listing/profile writes are
  ADMIN-only (STAFF denied); donations are Staff/Admin read-only (no owner
  path); inquiry/receipt reads are own-or-Staff/Admin; receipt inserts are
  own-row + PENDING; `approve_receipt()` re-checks Staff/Admin at the DB layer
  (so a bypassed app check is still denied); and `db/setup.sql` carries the
  identical policy set.

## Verification (what was run, and the results)

- **Install:** `npm install -D vitest@^3 fast-check@^3` → vitest 3.2.7,
  fast-check 3.23.2 (esbuild postinstall approved).
- **Tests:** `npm test` (`vitest run`) → **3 files, 52 tests, all passing.**
- **Build:** `npm run build` → **compiled successfully, type-check + lint clean,
  19/19 pages generated.**
- **Secret-exposure check (demonstrated):** scanned `.next/static/**/*.js` after
  the build → **0** occurrences of `SUPABASE_SERVICE_ROLE_KEY` and **0** of the
  literal `service_role`; `NEXT_PUBLIC_*` references are statically inlined by
  Next.js at build time (the source scan is the authoritative proof that only
  the anon key + URL are public).

No Supabase instance was used: domain logic runs against the mocked client and
the RLS checks are text-level assertions over `db/rls.sql` / `db/setup.sql`.

## Files

- package.json — add `test` script; vitest + fast-check devDependencies.
- vitest.config.ts (new), tests/stubs/server-only.ts (new).
- tests/helpers/supabase-mock.ts (new), tests/helpers/sql.ts (new).
- tests/properties.test.ts (new) — seven Correctness Properties.
- tests/auth-and-errors.test.ts (new) — 401/403, validation, 409 paths.
- tests/secrets-and-rls.test.ts (new) — secret exposure + RLS-policy assertions.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 11 done.
