import Link from "next/link";
import { listings } from "@/content/listings";
import { ButtonLink, Card, EmptyState } from "@/app/_components/ui";

/**
 * Catalog page — Session-1 scaffolding placeholder.
 *
 * Renders the catalog content from the editable content/listings.ts file so
 * students can customize and preview it. The live, role-aware, RLS-backed
 * catalog is wired to Supabase in a later task (7.2); for now this reads the
 * static content so the navigation path from the landing page resolves.
 *
 * Composes the Task 6.5 design system (Requirement 15): cards are the shared
 * Card primitive in a responsive, content-sized grid (not a forced uniform
 * 3-column grid), and an explicit EMPTY STATE is shown when there are no
 * listings (Requirement 15.7). No inline/hardcoded design values remain —
 * everything draws from the tokens.
 */
export default function CatalogPage() {
  const hasListings = listings.length > 0;

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Catalog</h1>
        <p className="section__lead">
          Placeholder catalog rendered from content/listings.ts. The live,
          database-backed catalog is added in a later session.
        </p>

        {hasListings ? (
          <ul className="card-grid stack-6">
            {listings.map((listing) => (
              <Card as="li" key={listing.slug}>
                {/* Plain <img> keeps the scaffold dependency-free; later tasks
                    can switch to next/image if desired. */}
                <img
                  className="card__media"
                  src={listing.image_url}
                  alt={listing.title}
                  width={640}
                  height={400}
                />
                <h2 className="card__title">{listing.title}</h2>
                <p className="muted">{listing.description}</p>
                <p className="card__meta">
                  {listing.category} · {listing.inquiry_type}
                </p>
              </Card>
            ))}
          </ul>
        ) : (
          <div className="stack-6">
            <EmptyState
              title="No listings yet"
              action={
                <ButtonLink href="/" variant="secondary" size="sm">
                  Back to home
                </ButtonLink>
              }
            >
              Add your services in content/listings.ts and drop matching images
              into public/images/. Saved entries appear here right away.
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
