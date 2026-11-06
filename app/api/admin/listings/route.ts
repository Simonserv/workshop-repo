/**
 * POST /api/admin/listings — create a listing (Admin only, task 9.4).
 *
 * Delegates to `createListing` (lib/listings.ts), which enforces the
 * `assertRole(['ADMIN'])` 403 guard and validates fields (including the
 * site-relative `/images/` image path). RLS (§4.2) independently restricts the
 * insert to ADMIN.
 *
 * Body (JSON): { title, category, description, inquiry_type, image_url,
 *                is_published }
 * Responses: 201 { id } · 400 · 401 · 403 · 500. Per-request.
 *
 * Requirements: 11.1, 11.4, 11.5.
 */

import { NextResponse } from "next/server";

import { createListing } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await createListing(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ id: result.id }, { status: result.status });
}
