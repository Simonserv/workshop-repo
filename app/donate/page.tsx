import { PaymentInfoPanel } from "@/app/_components/PaymentInfoPanel";
import { DonationForm } from "./DonationForm";

/**
 * Donate page — PUBLIC donation flow (design Flow 3), no account required.
 *
 * Layout: the GCash payment panel (fetched from
 * `/api/donations/payment-info`, which reads the editable content/payment.ts)
 * sits beside the public donation form. The form rejects a non-positive amount,
 * validates the receipt file, and persists the donation as PENDING for manual
 * verification; donors may stay anonymous by omitting both name and email.
 *
 * Composes the Task 6.5 design system (Requirement 15): both panels are built
 * from the shared primitives and token classes (no inline/hardcoded design
 * values), and the required loading / error / interactive states live in the
 * two client components (PaymentInfoPanel, DonationForm).
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.10, 10.1, 15.
 */
export default function DonatePage() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Support us with a donation</h1>
        <p className="section__lead">
          Every gift helps. Pay via GCash, enter the amount, and upload your
          receipt. You can donate anonymously — no account needed.
        </p>

        <div className="two-col">
          <PaymentInfoPanel endpoint="/api/donations/payment-info" />
          <DonationForm />
        </div>
      </div>
    </section>
  );
}
