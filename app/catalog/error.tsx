"use client";

import { Button, ErrorState } from "@/app/_components/ui";

/**
 * Catalog error state (Requirement 15.8).
 *
 * The App Router renders this when the catalog Server Component throws (e.g. a
 * failed RLS-scoped read). It shows a clear message and a recovery action —
 * `reset()` re-runs the segment so the fetch is retried. The underlying error
 * is not shown to the visitor (no internal diagnostics leak, Requirement 14.6).
 */
export default function CatalogError({ reset }: { reset: () => void }) {
  return (
    <section className="section">
      <div className="container">
        <ErrorState
          title="We couldn't load the catalog"
          action={
            <Button variant="secondary" onClick={() => reset()}>
              Try again
            </Button>
          }
        >
          Something went wrong while loading the listings. Please try again in a
          moment.
        </ErrorState>
      </div>
    </section>
  );
}
