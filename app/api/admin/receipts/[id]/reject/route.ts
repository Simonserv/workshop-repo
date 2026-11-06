/**
 * POST /api/admin/receipts/[id]/reject — reject a membership receipt (9.2).
 *
 * Delegates to `rejectReceipt` (lib/membership.ts). Rejection requires a
 * non-empty reason and does NOT grant membership; a non-PENDING receipt yields
 * 409 (review is terminal and single).
 *
 * Body (JSON): { reason: string }
 * Responses: 200 ok · 400 missing reason · 401 · 403 · 404 · 409 · 500.
 *
 * Requirements: 8.5, 8.6, 12.3, 12.5.
 */

import { NextResponse } from "next/server";

import { rejectReceipt } from "@/lib/membership";

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
  const result = await rejectReceipt(params.id, reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { status: result.receiptStatus },
    { status: result.status },
  );
}
