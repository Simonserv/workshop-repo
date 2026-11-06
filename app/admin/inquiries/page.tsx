import Link from "next/link";

import { ErrorState } from "@/app/_components/ui";
import { DashboardGuard } from "@/app/admin/_components/DashboardGuard";
import { listInquiries } from "@/lib/inquiries";
import { InquiryTriage } from "./InquiryTriage";

/**
 * Inquiry triage dashboard (task 9.1) — Staff/Admin.
 *
 * Lists inquiries (optionally status-filtered via the `?status=` query) through
 * the role-aware data module, so RLS returns them only to Staff/Admin. The
 * interactive table (status change + assign-to-me) lives in the client
 * component `InquiryTriage`. Composes the Task 6.5 primitives/tokens and the
 * required loading/empty/error/interactive states (Requirement 15); record
 * statuses render via StatusBadge. User-supplied text is escaped by React on
 * render and was sanitized on insert (Requirement 12.6).
 *
 * Guarded by `assertRole(['STAFF','ADMIN'])` via DashboardGuard (friendly
 * 401/403); RLS is the authoritative boundary.
 *
 * Requirements: 12.1, 12.2, 12.5, 12.6, 15.
 */

export const dynamic = "force-dynamic";

export default async function InquiriesDashboardPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status ?? "ALL";

  return (
    <DashboardGuard allow={["STAFF", "ADMIN"]}>
      <InquiriesContent statusFilter={statusFilter} />
    </DashboardGuard>
  );
}

async function InquiriesContent({ statusFilter }: { statusFilter: string }) {
  const result = await listInquiries(
    statusFilter === "ALL" ? null : statusFilter,
  );

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Inquiries</h1>
        <p className="section__lead">
          Triage customer inquiries: set a status and assign one to yourself.
        </p>

        {result.ok ? (
          <InquiryTriage
            inquiries={result.inquiries}
            statusFilter={statusFilter}
          />
        ) : (
          <ErrorState title="Couldn’t load inquiries">
            Something went wrong loading the inquiry list.{" "}
            <Link href="/admin/inquiries">Try again</Link>.
          </ErrorState>
        )}
      </div>
    </section>
  );
}
