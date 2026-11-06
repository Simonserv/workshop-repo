import Link from "next/link";

import { ErrorState } from "@/app/_components/ui";
import { DashboardGuard } from "@/app/admin/_components/DashboardGuard";
import { listPendingReceipts } from "@/lib/membership";
import { ReceiptReview } from "./ReceiptReview";

/**
 * Membership receipt review dashboard (task 9.2) — Staff/Admin.
 *
 * Lists PENDING membership receipts (oldest first) with short-lived signed view
 * URLs minted server-side, then lets a reviewer approve (transactional →
 * MEMBER) or reject with a reason. The signed URL is the only way to view a
 * receipt file (Correctness Property 3). Approve/reject enforce 409 on a
 * non-PENDING record in the data layer.
 *
 * Composes the Task 6.5 primitives/tokens with the required
 * loading/empty/error/interactive states (Requirement 15). Guarded by
 * DashboardGuard (friendly 401/403); RLS is authoritative.
 *
 * Requirements: 8.3, 8.5, 8.6, 10.2, 10.3, 10.4, 12.3, 12.5, 15.
 */

export const dynamic = "force-dynamic";

export default function ReceiptsDashboardPage() {
  return (
    <DashboardGuard allow={["STAFF", "ADMIN"]}>
      <ReceiptsContent />
    </DashboardGuard>
  );
}

async function ReceiptsContent() {
  const result = await listPendingReceipts();

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Membership receipts</h1>
        <p className="section__lead">
          Review pending receipts. Approving a receipt activates the member;
          rejecting one requires a reason.
        </p>

        {result.ok ? (
          <ReceiptReview receipts={result.receipts} />
        ) : (
          <ErrorState title="Couldn’t load receipts">
            Something went wrong loading pending receipts.{" "}
            <Link href="/admin/receipts">Try again</Link>.
          </ErrorState>
        )}
      </div>
    </section>
  );
}
