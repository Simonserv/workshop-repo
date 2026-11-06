import Link from "next/link";

import { getVisibleListings } from "@/lib/listings";
import { Card, EmptyState } from "@/app/_components/ui";

/**
 * Catalog page (task 7.2) — the public, role-aware listing grid.
 *
 * Reads listings through the role-aware server data module
 * (`getVisibleListings`), so **Row Level Security** returns the correct rows
 * per role: published only for anonymous visitors and USER, published +
 * unpublished for STAFF/ADMIN (Requirements 2.1–2.3, 2.5). The app layer does
 * not filter by role — RLS is the authoritative boundary.
 *
 * Each card renders the listing's title and its `/images/` image and links to
 * the detail page by id (Requirement 2.4). An unpublished listing (only ever
 * returned to Staff/Admin by RLS) is flagged inline — a UX hint, not a security
 * control.
 *
 * Required states (Requirement 15): the route's `loading.tsx` shows a skeleton
 * grid while this Server Component awaits data; `error.tsx` renders the error
 * state with a retry if the fetch throws; and the EMPTY STATE below handles a
 * catalog with no visible listings (Requirement 15.7). All styling is
 * token/primitive-driven — no inline design values.
 *
 * Rendered dynamically (no caching) so the result always reflects the current
 * caller's role under RLS rather than a shared cached copy.
 */
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const listings = await getVisibleListings();
  const hasListings = listings.length > 0;

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Catalog</h1>
        <p className="section__lead">
          Browse what we offer. Open a listing to see the details and send us a
          request — no account needed.
        </p>

        {hasListings ? (
          <ul className="card-grid stack-6">
            {listings.map((listing) => (
              <li key={listing.id}>
                <Card as={Link} href={`/catalog/${listing.id}`} interactive>
                  {/* Plain <img> keeps the build dependency-free; the path is a
                      site-relative /images/ URL committed under public/. */}
                  <img
                    className="card__media"
                    src={listing.image_url}
                    alt={listing.title}
                    width={640}
                    height={400}
                  />
                  <h2 className="card__title">{listing.title}</h2>
                  <p className="card__meta">
                    {listing.category} · {listing.inquiry_type}
                    {listing.is_published ? null : " · Unpublished"}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <div className="stack-6">
            <EmptyState title="No listings yet">
              There are no published listings to show right now. Once listings
              are published they appear here.
            </EmptyState>
          </div>
        )}

        <p className="stack-6">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </section>
  );
}
