/**
 * inquiries.ts — SERVER-SIDE inquiry triage domain logic (Staff/Admin, task 9.1).
 *
 * This is the Staff/Admin side of the Inquiry component from the design
 * (Component 2): listing inquiries, filtering by status, and updating a
 * record's status / `handled_by`. The PUBLIC submission path lives in the
 * route handler `app/api/inquiries/route.ts` (task 7.4) and is NOT here.
 *
 * Every function is guarded by `assertRole(['STAFF','ADMIN'])` so the
 * application layer returns a friendly 401/403, but RLS remains the
 * AUTHORITATIVE boundary: the inquiry read/update policies (db/rls.sql §4.3)
 * only expose/accept these rows for STAFF/ADMIN, so even a bypassed app check
 * cannot read or mutate an inquiry it must not. All access goes through the
 * ROLE-AWARE server client (never the service-role client).
 *
 * `import 'server-only'` keeps this off the client bundle.
 *
 * Requirements: 12.1 (list all, status-filtered), 12.2 (update status /
 * handled_by), 12.5 (Staff/Admin guard), 12.6 (text rendered escaped — the
 * stored text was sanitized on insert and React escapes on render).
 */

import "server-only";

import { assertRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** The three inquiry states (mirrors the `inquiry_status` enum). */
export type InquiryStatus = "NEW" | "IN_PROGRESS" | "CLOSED";

/** The set of valid inquiry statuses, for server-side validation of input. */
export const INQUIRY_STATUSES: readonly InquiryStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "CLOSED",
];

/** An inquiry row as presented in the triage dashboard. */
export interface DbInquiry {
  id: string;
  listing_id: string;
  owner_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  project_details: string;
  status: InquiryStatus;
  handled_by: string | null;
  created_at: string;
  /** Joined listing title for context (RLS exposes listings to Staff/Admin). */
  listing: { title: string } | null;
}

const INQUIRY_COLUMNS =
  "id, listing_id, owner_id, customer_name, customer_email, customer_phone, project_details, status, handled_by, created_at, listing:listings(title)";

/** Discriminated result for the Staff/Admin inquiry list. */
export type ListInquiriesResult =
  | { ok: true; status: 200; inquiries: DbInquiry[] }
  | { ok: false; status: 401 | 403 | 500; error: string };

/**
 * Lists inquiries for a Staff/Admin reviewer, newest first, optionally filtered
 * by status (Requirement 12.1). An unknown/absent `statusFilter` returns all
 * rows. The read runs through the role-aware client, so RLS returns inquiries
 * only to STAFF/ADMIN.
 */
export async function listInquiries(
  statusFilter?: string | null,
): Promise<ListInquiriesResult> {
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
    .from("inquiries")
    .select(INQUIRY_COLUMNS)
    .order("created_at", { ascending: false });

  // Apply the status filter only when it is one of the known statuses.
  if (
    statusFilter &&
    (INQUIRY_STATUSES as readonly string[]).includes(statusFilter)
  ) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, status: 500, error: "Unable to load inquiries." };
  }

  // Supabase types an embedded to-one relation as an array; normalize the
  // joined listing to the single object (or null) it is at runtime.
  const inquiries: DbInquiry[] = (
    (data ?? []) as unknown as (Omit<DbInquiry, "listing"> & {
      listing: { title: string } | { title: string }[] | null;
    })[]
  ).map((row) => ({
    ...row,
    listing: Array.isArray(row.listing) ? (row.listing[0] ?? null) : row.listing,
  }));

  return { ok: true, status: 200, inquiries };
}

/** Discriminated result for an inquiry triage update. */
export type UpdateInquiryResult =
  | { ok: true; status: 200 }
  | { ok: false; status: 400 | 401 | 403 | 500; error: string };

/**
 * Updates an inquiry's status and/or assigns it to the acting reviewer
 * (`handled_by`), guarded by `assertRole(['STAFF','ADMIN'])` (Requirement
 * 12.2). At least one of `status` / `assignToSelf` must be supplied.
 *
 * `handled_by` is set to the VERIFIED caller id (never a client-supplied id),
 * so "assign to me" is the only assignment path and it cannot be forged. RLS
 * (§4.3 inquiries_update) independently restricts the update to STAFF/ADMIN.
 */
export async function updateInquiry(
  inquiryId: string,
  input: { status?: string | null; assignToSelf?: boolean },
): Promise<UpdateInquiryResult> {
  const auth = await assertRole(["STAFF", "ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }

  if (!inquiryId) {
    return { ok: false, status: 400, error: "Missing inquiry id." };
  }

  const patch: {
    status?: InquiryStatus;
    handled_by?: string;
  } = {};

  if (input.status != null) {
    if (!(INQUIRY_STATUSES as readonly string[]).includes(input.status)) {
      return { ok: false, status: 400, error: "Invalid status." };
    }
    patch.status = input.status as InquiryStatus;
  }

  if (input.assignToSelf) {
    patch.handled_by = auth.userId;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 400, error: "Nothing to update." };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inquiries")
    .update(patch)
    .eq("id", inquiryId)
    .select("id");

  if (error) {
    return { ok: false, status: 500, error: "Could not update the inquiry." };
  }
  // RLS can silently filter the row out (no match) for a non-Staff/Admin; with
  // the app guard above this means a bad id → treat as a 400.
  if (!data || data.length === 0) {
    return { ok: false, status: 400, error: "Inquiry not found." };
  }

  return { ok: true, status: 200 };
}
