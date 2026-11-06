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

/* ===========================================================================
 * Staff/Admin membership receipt REVIEW (task 9.2).
 *
 * These functions are the Staff/Admin side of the Membership component. They
 * are guarded by `assertRole(['STAFF','ADMIN'])` for a friendly 401/403, but
 * RLS remains authoritative: the receipt read/update policies (db/rls.sql §4.4)
 * expose/accept these rows only for STAFF/ADMIN, and approval goes through the
 * SECURITY DEFINER `approve_receipt()` function (§4.7), the ONLY path that sets
 * MEMBER (Correctness Property 1). Receipts are viewed only via short-lived
 * signed URLs minted here (Requirement 10.2/10.4; Correctness Property 3).
 *
 * Requirements: 8.3 (approve → MEMBER, transactional), 8.5 (reject with
 * reason), 8.6 (409 on non-PENDING), 10.2/10.3/10.4 (signed-URL viewing,
 * Staff/Admin only), 12.3/12.5 (review dashboard + guard).
 * =========================================================================== */

import { createSignedUrl } from "@/lib/storage/receipts";

/** A membership receipt row as presented in the review dashboard. */
export interface DbMembershipReceipt {
  id: string;
  user_id: string;
  file_key: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  /** Owning user's email for reviewer context (RLS exposes to Staff/Admin). */
  user: { email: string | null } | null;
  /** Short-lived signed URL to view the receipt file; null if minting failed. */
  viewUrl: string | null;
}

const RECEIPT_COLUMNS =
  "id, user_id, file_key, status, reviewed_by, review_note, created_at, user:profiles!membership_receipts_user_id_fkey(email)";

/** Discriminated result for the pending-receipts list. */
export type ListPendingReceiptsResult =
  | { ok: true; status: 200; receipts: DbMembershipReceipt[] }
  | { ok: false; status: 401 | 403 | 500; error: string };

/**
 * Lists PENDING membership receipts for review, ordered by `created_at`
 * (oldest first, so the longest-waiting receipt is handled first), each with a
 * freshly-minted short-lived signed view URL (Requirements 8.5-ordering, 10.2,
 * 12.3). Guarded by `assertRole(['STAFF','ADMIN'])`; RLS independently scopes
 * the read to Staff/Admin.
 */
export async function listPendingReceipts(): Promise<ListPendingReceiptsResult> {
  const auth = await assertRole(["STAFF", "ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("membership_receipts")
    .select(RECEIPT_COLUMNS)
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, status: 500, error: "Unable to load receipts." };
  }

  // Supabase types an embedded to-one relation as an array; normalize the
  // joined user to the single object (or null) it is at runtime.
  const rows = (
    (data ?? []) as unknown as (Omit<
      DbMembershipReceipt,
      "viewUrl" | "user"
    > & {
      user: { email: string | null } | { email: string | null }[] | null;
    })[]
  ).map((row) => ({
    ...row,
    user: Array.isArray(row.user) ? (row.user[0] ?? null) : row.user,
  }));

  // Mint a signed URL per receipt. A single failure must not fail the whole
  // list — that receipt simply renders without a view link.
  const receipts: DbMembershipReceipt[] = await Promise.all(
    rows.map(async (row) => {
      let viewUrl: string | null = null;
      try {
        viewUrl = await createSignedUrl(row.file_key);
      } catch {
        viewUrl = null;
      }
      return { ...row, viewUrl };
    }),
  );

  return { ok: true, status: 200, receipts };
}

/** Discriminated result for a receipt review action (approve / reject). */
export type ReviewReceiptResult =
  | { ok: true; status: 200; receiptStatus: "APPROVED" | "REJECTED" }
  | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 500; error: string };

/**
 * Approves a membership receipt (Requirement 8.3). Delegates to the
 * transactional `approve_receipt()` Postgres function (db/rls.sql §4.7), which
 * atomically sets the receipt to APPROVED and the owning user to MEMBER — the
 * ONLY path that grants membership. The function enforces its own Staff/Admin
 * guard, 404 when the receipt is absent, and 409 when it is not PENDING (review
 * is terminal and single — Requirement 8.6, Correctness Property 5); we map
 * those SQLSTATE codes to HTTP statuses.
 */
