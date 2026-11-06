/**
 * browser.ts — BROWSER Supabase client (public, anon key).
 *
 * Use this from Client Components ("use client"). It carries only the PUBLIC
 * credentials (project URL + anon key), which are safe to ship in the browser
 * bundle: Row Level Security — not the anon key — is what protects the data.
 *
 * This client does NOT bypass RLS. Any request it makes is subject to the same
 * policies as an unauthenticated visitor until an authenticated session exists
 * (the session cookie is managed by the SSR cookie layer on the server).
 *
 * Requirements: 6.1 (role-aware access via RLS), 14.4 (only anon key + URL are
 * public).
 */

import { createBrowserClient } from "@supabase/ssr";

import { requirePublicEnv } from "@/lib/env";

/**
 * Creates a Supabase client for use in Client Components.
 *
 * Reuses the typed env contract (`requirePublicEnv`) so a missing/empty key
 * fails fast with a clear, actionable message instead of a cryptic runtime
 * error deep inside Supabase.
 */
export function createBrowserSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = requirePublicEnv();
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
