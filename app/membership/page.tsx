import { PaymentInfoPanel } from "@/app/_components/PaymentInfoPanel";
import { MembershipForm } from "./MembershipForm";

/**
 * Membership page — pay-via-GCash + upload-receipt flow (design Flow 2).
 *
 * Layout: the GCash payment panel (fetched from
 * `/api/membership/payment-info`, which reads the editable content/payment.ts)
 * sits beside the authenticated receipt-upload form. The form reads the
 * caller's current membership status and persists an uploaded receipt as
 * PENDING for manual review.
 *
 * Composes the Task 6.5 design system (Requirement 15): both panels are built
 * from the shared primitives and token classes (no inline/hardcoded design
 * values), and the required loading / empty / error / interactive states live
 * in the two client components (PaymentInfoPanel, MembershipForm).
 *
 * Requirements: 8.1, 8.2, 8.7, 8.8, 10.1, 15.
 */
export default function MembershipPage() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Become a member</h1>
        <p className="section__lead">
          Support us and unlock member status. Pay via GCash, upload your
          receipt, and a reviewer will verify it.
        </p>

        <div className="two-col">
          <PaymentInfoPanel endpoint="/api/membership/payment-info" />
          <MembershipForm />
        </div>
      </div>
    </section>
  );
}