export async function approveReceipt(
  receiptId: string,
): Promise<ReviewReceiptResult> {
  const auth = await assertRole(["STAFF", "ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }
  if (!receiptId) {
    return { ok: false, status: 400, error: "Missing receipt id." };
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc("approve_receipt", {
    p_receipt_id: receiptId,
  });

  if (error) {
    // Map the SQLSTATE codes raised by approve_receipt() to HTTP statuses.
    switch (error.code) {
      case "P0002": // no_data_found → receipt not found
        return { ok: false, status: 404, error: "Receipt not found." };
      case "23505": // mapped in the function to "already reviewed"
        return {
          ok: false,
          status: 409,
          error: "This receipt has already been reviewed.",
        };
      case "42501": // insufficient_privilege (defense in depth)
        return { ok: false, status: 403, error: "Forbidden." };
      default:
        return { ok: false, status: 500, error: "Could not approve the receipt." };
    }
  }

  return { ok: true, status: 200, receiptStatus: "APPROVED" };
}

/**
 * Rejects a membership receipt with a reason (Requirement 8.5). Rejection does
 * NOT grant membership, so it is a plain guarded UPDATE (RLS §4.4 restricts it
 * to Staff/Admin) rather than the approval RPC. To keep review terminal and
 * single (Requirement 8.6, Property 5), the update is conditioned on the
 * receipt still being PENDING; a non-PENDING receipt matches no row → 409.
 */
export async function rejectReceipt(
  receiptId: string,
  reason: string,
): Promise<ReviewReceiptResult> {
  const auth = await assertRole(["STAFF", "ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }
  if (!receiptId) {
    return { ok: false, status: 400, error: "Missing receipt id." };
  }
  const note = reason.trim();
  if (note.length === 0) {
    return { ok: false, status: 400, error: "A rejection reason is required." };
  }

  const supabase = createServerSupabaseClient();
  // Confirm the receipt exists so we can tell 404 (absent) from 409 (already
  // reviewed) — both otherwise produce an empty update result.
  const { data: existing, error: readError } = await supabase
    .from("membership_receipts")
    .select("id, status")
    .eq("id", receiptId)
    .maybeSingle();

  if (readError) {
    return { ok: false, status: 500, error: "Could not reject the receipt." };
  }
  if (!existing) {
    return { ok: false, status: 404, error: "Receipt not found." };
  }
  if (existing.status !== "PENDING") {
    return {
      ok: false,
      status: 409,
      error: "This receipt has already been reviewed.",
    };
  }

  const { data, error } = await supabase
    .from("membership_receipts")
    .update({
      status: "REJECTED",
      reviewed_by: auth.userId,
      review_note: note,
    })
    .eq("id", receiptId)
    .eq("status", "PENDING")
    .select("id");

  if (error) {
    return { ok: false, status: 500, error: "Could not reject the receipt." };
  }
  if (!data || data.length === 0) {
    // Raced with another reviewer between the read and the update.
    return {
      ok: false,
      status: 409,
      error: "This receipt has already been reviewed.",
    };
  }

  return { ok: true, status: 200, receiptStatus: "REJECTED" };
}

/** Discriminated result for minting a single receipt view URL. */
export type ReceiptViewUrlResult =
  | { ok: true; status: 200; url: string }
  | { ok: false; status: 401 | 403 | 404 | 500; error: string };

/**
 * Mints a short-lived signed URL to view one receipt (the design's
 * `getReceiptViewUrl` algorithm). Guarded by `assertRole(['STAFF','ADMIN'])`
 * so a non-Staff/Admin caller is denied (Requirement 10.4); a receipt the
 * caller cannot read under RLS is reported as 404 without leaking existence.
 */
export async function getReceiptViewUrl(
  receiptId: string,
): Promise<ReceiptViewUrlResult> {
  const auth = await assertRole(["STAFF", "ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }
  if (!receiptId) {
    return { ok: false, status: 404, error: "Receipt not found." };
  }

  const supabase = createServerSupabaseClient();
  const { data: receipt, error } = await supabase
    .from("membership_receipts")
    .select("file_key")
    .eq("id", receiptId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "Could not load the receipt." };
  }
  if (!receipt) {
    return { ok: false, status: 404, error: "Receipt not found." };
  }

  try {
    const url = await createSignedUrl(receipt.file_key);
    return { ok: true, status: 200, url };
  } catch {
    return { ok: false, status: 500, error: "Could not create a view link." };
  }
}
