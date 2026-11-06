/**
 * PATCH /api/admin/inquiries/[id] — Staff/Admin inquiry triage update (task 9.1).
 *
 * Updates an inquiry's status and/or assigns it to the acting reviewer. The
 * Staff/Admin guard, status validation, and the self-assignment rule all live
 * in `lib/inquiries.ts`; this handler only parses the body and maps the result.
 *
 * Body (JSON): { status?: "NEW"|"IN_PROGRESS"|"CLOSED", assignToSelf?: boolean }
 *
 * Responses: 200 ok · 400 bad input · 401 unauthenticated · 403 wrong role ·
 * 500 upstream failure. Rendered per request (session from cookies).
 *
 * Requirements: 12.1, 12.2, 12.5.
 */

import { NextResponse } from "next/server";

import { updateInquiry } from "@/lib/inquiries";

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

  const result = await updateInquiry(params.id, {
    status: typeof body.status === "string" ? body.status : null,
    assignToSelf: body.assignToSelf === true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
