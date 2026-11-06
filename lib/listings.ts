/**
 * listings.ts — SERVER-SIDE Listings data module (the catalog read path).
 *
 * This is the "Listings" domain component from the design (Component 1). Reads
 * go through the ROLE-AWARE server client (`createServerSupabaseClient`), which
 * forwards the caller's session JWT to Postgres, so **Row Level Security
 * decides which rows come back** — published listings for anonymous visitors
 * and `USER`, all listings (published + unpublished) for `STAFF`/`ADMIN`
 * (Requirements 2.1–2.3, 2.5, 3.1–3.3). The application layer deliberately does
 * NOT filter by role here: RLS is the authoritative boundary, and doing the
 * filter in app code would duplicate (and could weaken) it. Any role-derived UI
 * (e.g. flagging an unpublished row) is UX only.
 *
 * `import 'server-only'` guarantees a build-time error if this module is pulled
 * into a Client Component, keeping the session-bound query on the server.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5.
 */

import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InquiryType, ListingCategory } from "@/content/listings";

/**
 * A listing row as returned from the `listings` table (db/schema.sql). The
 * catalog and detail views render from this shape; `id` (a UUID) is the stable
 * identifier used in the detail-page URL — the DB has no slug column.
 */
export interface DbListing {
  id: string;
  title: string;
  category: ListingCategory;
  description: string;
  inquiry_type: InquiryType;
  /** Site-relative path under /images/ (file committed in public/images/). */
  image_url: string;
  is_published: boolean;
  created_at: string;
}

/** The columns the catalog/detail views need, selected explicitly. */
const LISTING_COLUMNS =
  "id, title, category, description, inquiry_type, image_url, is_published, created_at";

/**
 * Returns the listings the caller is allowed to see, newest first.
 *
 * RLS scopes the result set by the caller's role (published-only for
 * anon/USER, all for Staff/Admin) — this function issues the same query for
 * everyone and lets the database enforce visibility (Requirements 2.1–2.3,
 * 2.5). Uses the Supabase query builder (parameterized), never string-built SQL
 * (Requirement 14.5).
 */
export async function getVisibleListings(): Promise<DbListing[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    // Surface a failure to the caller so the page can render its error state;
    // the generic message carries no internal diagnostics (Requirement 14.6).
    throw new Error("Unable to load the catalog.");
  }

  return (data ?? []) as DbListing[];
}

/**
 * Returns a single listing by its id, or `null` when the caller cannot see it.
 *
 * RLS governs visibility of unpublished listings: an anonymous visitor or USER
 * requesting an unpublished listing gets no row back (the read is denied at the
 * data layer), which this function reports as `null` so the detail page can
 * render its not-found / denied state without leaking whether the row exists
 * (Requirements 3.1–3.3). Staff/Admin can retrieve unpublished listings.
 */
export async function getListingById(id: string): Promise<DbListing | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the listing.");
  }

  return (data as DbListing | null) ?? null;
}

/* ===========================================================================
 * ADMIN listing management (task 9.4).
 *
 * Create / edit / publish-unpublish, guarded by `assertRole(['ADMIN'])` for a
 * friendly 403. RLS remains authoritative: the listings insert/update policies
 * (db/rls.sql §4.2) accept writes only when `current_user_role() = 'ADMIN'`, so
 * a bypassed app check still cannot write. `image_url` is a site-relative
 * `/images/` path (no object storage for catalog images — Requirement 11.5).
 * Reads for the management grid reuse `getVisibleListings`, which under an
 * Admin session returns published AND unpublished rows via RLS.
 *
 * Requirements: 11.1 (create), 11.2 (edit), 11.3 (publish/unpublish), 11.4
 * (403 for non-Admin), 11.5 (`/images/` path).
 * =========================================================================== */

import { assertRole } from "@/lib/auth";

/** The listing categories (mirrors the `listing_category` enum). */
export const LISTING_CATEGORIES: readonly ListingCategory[] = [
  "CONSULTING",
  "WEB_DEV",
  "CUSTOM_SOFTWARE",
];

