import Link from "next/link";

import { ErrorState } from "@/app/_components/ui";
import { DashboardGuard } from "@/app/admin/_components/DashboardGuard";
import { getVisibleListings } from "@/lib/listings";
import { ListingManager } from "./ListingManager";

/**
 * Admin listing management (task 9.4) — ADMIN only.
 *
 * Under an Admin session RLS returns ALL listings (published + unpublished), so
 * `getVisibleListings` is the management grid's data source. The client manager
 * creates/edits listings and toggles publish via `/api/admin/listings`; each
 * write is Admin-guarded in the data layer (403 otherwise) and RLS independently
 * restricts it to ADMIN. `image_url` is a site-relative `/images/` path — no
 * object storage for catalog images (Requirement 11.5).
 *
 * Composes the Task 6.5 primitives/tokens with the required states
 * (Requirement 15). Guarded by DashboardGuard (403 for non-Admin).
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 15.
 */

export const dynamic = "force-dynamic";

export default function ListingsDashboardPage() {
  return (
    <DashboardGuard allow={["ADMIN"]}>
      <ListingsContent />
    </DashboardGuard>
  );
}

async function ListingsContent() {
  let listings;
  try {
    listings = await getVisibleListings();
  } catch {
    return (
      <section className="section">
        <div className="container">
          <ErrorState title="Couldn’t load listings">
            Something went wrong loading the catalog.{" "}
            <Link href="/admin/listings">Try again</Link>.
          </ErrorState>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Manage listings</h1>
        <p className="section__lead">
          Create and edit catalog listings and control whether each one is
          published.
        </p>
        <ListingManager listings={listings} />
      </div>
    </section>
  );
}
