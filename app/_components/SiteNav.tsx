import Link from "next/link";
import { site } from "@/content/site";

/**
 * SiteNav — shared navigation rendered on every page via the root layout.
 *
 * Provides the navigation path between the landing page, the public catalog,
 * and the auth (login) area (Requirements 1.2). The brand name comes from the
 * editable content file (Requirement 1.4).
 */
export default function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="site-nav__inner">
        <Link href="/" className="site-nav__brand">
          {site.name}
        </Link>
        <ul className="site-nav__links">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/catalog">Catalog</Link>
          </li>
          <li>
            <Link href="/admin">Dashboards</Link>
          </li>
          <li>
            <Link href="/login">Sign in</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
