/**
 * admin-users.ts — SERVER-SIDE Admin user management (task 9.5).
 *
 * Lists member profiles and assigns/changes a member's role. Both are guarded
 * by `assertRole(['ADMIN'])` for a friendly 401/403 (Requirement 13.1, 14.1).
 *
 * Two different Supabase clients are used deliberately:
 *   - LISTING members goes through the ROLE-AWARE server client, so RLS (§4.6
 *     profiles_read: ADMIN reads all) governs the read with the Admin's own
 *     session.
 *   - ASSIGNING a role goes through the SERVICE-ROLE client. The design routes
 *     privileged role writes through the service-role client (the few writes
 *     RLS "cannot express as the caller"); this module confines that key to a
 *     single operation, after the `assertRole(['ADMIN'])` gate has passed.
 *     `lib/supabase/service-role.ts` is `server-only`, so the key never reaches
 *     the client bundle (Requirements 13.2, 13.3, 14.4, 14.5).
 *
 * `import 'server-only'` keeps this off the client bundle.
 *
 * Requirements: 13.1 (list members), 13.2/13.3 (assign/change role, Admin
 * only, via service-role client), 14.1 (403 for non-Admin), 14.4 (service-role
 * key server-only).
 */

import "server-only";

import { assertRole, type Role } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

/** The assignable roles (mirrors the `user_role` enum). */
export const ASSIGNABLE_ROLES: readonly Role[] = ["ADMIN", "STAFF", "USER"];

/** A profile row as presented in the Admin user-management list. */
export interface DbProfile {
  id: string;
  email: string | null;
  role: Role;
  membership_status: "MEMBER" | "NON_MEMBER";
  created_at: string;
}

/** Discriminated result for the member list. */
export type ListMembersResult =
  | { ok: true; status: 200; members: DbProfile[] }
  | { ok: false; status: 401 | 403 | 500; error: string };

/**
 * Lists all member profiles, newest first (Requirement 13.1). Read through the
 * role-aware client so RLS (§4.6: ADMIN reads all) authorizes it; the
 * `assertRole(['ADMIN'])` gate gives the friendly 401/403.
 */
export async function listMembers(): Promise<ListMembersResult> {
  const auth = await assertRole(["ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, membership_status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, status: 500, error: "Unable to load members." };
  }

  return { ok: true, status: 200, members: (data ?? []) as DbProfile[] };
}

/** Discriminated result for a role assignment. */
export type AssignRoleResult =
  | { ok: true; status: 200; role: Role }
  | { ok: false; status: 400 | 401 | 403 | 404 | 500; error: string };

/**
 * Assigns/changes a member's role (Requirements 13.2, 13.3). The acting caller
 * must be ADMIN (`assertRole`), after which the write is performed with the
 * SERVICE-ROLE client — the privileged path the design designates for role
 * assignment. The target role must be one of the known roles; an unknown
 * `userId` yields 404.
 */
export async function assignRole(
  userId: string,
  role: string,
): Promise<AssignRoleResult> {
  const auth = await assertRole(["ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }
  if (!userId) {
    return { ok: false, status: 400, error: "Missing user id." };
  }
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
    return { ok: false, status: 400, error: "Invalid role." };
  }

  // Privileged write: confined to the service-role client AFTER the Admin gate.
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: role as Role })
    .eq("id", userId)
    .select("id");

  if (error) {
    return { ok: false, status: 500, error: "Could not assign the role." };
  }
  if (!data || data.length === 0) {
    return { ok: false, status: 404, error: "Member not found." };
  }

  return { ok: true, status: 200, role: role as Role };
}
