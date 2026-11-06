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
