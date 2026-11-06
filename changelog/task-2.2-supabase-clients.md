# Task 2.2 — Implement browser, server, and service-role Supabase clients

Status: completed
Requirements: 6.1, 6.4, 14.4, 14.5
Parent: Task 2 (Configure environment variables and Supabase client factories)

## What was built
The three Supabase client factories the rest of the app builds on, using the
official `@supabase/ssr` approach for the Next.js App Router. Each factory
reuses the typed env contract from task 2.1 (`requirePublicEnv()` /
`requireServiceRoleKey()`) so missing keys fail fast with a clear message
instead of a cryptic Supabase error.

- Browser client — public anon key + URL, for Client Components. Subject to
  RLS; does not bypass it.
- Role-aware server client — reads the Supabase session JWT from request
  cookies via `next/headers` `cookies()` and wires `getAll`/`setAll`, so
  Postgres RLS applies with the caller's own role (resolved via
  `auth.uid()` → `profiles.role`). The normal path for Server Components and
  Route Handlers; uses the anon key, not the service-role key.
- Service-role client — uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS, and is
  confined to server-only modules for the few privileged admin writes (role
  assignment, task 9.5). Session persistence/auto-refresh disabled.

Both the server and service-role modules begin with `import 'server-only'`, so
importing either from a Client Component fails at build time — this enforces
that the service-role key can never reach the browser bundle (Req 14.4/14.5).
The service-role key is read through a function (not a `NEXT_PUBLIC_` constant),
so it is never inlined into client output.

Scope held to the three factories only: no auth helpers (`getRoleFromSession` /
`assertRole`, task 5) and no storage client (task 6).

## Files
- lib/supabase/browser.ts (new) — `createBrowserSupabaseClient()` via
  `@supabase/ssr` `createBrowserClient`.
- lib/supabase/server.ts (new) — `createServerSupabaseClient()` via
  `createServerClient`, cookie store wired for `getAll`/`setAll`; `server-only`.
- lib/supabase/service-role.ts (new) — `createServiceRoleSupabaseClient()` via
  `@supabase/supabase-js` `createClient`; `server-only`.
- package.json — added pinned (exact, no caret) dependencies:
  `@supabase/supabase-js` 2.119.0, `@supabase/ssr` 0.12.7, `server-only` 0.0.1.

## Installed package versions
- @supabase/supabase-js: 2.119.0
- @supabase/ssr: 0.12.7
- server-only: 0.0.1

## Verification
`npm run build` succeeded: compiled, type-checked, and linted cleanly; all 6
routes built. No diagnostics in the three new modules. The `getAll`/`setAll`
cookie API (current `@supabase/ssr` v0.12 recommended pattern) was used rather
than the deprecated `get`/`set`/`remove` triplet.
