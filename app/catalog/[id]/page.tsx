
import Link from "next/link";

import { listings as localListings } from "@/content/listings";
import { getListingById } from "@/lib/listings";
import { InquiryForm } from "@/app/_components/InquiryForm";
import { EmptyState, ButtonLink } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Database listings use UUIDs. Local listings use their slugs.
  const listing = supabaseConfigured
    ? await getListingById(params.id)
    : (() => {
        const localListing = localListings.find(
          (item) => item.slug === params.id,
        );

        return localListing
          ? {
              id: localListing.slug,
              title: localListing.title,
              category: localListing.category,
              description: localListing.description,
              inquiry_type: localListing.inquiry_type,
              image_url: localListing.image_url,
              is_published: true,
            }
          : null;
      })();

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
