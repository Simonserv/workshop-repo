/**
 * POST /api/admin/receipts/[id]/approve — approve a membership receipt (9.2).
 *
 * Delegates to `approveReceipt` (lib/membership.ts), which runs the
 * transactional `approve_receipt()` Postgres function: receipt → APPROVED and
 * the owning user → MEMBER, atomically (Correctness Property 1). The Staff/Admin
 * guard, 404 (absent), and 409 (already reviewed) are enforced there.
 *
 * Responses: 200 ok · 401 · 403 · 404 · 409 · 500. Per-request (session).
 *
 * Requirements: 8.3, 8.6, 12.3, 12.5.
 */

import { NextResponse } from "next/server";

import { approveReceipt } from "@/lib/membership";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const result = await approveReceipt(params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { status: result.receiptStatus },
    { status: result.status },
  );
}
