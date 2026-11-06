import { site } from "@/content/site";
import { ButtonLink } from "@/app/_components/ui";

/**
 * Landing page (home route).
 *
 * - Renders without authentication (Requirement 1.1) and is identical for
 *   anonymous and authenticated visitors (Requirement 1.3).
 * - Provides a navigation path to the catalog (Requirement 1.2).
 * - All customizable text/branding comes from the editable content file
 *   content/site.ts (Requirement 1.4).
 *
 * Composes the Task 6.5 design-system tokens + primitives (Requirement 15):
 * the hero is left-aligned and token-spaced (no oversized centered hero / badge
 * pills) and the CTA is the shared Button primitive with full interactive
 * states. This is the Session-1 scaffold; later tasks add the backend-driven
 * catalog and inquiry flows.
 */
export default function HomePage() {
  return (
    <section className="hero">
      <div className="container">
        <h1 className="hero__headline">{site.headline}</h1>
        <p className="hero__tagline">{site.tagline}</p>
        <p className="hero__intro">{site.intro}</p>
        <ButtonLink href="/catalog">{site.catalogCtaLabel}</ButtonLink>
      </div>
    </section>
  );
}
