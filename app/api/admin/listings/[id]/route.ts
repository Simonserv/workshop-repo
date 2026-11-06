/**
 * PATCH /api/admin/listings/[id] — edit or publish/unpublish a listing (9.4).
 *
 * Admin only. Two shapes:
 *   - Full edit: a body with listing fields → `updateListing`.
 *   - Publish toggle: a body of exactly `{ is_published: boolean }` → the
 *     lighter `setListingPublished`, so toggling publish does not require
 *     re-sending every field.
 *
 * Responses: 200 { id } · 400 · 401 · 403 · 404 · 500. Per-request.
 *
 * Requirements: 11.2, 11.3, 11.4, 11.5.
 */

import { NextResponse } from "next/server";

import { setListingPublished, updateListing } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Publish-only toggle: a body whose single key is `is_published`.
  const keys = Object.keys(body);
  const isPublishOnly =
    keys.length === 1 &&
    keys[0] === "is_published" &&
    typeof body.is_published === "boolean";

  const result = isPublishOnly
    ? await setListingPublished(params.id, body.is_published as boolean)
    : await updateListing(params.id, body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ id: result.id }, { status: 200 });
}
