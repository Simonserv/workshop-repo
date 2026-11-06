/**
 * GET /api/admin/receipts/[id]/view-url — mint a short-lived signed URL (9.2).
 *
 * Implements the design's `getReceiptViewUrl`: Staff/Admin only, returns a
 * ~300s signed URL for the receipt file (the ONLY way to view it — no public
 * URL ever exists). Used to refresh an expired link without reloading the list.
 *
 * Responses: 200 { url } · 401 · 403 · 404 · 500. Per-request.
 *
 * Requirements: 10.2, 10.3, 10.4, 12.3, 12.5.
 */

import { NextResponse } from "next/server";

import { getReceiptViewUrl } from "@/lib/membership";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const result = await getReceiptViewUrl(params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url }, { status: 200 });
}
