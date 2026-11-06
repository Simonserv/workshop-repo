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
