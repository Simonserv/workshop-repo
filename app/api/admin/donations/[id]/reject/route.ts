/**
 * POST /api/admin/donations/[id]/reject — reject a donation → REJECTED (9.3).
 *
 * Delegates to `rejectDonation` (lib/donations.ts). Requires a non-empty
 * reason; a non-PENDING donation yields 409.
 *
 * Body (JSON): { reason: string }
 * Responses: 200 ok · 400 missing reason · 401 · 403 · 404 · 409 · 500.
 *
 * Requirements: 9.8, 9.9, 12.4, 12.5.
 */

import { NextResponse } from "next/server";

import { rejectDonation } from "@/lib/donations";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason : "";
  const result = await rejectDonation(params.id, reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { status: result.donationStatus },
    { status: result.status },
  );
}
