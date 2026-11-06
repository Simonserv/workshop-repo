"use client";

import { Button, ErrorState } from "@/app/_components/ui";

/**
 * Listing detail error state (Requirement 15.8).
 *
 * Rendered when the detail Server Component throws (e.g. a failed read). Shows a
 * clear message and a recovery action (`reset()` re-runs the segment). Note a
 * denied/not-found listing is NOT an error — that is handled in the page as an
 * empty state — so this covers genuine fetch failures only. No internal
 * diagnostics are shown (Requirement 14.6).
 */
export default function ListingDetailError({ reset }: { reset: () => void }) {
  return (
    <section className="section">
      <div className="container">
        <ErrorState
          title="We couldn't load this listing"
          action={
            <Button variant="secondary" onClick={() => reset()}>
              Try again
            </Button>
          }
        >
          Something went wrong while loading the listing. Please try again in a
          moment.
        </ErrorState>
      </div>
    </section>
  );
}
