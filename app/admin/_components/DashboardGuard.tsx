import type { ReactNode } from "react";

import { ButtonLink, EmptyState, ErrorState } from "@/app/_components/ui";
import { getRoleFromSession, type Role } from "@/lib/auth";

/**
 * DashboardGuard — server-side role gate shared by every Staff/Admin dashboard.
 *
 * Resolves the caller's role from the verified session and renders `children`
 * only when the role is in `allow`. Otherwise it shows the friendly 401/403 UX
 * (sign-in prompt vs. forbidden) — the application-layer surface of Requirement
 * 14.1/14.2. This is UX only: RLS remains the AUTHORITATIVE boundary, so the
 * underlying dashboard queries would return nothing to a wrong-role caller even
 * if this gate were bypassed.
 *
 * Because it awaits the session, a page using it must render per request
 * (`export const dynamic = "force-dynamic"`).
 */
export async function DashboardGuard({
  allow,
  children,
}: {
  allow: readonly Role[];
  children: ReactNode;
}) {
  const resolution = await getRoleFromSession();

  if (!resolution.authenticated) {
    // 401 UX: an unauthenticated caller is guided to sign in (recovery path).
    return (
      <section className="section">
        <div className="container">
          <EmptyState
            title="Sign in to continue"
            action={<ButtonLink href="/login">Sign in</ButtonLink>}
          >
            This dashboard is for signed-in Staff and Admin accounts. Sign in
            with an authorized account to continue.
          </EmptyState>
        </div>
      </section>
    );
  }

  if (!allow.includes(resolution.role)) {
    // 403 UX: a valid session without the required role. RLS also denies.
    return (
      <section className="section">
        <div className="container">
          <ErrorState title="You don’t have access to this page">
            Your account role ({resolution.role}) can’t view this dashboard. If
            you believe this is a mistake, ask an Admin to adjust your role.
          </ErrorState>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
