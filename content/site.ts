/**
 * site.ts — EDITABLE CONTENT FILE (students customize this)
 *
 * Change the site name, headline, and intro/branding copy here. The landing
 * page renders directly from these values (Requirement 1.4). Save the file and
 * refresh the browser to see your changes.
 *
 * This is one of only three files you need to edit:
 *   - content/site.ts      ← this file (branding + landing copy)
 *   - content/listings.ts  ← your catalog items
 *   - content/payment.ts   ← your GCash payment label/config
 */

export interface SiteContent {
  /** Short brand/site name shown in the navigation and page title. */
  name: string;
  /** Big headline on the landing page hero. */
  headline: string;
  /** One-line tagline shown under the headline. */
  tagline: string;
  /** Longer intro paragraph describing what the site offers. */
  intro: string;
  /** Label for the primary call-to-action button that links to the catalog. */
  catalogCtaLabel: string;
}

export const site: SiteContent = {
  name: "Acme Consulting",
  headline: "Software and consulting that fits your business",
  tagline: "Web development, custom software, and expert IT consulting.",
  intro:
    "We help teams ship the right software. Browse our catalog to see what we " +
    "offer, then send us a demo request, a quote request, or a general inquiry. " +
    "No account needed to get in touch.",
  catalogCtaLabel: "Browse the catalog",
};
