import Link from "next/link";

import { ErrorState } from "@/app/_components/ui";
import { DashboardGuard } from "@/app/admin/_components/DashboardGuard";
import { listMembers } from "@/lib/admin-users";
import { UserManager } from "./UserManager";

/**
 * Admin user management (task 9.5) — ADMIN only.
 *
 * Lists member profiles (read via the role-aware client, RLS §4.6: ADMIN reads
 * all) and lets an Admin assign/change a member's role. Role assignment posts
 * to `/api/admin/users/[id]/role`, which — after the Admin gate — performs the
 * write with the server-only SERVICE-ROLE client (the privileged path the
 * design designates for role assignment). Composes the Task 6.5
 * primitives/tokens with the required states (Requirement 15). Guarded by
 * DashboardGuard (403 for non-Admin).
 *
 * Requirements: 13.1, 13.2, 13.3, 14.1, 14.4, 15.
 */

export const dynamic = "force-dynamic";

export default function UsersDashboardPage() {
  return (
    <DashboardGuard allow={["ADMIN"]}>
      <UsersContent />
    </DashboardGuard>
  );
}

async function UsersContent() {
  const result = await listMembers();

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Members &amp; roles</h1>
        <p className="section__lead">
          Assign roles to members. Changing a role takes effect immediately for
          that member’s next request.
        </p>

        {result.ok ? (
          <UserManager members={result.members} />
        ) : (
          <ErrorState title="Couldn’t load members">
            Something went wrong loading the member list.{" "}
            <Link href="/admin/users">Try again</Link>.
          </ErrorState>
        )}
      </div>
    </section>
  );
}
