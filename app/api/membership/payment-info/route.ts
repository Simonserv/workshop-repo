/**
 * GET /api/membership/payment-info — membership GCash payment information.
 *
 * Returns the GCash QR payment details a User scans before uploading their
 * membership receipt. This is the `Membership.getPaymentInfo()` component in the
 * design (Flow 2) and is a PUBLIC endpoint — no authentication is required
 * (Requirement 6.5 classifies payment info reads as public).
 *
 * The data is read from the editable site-config content file
 * (`content/payment.ts`), NOT hardcoded here: students customize the label,
 * account name, QR image path, and instructions there, and set their own GCash
 * QR image at `public/images/gcash-qr.png` (Requirements 8.1, 1.4).
 *
 * Requirements: 8.1, 6.5
 */

import { NextResponse } from "next/server";

import { payment } from "@/content/payment";

export function GET() {
  // Return the GCash QR info from site config as-is. The `qrImageUrl` is a
  // site-relative path under /images/ to a static file in public/ — not an
  // object-storage URL.
  return NextResponse.json({
    label: payment.label,
    accountName: payment.accountName,
    qrImageUrl: payment.qrImageUrl,
    instructions: payment.instructions,
  });
}
