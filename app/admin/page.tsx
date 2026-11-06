import { Card } from "@/app/_components/ui";
import { DashboardGuard } from "@/app/admin/_components/DashboardGuard";
import { getRoleFromSession } from "@/lib/auth";

/**
 * Admin/Staff dashboard home (task 9) — the hub linking the review and
 * management dashboards.
 *
 * Staff and Admin both see the review dashboards (inquiries, receipts,
 * donations). The management dashboards (listings, users) are Admin-only and
 * are shown only for an ADMIN session — a UX affordance on top of the
 * per-page `assertRole(['ADMIN'])` guard and RLS (which remain authoritative).
 *
 * Guarded by DashboardGuard (Staff/Admin); composes Task 6.5 primitives.
 */

export const dynamic = "force-dynamic";

export default function AdminHomePage() {
  return (
    <DashboardGuard allow={["STAFF", "ADMIN"]}>
      <AdminHomeContent />
    </DashboardGuard>
  );
}

async function AdminHomeContent() {
  const resolution = await getRoleFromSession();
  const isAdmin = resolution.authenticated && resolution.role === "ADMIN";

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Dashboards</h1>
        <p className="section__lead">
          Review customer activity and (for admins) manage the catalog and
          member roles.
        </p>

        <ul className="card-grid stack-6">
          <li>
            <Card as="a" href="/admin/inquiries" interactive>
              <h2 className="card__title">Inquiries</h2>
              <p className="card__meta">Triage and assign customer inquiries.</p>
            </Card>
          </li>
          <li>
            <Card as="a" href="/admin/receipts" interactive>
              <h2 className="card__title">Membership receipts</h2>
              <p className="card__meta">Approve or reject pending receipts.</p>
            </Card>
          </li>
          <li>
            <Card as="a" href="/admin/donations" interactive>
              <h2 className="card__title">Donations</h2>
              <p className="card__meta">Verify or reject donations.</p>
            </Card>
          </li>
          {isAdmin ? (
            <>
              <li>
                <Card as="a" href="/admin/listings" interactive>
                  <h2 className="card__title">Manage listings</h2>
                  <p className="card__meta">Create, edit, and publish listings.</p>
                </Card>
              </li>
              <li>
                <Card as="a" href="/admin/users" interactive>
                  <h2 className="card__title">Members &amp; roles</h2>
                  <p className="card__meta">Assign Staff/Admin/User roles.</p>
                </Card>
              </li>
            </>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
