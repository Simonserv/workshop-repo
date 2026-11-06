"use server";

/**
 * actions.ts — Register / Login / Logout via Supabase Auth (Server Actions).
 *
 * These are the authentication entry points for the app. They run on the server
 * and use the ROLE-AWARE server client (`createServerSupabaseClient`), which is
 * wired to the request cookies — so Supabase sets, refreshes, and clears the
 * session cookie through this client. The service-role client is deliberately
 * NOT used here: authentication must act as the caller, not bypass RLS.
 *
 * Role / membership defaults are enforced SERVER-SIDE BY THE DATABASE, not here:
 * the `handle_new_user` trigger (db/schema.sql, Task 3) inserts the `profiles`
 * row with role `USER` and `membership_status` `NON_MEMBER` on every new auth
 * user. We therefore never accept or forward any client-supplied role/membership
 * value at registration (Requirements 5.1, 5.5, 6.3) — the only inputs are email
 * and password, which Supabase Auth hashes and stores (Requirement 5.4).
 *
 * Error handling returns a generic message to the caller and never leaks stack
 * traces or internal diagnostics (Requirement 14.6).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.3, 14.2, 14.6
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Outcome of an auth action.
 *
 * `ok: true` means the operation succeeded (account created, session
 * established, or session terminated). `ok: false` carries a safe, generic
 * error message suitable for display — never an internal diagnostic.
 */
export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * Registers a new account via Supabase Auth (Requirement 5.1).
 *
 * Only email + password are passed to Supabase. The `profiles` row — and its
 * forced role `USER` / `membership_status` `NON_MEMBER` — is created by the
 * `handle_new_user` database trigger, so no client-supplied role/membership
 * value is ever honored (Requirements 5.5, 6.3). A malformed or
 * already-registered email surfaces as an error (Requirement 5.6).
 */
export async function register(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Generic message; do not echo provider internals (Requirement 14.6).
    return { ok: false, error: "Registration failed. Please try again." };
  }

  return { ok: true };
}

/**
 * Logs in with email + password via Supabase Auth, establishing an
 * authenticated session and issuing a JWT stored in the session cookie
 * (Requirement 5.2). Invalid credentials surface as a generic error.
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "Invalid email or password." };
  }

  return { ok: true };
}

/**
 * Logs out, terminating the authenticated session and clearing the session
 * cookie through the role-aware server client (Requirement 5.3).
 */
export async function logout(): Promise<AuthResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { ok: false, error: "Logout failed. Please try again." };
  }

  return { ok: true };
}
