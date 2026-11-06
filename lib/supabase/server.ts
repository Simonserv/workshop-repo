/**
 * server.ts — ROLE-AWARE SERVER Supabase client (the normal server path).
 *
 * This is the client to use from Server Components, Route Handlers, and Server
 * Actions for all normal data access. It reads the Supabase session JWT from
 * the request cookies and forwards it to Postgres, so **Row Level Security
 * applies with the caller's own role** (role resolved server-side via
 * `auth.uid()` → `profiles.role`). It uses the PUBLIC anon key — it does NOT
 * bypass RLS.
 *
 * `import 'server-only'` guarantees a build-time error if this module is ever
 * imported into a Client Component, keeping the cookie/session wiring on the
 * server where it belongs.
 *
 * Requirements: 6.1 (role resolved from the session, never client-supplied),
 * 6.4 (session JWT read from cookies so RLS applies), 14.5 (server-side access
 * stays on the server).
 */

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requirePublicEnv } from "@/lib/env";

/**
 * Creates a role-aware Supabase server client bound to the current request's
 * cookies.
 *
 * Must be called per request (never cached across requests) so each render/
 * handler sees the correct session. The cookie store is wired for both reads
 * (`getAll`) and writes (`setAll`) so Supabase can refresh the session token
 * when needed.
 *
 * `setAll` can throw when called from a Server Component (cookies there are
 * read-only). That is expected: in that context the session is refreshed by
 * middleware/route handlers instead, so the write is safely ignored.
 */
export function createServerSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = requirePublicEnv();
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies are read-only.
          // The session is refreshed from a Route Handler / middleware, so
          // this write can be safely ignored here.
        }
      },
    },
  });
}
