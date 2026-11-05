/**
 * env.ts — THE ENVIRONMENT CONTRACT (do not edit to add real keys here)
 *
 * This module is the single, typed source of truth for the three environment
 * variables this app uses. It documents — and enforces at the type level —
 * which variables are PUBLIC and which is SERVER-ONLY.
 *
 * Students never edit this file. You provide values by copying `.env.example`
 * to `.env.local` and pasting your own Supabase keys. See `.env.example`.
 *
 * The contract (Requirements 14.3 and 14.4):
 *   - PUBLIC (prefixed `NEXT_PUBLIC_`, safe in the browser bundle):
 *       NEXT_PUBLIC_SUPABASE_URL
 *       NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - SERVER-ONLY (never prefixed `NEXT_PUBLIC_`, never sent to the browser):
 *       SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: This task (2.1) only defines the env contract. The Supabase client
 * factories that consume these values are built in task 2.2.
 */

/**
 * Public environment variables.
 *
 * These are safe to read from both client and server components because they
 * carry the `NEXT_PUBLIC_` prefix and are therefore inlined into the client
 * bundle by Next.js at build time.
 *
 * Next.js statically replaces `process.env.NEXT_PUBLIC_*` references, so they
 * are accessed by their full literal names rather than computed dynamically.
 */
export const publicEnv = {
  /** Supabase project URL (public). */
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  /** Supabase anon/public key (public; RLS protects the data, not this key). */
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

/**
 * Reads a server-only environment variable.
 *
 * This MUST only ever be called from server-only code (Server Components,
 * route handlers, server actions). The `service_role` key bypasses Row Level
 * Security, so leaking it into the client bundle would hand full admin access
 * to every visitor.
 *
 * It is intentionally exposed through a function (not a top-level constant) so
 * that merely importing this module from a client component does not read the
 * secret.
 */
export function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Validates that the two PUBLIC variables are present and returns them as
 * guaranteed-non-empty strings. Call this from the browser/server Supabase
 * client factories (task 2.2) to fail fast with a clear message when a student
 * has not yet pasted their keys.
 */
export function requirePublicEnv(): {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
} {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = publicEnv;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase public env vars. Copy .env.example to .env.local and " +
        "set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { SUPABASE_URL, SUPABASE_ANON_KEY };
}

/**
 * Validates and returns the SERVER-ONLY service-role key. Call this only from
 * the server-only service-role client factory (task 2.2).
 */
export function requireServiceRoleKey(): string {
  const key = getServiceRoleKey();
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (server-only). Set it in .env.local " +
        "and in your Vercel project. Never prefix it with NEXT_PUBLIC_.",
    );
  }
  return key;
}
