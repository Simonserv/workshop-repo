/**
 * payment.ts — EDITABLE CONTENT FILE (students customize this)
 *
 * Configure the GCash QR payment details shown on the membership and donation
 * screens. In a later session you will save your own GCash QR image as
 * `public/images/gcash-qr.png` and set the label and account name here.
 *
 * This is one of only three files you need to edit:
 *   - content/site.ts      ← branding + landing copy
 *   - content/listings.ts  ← your catalog items
 *   - content/payment.ts   ← this file (GCash payment label/config)
 */

export interface PaymentConfig {
  /** Display label shown above the QR, e.g. "Scan to pay via GCash". */
  label: string;
  /** Account/business name shown next to the QR. */
  accountName: string;
  /** Site-relative path to the GCash QR image under /images/. */
  qrImageUrl: string;
  /** Short instructions shown to the payer. */
  instructions: string;
}

export const payment: PaymentConfig = {
  label: "Scan to pay via GCash",
  accountName: "Acme Consulting",
  qrImageUrl: "/images/gcash-qr.png",
  instructions:
    "Scan the QR with your GCash app, pay the amount, then upload your receipt " +
    "so we can verify it.",
};
