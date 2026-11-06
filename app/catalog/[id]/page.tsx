import Link from "next/link";

import { getListingById } from "@/lib/listings";
import { InquiryForm } from "@/app/_components/InquiryForm";
import { EmptyState, ButtonLink } from "@/app/_components/ui";

/**
 * Listing detail page (task 7.3) — one listing + its matching inquiry form.
 *
 * Reads the listing through the role-aware server module (`getListingById`), so
 * **Row Level Security governs unpublished visibility**: an anonymous visitor
 * or USER requesting an unpublished listing gets no row and sees the
 * not-found / denied state below; Staff/Admin can view unpublished listings
 * (Requirements 3.1–3.3). We do not distinguish "doesn't exist" from "not
 * allowed" in the UI, so nothing leaks about hidden rows.
 *
 * When a listing is visible it renders the title, description, and `/images/`
 * image (Requirement 3.4) and presents the inquiry form that corresponds to
 * the listing's `inquiry_type` — DEMO / QUOTE / INQUIRE (Requirement 3.5).
 *
 * Required states (Requirement 15): the route's `loading.tsx` covers the fetch;
 * `error.tsx` covers a failed read; the denied/not-found EMPTY STATE is handled
 * here; and the inquiry form owns its own field-level error and success states.
 *
 * Rendered dynamically so visibility always reflects the current caller's role.
 */
export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const listing = await getListingById(params.id);

  if (!listing) {
    return (
      <section className="section">
        <div className="container">
          <EmptyState
            title="Listing not available"
            action={
              <ButtonLink href="/catalog" variant="secondary" size="sm">
                Back to catalog
              </ButtonLink>
            }
          >
            This listing doesn't exist or isn't available to view. Browse the
            catalog to see what's published.
          </EmptyState>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <p className="section__lead">
          <Link href="/catalog">← Back to catalog</Link>
        </p>

        <article className="stack-4">
          <img
            className="card__media"
            src={listing.image_url}
            alt={listing.title}
            width={960}
            height={600}
          />
          <h1 className="section__title">{listing.title}</h1>
          <p className="card__meta">
            {listing.category}
            {listing.is_published ? null : " · Unpublished"}
          </p>
          <p>{listing.description}</p>
        </article>

        <div className="stack-6">
          <InquiryForm
            listingId={listing.id}
            inquiryType={listing.inquiry_type}
          />
        </div>
      </div>
    </section>
  );
}
