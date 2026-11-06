# Task 5 — Implement server-side auth and role helpers

Status: completed
Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 14.1, 14.2

## What was built
The application-layer auth surface that sits on top of the Task 4 RLS boundary:
server-side role resolution, the reusable `assertRole` 401/403 guard, and the
register / login / logout flows via Supabase Auth. This is the first app code in
the build (Tasks 3–4 were SQL only); it reuses the Task 2.2 client factories.

Two new artifacts:
- `lib/auth.ts` — role resolution + `assertRole`.
- `app/auth/actions.ts` — register / login / logout Server Actions.

### lib/auth.ts
- `getRoleFromSession()` — verifies the JWT and resolves the caller's role:
  - Uses the ROLE-AWARE server client (`createServerSupabaseClient`, Task 2.2),
    NOT the service-role client, so RLS still applies.
  - Verifies the token via `supabase.auth.getUser()` (validated against the
    Supabase Auth server, so signature/expiry are checked). An invalid,
    expired, or absent session returns `{ authenticated: false }` — treated as
    unauthenticated (Requirements 6.4, 14.2).
  - Reads `profiles.role` keyed by the verified `user.id` — the same
    server-resolved source RLS uses — never from client input (Requirements
    6.1, 6.3). A verified user with no readable profile row is treated as
    having no usable role (defensive: no role → no privileged capability).
  - Returns a discriminated `RoleResolution`; `Role` is the `ADMIN`/`STAFF`/
    `USER` union mirroring the `user_role` enum (Requirement 6.2).
- `assertRole(allowedRoles)` — the reusable UX guard mirroring the design's
  `assertRole` pseudocode:
  - invalid/expired/absent session → `{ ok: false, status: 401 }` (14.2),
  - valid session, role not in `allowedRoles` → `{ ok: false, status: 403 }`
    (14.1),
  - valid session, role allowed → `{ ok: true, userId, role }`.
  - Returns a discriminated result instead of throwing, so each caller maps it
    to the right response. Exported for reuse by every privileged route
    handler / server action and dashboard guard (Tasks 7–9).
- `import 'server-only'` so the module cannot be pulled into a Client Component.

### app/auth/actions.ts (Server Actions)
- `register(email, password)` — `supabase.auth.signUp`. Passes ONLY email +
  password; the `profiles` row and its forced `USER` / `NON_MEMBER` defaults are
  created by the `handle_new_user` trigger in db/schema.sql (Task 3 — not
  re-implemented here), so no client-supplied role/membership value is honored
  (Requirements 5.1, 5.5, 6.3). Supabase Auth hashes/stores the password
  (5.4); a malformed/already-registered email surfaces as an error (5.6).
- `login(email, password)` — `supabase.auth.signInWithPassword`; establishes a
  session + JWT in the session cookie (5.2).
- `logout()` — `supabase.auth.signOut`; terminates the session and clears the
  cookie (5.3).
- All three use the role-aware server client (cookie-wired), never the
  service-role client, so auth acts as the caller and the SSR cookie layer
  manages the session. Errors return a generic `AuthResult` message with no
  stack traces or internal diagnostics (Requirement 14.6).

## Scope boundaries (deliberate)
- RLS stays authoritative; these helpers provide 401/403 and UX only. No access
  logic that belongs in the database was reintroduced (design + task note).
- The `handle_new_user` trigger already exists in db/schema.sql; it was reused,
  not re-implemented. Default role/membership is enforced server-side by that
  trigger.
- No UI wiring yet — `app/login/page.tsx` remains the Task-1 placeholder; wiring
  forms to these actions and consuming `assertRole` in route handlers/dashboards
  is Tasks 7–9. This task delivers the server helpers and flows only.

## Design details honored
- Role resolved server-side from the verified session (`auth.uid()` →
  `profiles.role`), never from client input (6.1, 6.3; Correctness Property 7).
- 401 vs 403 split matches the Error Handling matrix: invalid/absent session →
  401, valid session with insufficient role → 403 (14.1, 14.2).
- Uses the role-aware server client so RLS applies; service-role client avoided.

## Files
- lib/auth.ts (new) — `getRoleFromSession`, `assertRole`, `Role` /
  `RoleResolution` / `AssertRoleResult` types.
- app/auth/actions.ts (new) — `register`, `login`, `logout` Server Actions and
  the `AuthResult` type.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 5 done.

## Verification
Type-check and production build both run clean in this environment:
- `npx tsc --noEmit` — exit 0 (no type errors).
- `npm run build` (`next build`) — compiled successfully, lint + type validity
  passed, all 6 routes generated.

Static review confirmed the helpers against the cited requirements: the 401/403
split, the role union (`ADMIN`/`STAFF`/`USER`), reliance on the role-aware
client (not service-role), and registration passing only email/password so the
database trigger owns the role/membership defaults.

There is no live Supabase instance in this environment, so the runtime auth
flows (register/login/logout, JWT verification, `profiles.role` read) could not
be exercised end-to-end. Live-session verification is deferred to student
provisioning (Task 13.1, Session 2), consistent with Tasks 3–4.
