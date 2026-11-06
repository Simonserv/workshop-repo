import Link from "next/link";

import { ErrorState } from "@/app/_components/ui";
import { DashboardGuard } from "@/app/admin/_components/DashboardGuard";
import { listDonations } from "@/lib/donations";
import { DonationReview } from "./DonationReview";

/**
 * Donation review dashboard (task 9.3) — Staff/Admin.
 *
 * Lists donations (optionally status-filtered via `?status=`) with short-lived
 * signed receipt view URLs, and lets a reviewer verify (→ VERIFIED) or reject
 * with a reason. A non-PENDING donation yields 409 in the data layer (review is
 * terminal and single). Composes the Task 6.5 primitives/tokens with the
 * required states (Requirement 15). Guarded by DashboardGuard; RLS is
 * authoritative.
 *
 * Requirements: 9.7, 9.8, 9.9, 12.4, 12.5, 15.
 */

export const dynamic = "force-dynamic";

export default function DonationsDashboardPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "ALL";
  return (
    <DashboardGuard allow={["STAFF", "ADMIN"]}>
      <DonationsContent statusFilter={statusFilter} />
    </DashboardGuard>
  );
}

async function DonationsContent({ statusFilter }: { statusFilter: string }) {
  const result = await listDonations(
    statusFilter === "ALL" ? null : statusFilter,
  );

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Donations</h1>
        <p className="section__lead">
          Review donations and their receipts. Verify a genuine payment or
          reject one with a reason.
        </p>

        {result.ok ? (
          <DonationReview
            donations={result.donations}
            statusFilter={statusFilter}
          />
        ) : (
          <ErrorState title="Couldn’t load donations">
            Something went wrong loading the donation list.{" "}
            <Link href="/admin/donations">Try again</Link>.
          </ErrorState>
        )}
      </div>
    </section>
  );
}
