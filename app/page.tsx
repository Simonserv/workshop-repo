import Link from "next/link";
import { site } from "@/content/site";

/**
 * Landing page (home route).
 *
 * - Renders without authentication (Requirement 1.1) and is identical for
 *   anonymous and authenticated visitors (Requirement 1.3).
 * - Provides a navigation path to the catalog (Requirement 1.2).
 * - All customizable text/branding comes from the editable content file
 *   content/site.ts (Requirement 1.4).
 *
 * This is the Session-1 scaffolding placeholder. Later tasks add the live,
 * backend-driven catalog and inquiry flows.
 */
export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1 className="hero__headline">{site.headline}</h1>
          <p className="hero__tagline">{site.tagline}</p>
          <p className="hero__intro">{site.intro}</p>
          <Link href="/catalog" className="btn">
            {site.catalogCtaLabel}
          </Link>
        </div>
      </section>
    </>
  );
}
