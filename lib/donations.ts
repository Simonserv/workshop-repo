/**
 * donations.ts — SERVER-SIDE donation domain logic (application layer).
 *
 * Implements the PUBLIC donation submission from the design's Donation
 * component (Flow 3). Donations never require authentication (Requirement 9.1),
 * so no `assertRole` guard is applied here — the insert runs through the
 * role-aware client as the (possibly anonymous) caller, and RLS permits an
 * anonymous insert while the `amount > 0` CHECK and these checks protect
 * integrity. Staff/Admin review (verify/reject) is a separate dashboard task
 * (9.3) and is NOT here.
 *
 * Receipt files are stored PRIVATELY via `lib/storage/receipts.ts`; only the
 * `file_key` is persisted, never a public URL (Requirement 10.1).
 *
 * `import 'server-only'` keeps this off the client bundle.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.10, 10.1.
 */

import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { uploadReceipt, validateReceiptFile } from "@/lib/storage/receipts";

/** Raw, untrusted donation input collected from the public form. */
export interface DonationInput {
  /** Amount as submitted (string from a form field or a number). */
  amount: unknown;
  /** Optional donor name; blank/omitted → anonymous for this field. */
  donorName?: string | null;
  /** Optional donor email; blank/omitted → anonymous for this field. */
  donorEmail?: string | null;
  /** The receipt proof-of-payment file. */
  file: File | null;
}

/**
 * Discriminated result of submitting a donation. `status` carries the HTTP
 * status the route handler should return: 400 (amount<=0 or bad/missing file),
 * 201 (created), or 500 (upstream failure).
 */
export type SubmitDonationResult =
  | { ok: true; status: 201; donationStatus: "PENDING" }
  | { ok: false; status: 400 | 500; error: string };

/**
 * Parses the submitted amount to a positive number, or null if it is not a
 * finite number greater than zero. A blank, non-numeric, zero, or negative
 * amount all collapse to null so the caller rejects with 400 (Requirements 9.2,
 * 9.3).
 */
function parsePositiveAmount(raw: unknown): number | null {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

/**
 * Normalizes an optional donor field: trims it, and treats an empty string as
 * omitted (null). This drives the anonymous-vs-one-field logic (Requirements
 * 9.5, 9.6).
 */
function normalizeOptional(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Submits a public donation (Flow 3).
 *
 * Order of checks (reject before doing any work that persists or uploads):
 *   1. Amount must be > 0, else 400 (Requirements 9.2, 9.3). Checked first so a
 *      non-positive amount is rejected before touching storage.
 *   2. A receipt file is required and must pass the shared allow-list + size cap
 *      (reuses `validateReceiptFile`); a bad/missing file → 400 (Requirement
 *      9.10).
 *   3. Donor fields: when BOTH name and email are omitted, persist null/null as
 *      an anonymous donation (Requirement 9.5). When exactly one is provided,
 *      persist that one, null the other, and treat it as non-anonymous
 *      (Requirement 9.6) — this falls out naturally from normalizing each field
 *      independently.
 *   4. Store the receipt privately and persist the donation with status PENDING
 *      (Requirements 9.4, 10.1).
 */
export async function submitDonation(
  input: DonationInput,
): Promise<SubmitDonationResult> {
  // 1) Amount > 0 (Requirements 9.2, 9.3) — checked first, before any upload.
  const amount = parsePositiveAmount(input.amount);
  if (amount === null) {
    return {
      ok: false,
      status: 400,
      error: "Enter a donation amount greater than zero.",
    };
  }

  // 2) Receipt file required + valid (Requirement 9.10).
  const file = input.file;
  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return { ok: false, status: 400, error: "A receipt file is required." };
  }
  const validation = validateReceiptFile(file);
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.reason };
  }

  // 3) Donor fields: normalize each independently. Both empty → anonymous
  //    (null/null); exactly one present → keep it, null the other, treated as
  //    non-anonymous (Requirements 9.5, 9.6).
  const donorName = normalizeOptional(input.donorName);
  const donorEmail = normalizeOptional(input.donorEmail);

  try {
    // 4) Store privately; persist ONLY the file_key (Requirement 10.1).
    const fileKey = await uploadReceipt(file);

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("donations").insert({
      donor_name: donorName,
      donor_email: donorEmail,
      amount,
      file_key: fileKey,
      status: "PENDING",
    });

    if (error) {
      return {
        ok: false,
        status: 500,
        error: "Could not record your donation. Please try again.",
      };
    }

    return { ok: true, status: 201, donationStatus: "PENDING" };
  } catch {
    // Generic message only; diagnostics stay server-side (Requirement 14.6).
    return {
      ok: false,
      status: 500,
      error: "Could not record your donation. Please try again.",
    };
  }
}

