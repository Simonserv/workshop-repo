import { Skeleton } from "@/app/_components/ui";

/**
 * Listing detail loading state (Requirement 15.6).
 *
 * Shown by the App Router while the detail Server Component awaits its
 * RLS-scoped read. Mirrors the detail layout (media, title, meta, body) with
 * token-driven skeletons so the loaded view settles in place.
 */
export default function ListingDetailLoading() {
  return (
    <section className="section">
      <div className="container">
        <p className="section__lead">Loading listing…</p>
        <div className="stack-4" aria-hidden="true">
          <Skeleton height="var(--space-8)" width="100%" />
          <div className="stack-4">
            <Skeleton height="var(--space-6)" width="60%" />
          </div>
          <div className="stack-4">
            <Skeleton height="var(--space-4)" width="30%" />
          </div>
          <div className="stack-4">
            <Skeleton height="var(--space-6)" width="100%" />
          </div>
        </div>
      </div>
    </section>
  );
}
