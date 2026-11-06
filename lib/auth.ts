/**
 * auth.ts — SERVER-SIDE auth & role helpers (application-layer 401/403 + UX).
 *
 * This module turns a request's Supabase session into a trusted role and
 * provides the `assertRole` guard that route handlers and server actions reuse.
 *
 * IMPORTANT — the boundary this does (and does NOT) enforce:
 *   - Row Level Security is the AUTHORITATIVE access boundary. The database
 *     decides which rows each role may read/write, using a role resolved from
 *     the verified session (`auth.uid()` → `profiles.role`) inside its policies.
 *   - The helpers here exist ONLY to produce friendly 401/403 responses and to
 *     drive UX (hiding controls). They never re-implement the access logic that
 *     belongs in the database. Even if an `assertRole` call were bypassed, RLS
 *     still forbids the underlying row access.
 *
 * How the role is trusted (never client-supplied):
 *   - We use the ROLE-AWARE server client (`createServerSupabaseClient`), which
 *     reads the Supabase session JWT from cookies. `supabase.auth.getUser()`
 *     verifies that JWT against the Supabase Auth server, so an invalid or
 *     expired token yields no user. An invalid/expired/absent session is
 *     therefore treated as UNAUTHENTICATED.
 *   - The role itself is read from `profiles` keyed by the authenticated user's
 *     id — the same server-resolved source RLS uses — never from any value the
 *     client sends.
 *
 * `import 'server-only'` guarantees a build-time error if this module is ever
 * pulled into a Client Component, keeping session/role resolution on the server.
 *
 * Requirements: 5.1, 6.1, 6.2, 6.3, 6.4, 14.1, 14.2
 * (Design: Component 5 — Auth & Role Resolution; `assertRole` algorithm.)
 */

import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The three authorization roles, exactly as persisted in `profiles.role`
 * (Requirement 6.2). Mirrors the `user_role` enum in db/schema.sql.
 */
export type Role = "ADMIN" | "STAFF" | "USER";

/**
 * Result of resolving a role from the current request's session.
 *
 * `authenticated: false` means the session was absent, invalid, or expired —
 * i.e. the caller is unauthenticated and any guarded action should answer 401.
 * `authenticated: true` carries the verified user's id and their trusted role.
 */
export type RoleResolution =
  | { authenticated: false }
  | { authenticated: true; userId: string; role: Role };

/**
 * Resolves the caller's role from the verified Supabase session.
 *
 * Steps (mirrors the design's `getRoleFromSession`):
 *   1. Verify the JWT. `getUser()` validates the token with the Supabase Auth
 *      server, so an invalid/expired/absent session returns no user and is
 *      treated as unauthenticated.
 *   2. Read `profiles.role` for the verified user id (server-resolved, never
 *      client-supplied). This read is itself governed by RLS (a member may read
 *      their own profile), so it reflects the authoritative data.
 *
 * Returns `{ authenticated: false }` for any unauthenticated case, including a
 * verified user with no readable profile row (defensive: treated as having no
 * usable role rather than silently granting one).
 */
export async function getRoleFromSession(): Promise<RoleResolution> {
  const supabase = createServerSupabaseClient();

  // Verify the JWT (signature + expiry) via the Auth server. Invalid/expired
  // sessions surface here as `error` / no user and are treated as unauthenticated.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { authenticated: false };
  }

  // Role is read from the persisted profile keyed by the verified user id,
  // the same source RLS uses — never from client input (Requirements 6.1, 6.3).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // Verified session but no readable role: treat as unauthenticated for the
    // purpose of granting access (no role → no privileged capability).
    return { authenticated: false };
  }

  return {
    authenticated: true,
    userId: user.id,
    role: profile.role as Role,
  };
}

/**
 * The outcome of an `assertRole` check.
 *
 * - `ok: true` carries the authorized context (verified user id + trusted role)
 *   for the handler to use.
 * - `ok: false` carries the HTTP status the handler should return: `401` for an
 *   invalid/absent session (Requirement 14.2), `403` for a valid session whose
 *   role is insufficient (Requirement 14.1).
 */
export type AssertRoleResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; status: 401 | 403 };

/**
 * Asserts that the current request's session holds one of `allowedRoles`.
 *
 * Returns a discriminated result rather than throwing, so callers (route
 * handlers / server actions) can translate it into the appropriate response:
 *   - invalid/expired/absent session → `{ ok: false, status: 401 }`
 *   - valid session, role not allowed → `{ ok: false, status: 403 }`
 *   - valid session, role allowed     → `{ ok: true, userId, role }`
 *
 * This is the application-layer UX guard only; RLS remains the authoritative
 * boundary (see the module header). Exported for reuse by every privileged
 * route handler / server action and dashboard guard.
 */
export async function assertRole(
  allowedRoles: readonly Role[],
): Promise<AssertRoleResult> {
  const resolution = await getRoleFromSession();

  if (!resolution.authenticated) {
    return { ok: false, status: 401 };
  }

  if (!allowedRoles.includes(resolution.role)) {
    return { ok: false, status: 403 };
  }

  return { ok: true, userId: resolution.userId, role: resolution.role };
}
