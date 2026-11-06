/**
 * app/api/inquiries/route.ts — public inquiry submission (Route Handler).
 *
 * Implements the design's `submitInquiry` algorithm and Flow 1. This endpoint
 * is PUBLIC: it accepts submissions with no authentication (Requirements 4.1,
 * 6.5). When the submitter IS authenticated, their verified user id is attached
 * as `owner_id` so they can later see their own inquiry (owner read via RLS);
 * anonymous submissions leave `owner_id` null.
 *
 * Order of checks mirrors the algorithm and the HTTP status conventions in
 * tech.md:
 *   1. Validate input — non-empty name, well-formed email, non-empty details.
 *      On failure respond 400 with field-level errors and PERSIST NOTHING
 *      (Requirements 4.2, 4.5).
 *   2. Confirm the `listing_id` references a listing that is published/active
 *      at submission time. A missing/unpublished/invalid listing is a 400
 *      (Requirements 4.3, 4.4; Correctness Property 4). The lookup goes through
 *      the role-aware server client, so RLS decides whether the row is visible
 *      — an anon/USER submitter cannot "see" an unpublished listing, so it is
 *      correctly treated as invalid.
 *   3. Sanitize name + details (Requirement 4.6) and insert with status NEW,
 *      returning 201 with the new inquiry id (Requirement 4.2).
 *
 * All DB access uses the Supabase query builder (parameterized), never
 * string-built SQL (Requirement 14.5). Upstream failures return a generic 500
 * with no internal diagnostics (Requirement 14.6).
 */

import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRoleFromSession } from "@/lib/auth";
import {
  isNonEmpty,
  isValidEmail,
  normalizeString,
  sanitizeText,
} from "@/lib/validation";

/** Field-level validation errors keyed by form field name. */
type FieldErrors = {
  name?: string;
  email?: string;
  details?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  // --- Parse the body (JSON). A malformed body is treated as invalid input. ---
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const listingId = normalizeString(body.listingId);
  const name = normalizeString(body.name);
  const email = normalizeString(body.email);
  const details = normalizeString(body.details);
  const phone = normalizeString(body.phone);

  // --- 1. Field validation — persist nothing on failure (4.2, 4.5). ---
  const fieldErrors: FieldErrors = {};
  if (!isNonEmpty(name)) {
    fieldErrors.name = "Please enter your name.";
  }
  if (!isValidEmail(email)) {
    fieldErrors.email = "Please enter a valid email address.";
  }
  if (!isNonEmpty(details)) {
    fieldErrors.details = "Please tell us a little about your request.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Please correct the highlighted fields.", fieldErrors },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();

  // --- 2. Listing must exist and be published/active at submission time ---
  // (4.3, 4.4). RLS governs visibility, so an unpublished listing is invisible
  // to an anon/USER submitter and is correctly rejected as invalid. We also
  // guard against a missing id up front.
  if (!isNonEmpty(listingId)) {
    return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, is_published")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError) {
    // Upstream DB failure → generic 500 (Requirement 14.6).
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (!listing || !listing.is_published) {
    return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
  }

  // --- Associate owner_id when the submitter is authenticated (4.1). ---
  // Resolved from the verified session, never client-supplied.
  const resolution = await getRoleFromSession();
  const ownerId = resolution.authenticated ? resolution.userId : null;

  // --- 3. Sanitize free text (4.6) and insert with status NEW (4.2). ---
  const { data: inserted, error: insertError } = await supabase
    .from("inquiries")
    .insert({
      listing_id: listingId,
      owner_id: ownerId,
      customer_name: sanitizeText(name),
      customer_email: email,
      customer_phone: phone ? sanitizeText(phone) : null,
      project_details: sanitizeText(details),
      status: "NEW",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ inquiryId: inserted.id }, { status: 201 });
}
