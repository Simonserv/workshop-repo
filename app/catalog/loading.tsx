import { Card, Skeleton } from "@/app/_components/ui";

/**
 * Catalog loading state (Requirement 15.6).
 *
 * Shown automatically by the App Router while the catalog Server Component
 * awaits its RLS-scoped data. Renders a skeleton grid that mirrors the real
 * card layout so the transition to loaded content is calm rather than a jump.
 * Styling is token/primitive-driven (Skeleton + Card); no hardcoded values.
 */
export default function CatalogLoading() {
  const placeholders = [0, 1, 2, 3];

  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Catalog</h1>
        <p className="section__lead">Loading listings…</p>

        <ul className="card-grid stack-6" aria-hidden="true">
          {placeholders.map((key) => (
            <Card as="li" key={key}>
              <Skeleton
                height="var(--space-8)"
                width="100%"
                radius="var(--radius-sm)"
              />
              <div className="stack-4">
                <Skeleton height="var(--space-5)" width="70%" />
              </div>
              <div className="stack-4">
                <Skeleton height="var(--space-4)" width="40%" />
              </div>
            </Card>
          ))}
        </ul>
      </div>
    </section>
  );
}
