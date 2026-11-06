/**
 * POST /api/donations — submit a donation (PUBLIC, no account required).
 *
 * PUBLIC endpoint (Flow 3): a donor submits an amount, an optional donor name
 * and/or email, and a GCash receipt file. The Platform rejects a non-positive
 * amount (400), validates the file, stores it privately, and persists the
 * donation with status PENDING for manual verification. The amount/file/donor
 * rules all live in `lib/donations.ts`; this handler only parses the multipart
 * body and maps the domain result to an HTTP response.
 *
 * Donor handling (done in the domain module):
 *   - both name and email omitted → anonymous (null/null)
 *   - exactly one provided → keep it, null the other, non-anonymous
 *
 * Responses:
 *   - 201 { status: "PENDING" } on success
 *   - 400 for amount<=0 or a missing/invalid receipt file
 *   - 500 for an upstream storage/DB failure (generic message)
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.10, 10.1, 14.6.
 */

import { NextResponse } from "next/server";

import { submitDonation } from "@/lib/donations";

export async function POST(request: Request) {
  let amount: FormDataEntryValue | null = null;
  let donorName: string | null = null;
  let donorEmail: string | null = null;
  let file: File | null = null;

  try {
    const formData = await request.formData();
    amount = formData.get("amount");
    const nameValue = formData.get("donorName");
    const emailValue = formData.get("donorEmail");
    donorName = typeof nameValue === "string" ? nameValue : null;
    donorEmail = typeof emailValue === "string" ? emailValue : null;
    const fileValue = formData.get("file");
    file = fileValue instanceof File ? fileValue : null;
  } catch {
    return NextResponse.json(
      { error: "Invalid request. Submit the donation as multipart form data." },
      { status: 400 },
    );
  }

  const result = await submitDonation({
    amount: typeof amount === "string" ? amount : null,
    donorName,
    donorEmail,
    file,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { status: result.donationStatus },
    { status: result.status },
  );
}
