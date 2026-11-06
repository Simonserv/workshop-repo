/**
 * POST /api/admin/donations/[id]/verify — verify a donation → VERIFIED (9.3).
 *
 * Delegates to `verifyDonation` (lib/donations.ts). Staff/Admin only; a
 * non-PENDING donation yields 409 (review is terminal and single).
 *
 * Responses: 200 ok · 401 · 403 · 404 · 409 · 500. Per-request.
 *
 * Requirements: 9.7, 9.9, 12.4, 12.5.
 */

import { NextResponse } from "next/server";

import { verifyDonation } from "@/lib/donations";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const result = await verifyDonation(params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { status: result.donationStatus },
    { status: result.status },
  );
}
