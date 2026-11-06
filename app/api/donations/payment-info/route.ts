/**
 * GET /api/donations/payment-info — donation GCash payment information.
 *
 * Returns the GCash QR payment details a donor scans before submitting a
 * donation. This is the `Donation.getPaymentInfo()` component in the design
 * (Flow 3) and is a PUBLIC endpoint — donations (and their payment info) never
 * require authentication (Requirements 9.1, 6.5).
 *
 * The data is read from the editable site-config content file
 * (`content/payment.ts`), NOT hardcoded here. Membership and donations share
 * the same configured GCash account, so both payment-info endpoints read the
 * single `payment` config; students customize it once (Requirements 9.1, 1.4).
 *
 * Requirements: 9.1, 6.5
 */

import { NextResponse } from "next/server";

import { payment } from "@/content/payment";

export function GET() {
  return NextResponse.json({
    label: payment.label,
    accountName: payment.accountName,
    qrImageUrl: payment.qrImageUrl,
    instructions: payment.instructions,
  });
}
