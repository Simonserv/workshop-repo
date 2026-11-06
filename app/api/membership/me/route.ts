/**
 * GET /api/membership/me — the caller's own membership status (`getMyMembership`).
 *
 * AUTHENTICATED endpoint: returns the current `membership_status`
 * (MEMBER/NON_MEMBER) of the signed-in caller, read from their own `profiles`
 * row through the role-aware client so RLS scopes it to the owner. The
 * membership screen uses this to tell a user whether they are already a member.
 *
 * Responses:
 *   - 200 { membershipStatus } on success
 *   - 401 for an unauthenticated session
 *   - 500 for an upstream failure (generic message)
 *
 * Requirements: 8.7, 14.2, 14.6.
 */

import { NextResponse } from "next/server";

import { getMyMembership } from "@/lib/membership";

/**
 * This route resolves the caller's session from request cookies, so it must be
 * rendered per request — never statically prerendered at build time (where no
 * session or env exists).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getMyMembership();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { membershipStatus: result.membershipStatus },
    { status: result.status },
  );
}