/** The inquiry types (mirrors the `inquiry_type` enum). */
export const INQUIRY_TYPES: readonly InquiryType[] = [
  "DEMO",
  "QUOTE",
  "INQUIRE",
];

/** Editable fields of a listing (everything except id/created_at). */
export interface ListingInput {
  title?: unknown;
  category?: unknown;
  description?: unknown;
  inquiry_type?: unknown;
  image_url?: unknown;
  is_published?: unknown;
}

/** Discriminated result for an Admin listing write. */
export type ListingWriteResult =
  | { ok: true; status: 200 | 201; id: string }
  | { ok: false; status: 400 | 401 | 403 | 404 | 500; error: string };

type NormalizedListing = {
  title: string;
  category: ListingCategory;
  description: string;
  inquiry_type: InquiryType;
  image_url: string;
  is_published: boolean;
};

/**
 * Validates + normalizes listing input for create (all fields required) or
 * edit. Returns either the normalized record or a field error message. The
 * `image_url` must be a site-relative `/images/` path (Requirement 11.5).
 */
function normalizeListingInput(
  input: ListingInput,
): { ok: true; value: NormalizedListing } | { ok: false; error: string } {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length === 0) {
    return { ok: false, error: "A title is required." };
  }

  const category = input.category;
  if (
    typeof category !== "string" ||
    !(LISTING_CATEGORIES as readonly string[]).includes(category)
  ) {
    return { ok: false, error: "Choose a valid category." };
  }

  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  if (description.length === 0) {
    return { ok: false, error: "A description is required." };
  }

  const inquiryType = input.inquiry_type;
  if (
    typeof inquiryType !== "string" ||
    !(INQUIRY_TYPES as readonly string[]).includes(inquiryType)
  ) {
    return { ok: false, error: "Choose a valid inquiry type." };
  }

  const imageUrl =
    typeof input.image_url === "string" ? input.image_url.trim() : "";
  if (!imageUrl.startsWith("/images/")) {
    return {
      ok: false,
      error: "The image path must be a site-relative /images/ path.",
    };
  }

  const isPublished = input.is_published === true;

  return {
    ok: true,
    value: {
      title,
      category: category as ListingCategory,
      description,
      inquiry_type: inquiryType as InquiryType,
      image_url: imageUrl,
      is_published: isPublished,
    },
  };
}

/** Creates a listing (Admin only, Requirement 11.1). */
export async function createListing(
  input: ListingInput,
): Promise<ListingWriteResult> {
  const auth = await assertRole(["ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }

  const normalized = normalizeListingInput(input);
  if (!normalized.ok) {
    return { ok: false, status: 400, error: normalized.error };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .insert(normalized.value)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, status: 500, error: "Could not create the listing." };
  }

  return { ok: true, status: 201, id: data.id };
}

/** Edits a listing's fields (Admin only, Requirement 11.2). */
export async function updateListing(
  id: string,
  input: ListingInput,
): Promise<ListingWriteResult> {
  const auth = await assertRole(["ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }
  if (!id) {
    return { ok: false, status: 400, error: "Missing listing id." };
  }

  const normalized = normalizeListingInput(input);
  if (!normalized.ok) {
    return { ok: false, status: 400, error: normalized.error };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .update(normalized.value)
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, status: 500, error: "Could not update the listing." };
  }
  if (!data || data.length === 0) {
    return { ok: false, status: 404, error: "Listing not found." };
  }

  return { ok: true, status: 200, id };
}

/** Publishes or unpublishes a listing (Admin only, Requirement 11.3). */
export async function setListingPublished(
  id: string,
  isPublished: boolean,
): Promise<ListingWriteResult> {
  const auth = await assertRole(["ADMIN"]);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.status === 401 ? "Unauthorized." : "Forbidden.",
    };
  }
  if (!id) {
    return { ok: false, status: 400, error: "Missing listing id." };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .update({ is_published: isPublished })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, status: 500, error: "Could not update the listing." };
  }
  if (!data || data.length === 0) {
    return { ok: false, status: 404, error: "Listing not found." };
  }

  return { ok: true, status: 200, id };
}