/* ===========================================================================
 * Staff/Admin donation REVIEW (task 9.3).
 *
 * The Staff/Admin side of the Donation component: a status-filtered list with
 * signed receipt view URLs, plus verify / reject actions. Guarded by
 * `assertRole(['STAFF','ADMIN'])` for a friendly 401/403, with RLS (db/rls.sql
 * §4.5) as the authoritative boundary — donations are readable/updatable only
 * by STAFF/ADMIN. Review is terminal and single: verifying or rejecting a
 * non-PENDING donation returns 409 (Requirement 9.9, Correctness Property 5).
 * Receipts are viewed only via short-lived signed URLs (Requirement 10).
 *
 * Requirements: 9.7 (verify → VERIFIED), 9.8 (reject with reason), 9.9 (409 on
 * non-PENDING), 12.4/12.5 (review dashboard + guard).
 * =========================================================================== */

import { assertRole } from "@/lib/auth";
import { createSignedUrl } from "@/lib/storage/receipts";

/** The three donation states (mirrors the `donation_status` enum). */
export type DonationStatus = "PENDING" | "VERIFIED" | "REJECTED";

/** The set of valid donation statuses, for server-side filter validation. */
export const DONATION_STATUSES: readonly DonationStatus[] = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
];

/** A donation row as presented in the review dashboard. */
export interface DbDonation {
  id: string;
  donor_name: string | null;
  donor_email: string | null;
  amount: number;
  file_key: string;
  status: DonationStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  /** Short-lived signed URL to view the receipt file; null if minting failed. */
  viewUrl: string | null;
}

const DONATION_COLUMNS =
  "id, donor_name, donor_email, amount, file_key, status, reviewed_by, review_note, created_at";

/** Discriminated result for the Staff/Admin donation list. */
export type ListDonationsResult =
  | { ok: true; status: 200; donations: DbDonation[] }
  | { ok: false; status: 401 | 403 | 500; error: string };

/**
 * Lists donations for review, newest first, optionally filtered by status
 * (Requirement 12.4). Each row carries a freshly-minted short-lived signed
 * receipt view URL (Requirement 10.2). Guarded by `assertRole`; RLS scopes the
 * read to Staff/Admin.
 */
export async function listDonations(
  statusFilter?: string | null,
): Promise<ListDonationsResult> {
  const auth = await assertRole(["STAFF", "ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }

  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("donations")
    .select(DONATION_COLUMNS)
    .order("created_at", { ascending: false });

  if (
    statusFilter &&
    (DONATION_STATUSES as readonly string[]).includes(statusFilter)
  ) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, status: 500, error: "Unable to load donations." };
  }

  const rows = (data ?? []) as Omit<DbDonation, "viewUrl">[];
  const donations: DbDonation[] = await Promise.all(
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

  return { ok: true, status: 200, donations };
}

/** Discriminated result for a donation review action (verify / reject). */
export type ReviewDonationResult =
  | { ok: true; status: 200; donationStatus: "VERIFIED" | "REJECTED" }
  | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 500; error: string };

/**
 * Transitions a PENDING donation to a terminal review state. Shared by verify
 * and reject: both are guarded Staff/Admin UPDATEs conditioned on the donation
 * still being PENDING, so a non-PENDING donation yields 409 (Requirement 9.9,
 * Property 5). A rejection requires a non-empty reason (Requirement 9.8).
 */
async function reviewDonation(
  donationId: string,
  target: "VERIFIED" | "REJECTED",
  reason?: string,
): Promise<ReviewDonationResult> {
  const auth = await assertRole(["STAFF", "ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }
  if (!donationId) {
    return { ok: false, status: 400, error: "Missing donation id." };
  }

  let note: string | null = null;
  if (target === "REJECTED") {
    note = (reason ?? "").trim();
    if (note.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "A rejection reason is required.",
      };
    }
  }

  const supabase = createServerSupabaseClient();
  // Distinguish 404 (absent) from 409 (already reviewed).
  const { data: existing, error: readError } = await supabase
    .from("donations")
    .select("id, status")
    .eq("id", donationId)
    .maybeSingle();

  if (readError) {
    return { ok: false, status: 500, error: "Could not update the donation." };
  }
  if (!existing) {
    return { ok: false, status: 404, error: "Donation not found." };
  }
  if (existing.status !== "PENDING") {
    return {
      ok: false,
      status: 409,
      error: "This donation has already been reviewed.",
    };
  }

  const { data, error } = await supabase
    .from("donations")
    .update({
      status: target,
      reviewed_by: auth.userId,
      review_note: note,
    })
    .eq("id", donationId)
    .eq("status", "PENDING")
    .select("id");

  if (error) {
    return { ok: false, status: 500, error: "Could not update the donation." };
  }
  if (!data || data.length === 0) {
    // Raced with another reviewer between the read and the update.
    return {
      ok: false,
      status: 409,
      error: "This donation has already been reviewed.",
    };
  }

  return { ok: true, status: 200, donationStatus: target };
}

/** Verifies a PENDING donation → VERIFIED (Requirement 9.7). */
export function verifyDonation(
  donationId: string,
): Promise<ReviewDonationResult> {
  return reviewDonation(donationId, "VERIFIED");
}

/** Rejects a PENDING donation with a reason → REJECTED (Requirement 9.8). */
export function rejectDonation(
  donationId: string,
  reason: string,
): Promise<ReviewDonationResult> {
  return reviewDonation(donationId, "REJECTED", reason);
}
