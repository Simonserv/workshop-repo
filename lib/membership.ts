/**
 * membership.ts — SERVER-SIDE membership domain logic (application layer).
 *
 * Implements the authenticated-User parts of the Membership component from the
 * design (Flow 2): submitting a proof-of-payment receipt and reading one's own
 * membership status. Staff/Admin review (approve/reject + signed view URLs) is
 * a separate dashboard task (9.2) and is NOT here.
 *
 * All data access goes through the ROLE-AWARE server client so Row Level
 * Security applies with the caller's own role — RLS remains the authoritative
 * boundary (a User may insert their own PENDING receipt and read their own
 * profile/receipts; nothing here bypasses that). Receipt files are stored
 * PRIVATELY via `lib/storage/receipts.ts`; only the `file_key` is persisted,
 * never a public URL (Requirement 10.1).
 *
 * `import 'server-only'` keeps this off the client bundle.
 *
 * Requirements: 8.2 (store privately + persist PENDING receipt), 8.7 (read own
 * membership status), 8.8 (reject bad file type/size), 10.1 (private file_key).
 */

import "server-only";

import { assertRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { uploadReceipt, validateReceiptFile } from "@/lib/storage/receipts";

/** The two membership states (mirrors the `membership_status` enum). */
export type MembershipStatus = "MEMBER" | "NON_MEMBER";

/**
 * Discriminated result of submitting a membership receipt. `status` carries the
 * HTTP status the route handler should return: 401 (unauthenticated), 400
 * (missing or invalid file), 201 (created), or 500 (upstream failure).
 */
export type SubmitReceiptResult =
  | { ok: true; status: 201; receiptStatus: "PENDING" }
  | { ok: false; status: 400 | 401 | 500; error: string };

/**
 * Submits a membership receipt for the authenticated User (Flow 2).
 *
 * Steps:
 *   1. Require an authenticated session (any of the three roles may upload a
 *      membership receipt for themselves). An absent/invalid session → 401.
 *   2. Validate the file against the shared allow-list + size cap; a bad file
 *      → 400 (Requirement 8.8). We validate up front so no upload happens for
 *      an invalid file.
 *   3. Upload to the PRIVATE bucket via `uploadReceipt`, which returns only the
 *      private `file_key` (Requirement 10.1).
 *   4. Insert a `membership_receipts` row with status PENDING for the caller.
 *      RLS permits a user to insert only their own PENDING receipt.
 *
 * The receipt status defaults to PENDING in the schema; we set `status` and
 * `user_id` explicitly so intent is clear and RLS can match the owner.
 */
export async function submitMembershipReceipt(
  file: File | null,
): Promise<SubmitReceiptResult> {
  // 1) Authenticated User (membership upload requires a session).
  const auth = await assertRole(["USER", "STAFF", "ADMIN"]);
  if (!auth.ok) {
    // Every role is allowed, so a failure is always an unauthenticated session.
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  // 2) Validate presence + file type/size BEFORE any upload (Requirement 8.8).
  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return { ok: false, status: 400, error: "A receipt file is required." };
  }
  const validation = validateReceiptFile(file);
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.reason };
  }

  try {
    // 3) Store privately; persist ONLY the returned file_key (Requirement 10.1).
    const fileKey = await uploadReceipt(file);

    // 4) Persist the PENDING receipt owned by the caller (Requirement 8.2).
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("membership_receipts").insert({
      user_id: auth.userId,
      file_key: fileKey,
      status: "PENDING",
    });

    if (error) {
      return {
        ok: false,
        status: 500,
        error: "Could not submit your receipt. Please try again.",
      };
    }

    return { ok: true, status: 201, receiptStatus: "PENDING" };
  } catch {
    // Generic message only; diagnostics stay server-side (Requirement 14.6).
    return {
      ok: false,
      status: 500,
      error: "Could not submit your receipt. Please try again.",
    };
  }
}

/**
 * Result of reading the caller's own membership status (`getMyMembership`).
 */
export type MyMembershipResult =
  | { ok: true; status: 200; membershipStatus: MembershipStatus }
  | { ok: false; status: 401 | 500; error: string };

/**
 * Returns the authenticated caller's current `membership_status`
 * (Requirement 8.7). Reads the caller's own `profiles` row through the
 * role-aware client, so RLS scopes the read to the owner.
 */
export async function getMyMembership(): Promise<MyMembershipResult> {
  const auth = await assertRole(["USER", "STAFF", "ADMIN"]);
  if (!auth.ok) {
    // Every role is allowed here, so a failure is always an unauthenticated
    // session (401), never a 403.
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("membership_status")
    .eq("id", auth.userId)
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: "Could not load your membership status.",
    };
  }

  return {
    ok: true,
    status: 200,
    membershipStatus: data.membership_status as MembershipStatus,
  };
}
