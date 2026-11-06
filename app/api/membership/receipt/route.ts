/**
 * POST /api/membership/receipt — upload a membership proof-of-payment receipt.
 *
 * AUTHENTICATED endpoint (Flow 2): an authenticated User submits a GCash
 * receipt file; the Platform stores it privately and persists a membership
 * receipt with status PENDING for manual Staff/Admin review. The session check,
 * file validation, private upload, and PENDING insert all live in
 * `lib/membership.ts`; this handler only parses the multipart body and maps the
 * domain result to an HTTP response.
 *
 * Responses:
 *   - 201 { status: "PENDING" } on success
 *   - 400 for a missing/invalid file (bad content type or oversize)
 *   - 401 for an unauthenticated session
 *   - 500 for an upstream storage/DB failure (generic message)
 *
 * Requirements: 8.2, 8.7 (companion read), 8.8, 10.1, 14.2, 14.6.
 */

import { NextResponse } from "next/server";

import { submitMembershipReceipt } from "@/lib/membership";

export async function POST(request: Request) {
  let file: File | null = null;
  try {
    const formData = await request.formData();
    const value = formData.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json(
      { error: "Invalid request. Submit the receipt as multipart form data." },
      { status: 400 },
    );
  }

  const result = await submitMembershipReceipt(file);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { status: result.receiptStatus },
    { status: result.status },
  );
}
