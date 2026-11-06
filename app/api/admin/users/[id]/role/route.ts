/**
 * PATCH /api/admin/users/[id]/role — assign/change a member's role (9.5).
 *
 * Delegates to `assignRole` (lib/admin-users.ts). The acting caller must be
 * ADMIN (`assertRole`), after which the write runs through the SERVICE-ROLE
 * client — the privileged path the design designates for role assignment, kept
 * server-only.
 *
 * Body (JSON): { role: "ADMIN"|"STAFF"|"USER" }
 * Responses: 200 { role } · 400 · 401 · 403 · 404 · 500. Per-request.
 *
 * Requirements: 13.1, 13.2, 13.3, 14.1, 14.4.
 */

import { NextResponse } from "next/server";

import { assignRole } from "@/lib/admin-users";

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

  const role = typeof body.role === "string" ? body.role : "";
  const result = await assignRole(params.id, role);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ role: result.role }, { status: 200 });
}
