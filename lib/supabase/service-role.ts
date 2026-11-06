/**
 * service-role.ts — SERVICE-ROLE Supabase client (privileged, server-only).
 *
 * ⚠️ This client authenticates with the `service_role` key and therefore
 * **BYPASSES Row Level Security entirely**. It is the master key to the
 * database. Use it only for the few privileged admin writes that RLS cannot
 * express as the caller — specifically role assignment (see task 9.5).
 *
 * Because it bypasses RLS, it must NEVER be importable from client code and the
 * key must NEVER reach the browser bundle:
 *   - `import 'server-only'` makes any Client-Component import fail at build time.
 *   - The key is read through `requireServiceRoleKey()` (a function, not a
 *     `NEXT_PUBLIC_` constant), so it is never inlined into client output.
 *
 * Requirements: 6.4 (privileged server-side writes), 14.4 (service-role key is
 * server-only, never public), 14.5 (privileged access confined to the server).
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requirePublicEnv, requireServiceRoleKey } from "@/lib/env";

/**
 * Creates a service-role Supabase client that bypasses RLS.
 *
 * Auto-refresh and session persistence are disabled: this client never acts on
 * behalf of a user and holds no session, so there is nothing to persist or
 * refresh. Create it on demand inside the specific admin operation that needs
 * it; do not hold it in shared module state.
 */
export function createServiceRoleSupabaseClient() {
  const { SUPABASE_URL } = requirePublicEnv();
  const serviceRoleKey = requireServiceRoleKey();

  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
