/**
 * listings.ts — EDITABLE CONTENT FILE (students customize this)
 *
 * Edit the catalog items below: title, category, description, inquiry_type, and
 * the image. Drop a matching image into `public/images/` and point `image_url`
 * at it (a site-relative path under `/images/`). Save and view the catalog.
 *
 * NOTE: This file is the customizable catalog *content*. Once the Supabase
 * backend is connected in a later session, the live catalog is served from the
 * database via Row Level Security. These entries double as the seed data and as
 * the content students edit — they mirror the `listings` table shape.
 *
 * Fields:
 *   - category:     CONSULTING | WEB_DEV | CUSTOM_SOFTWARE
 *   - inquiry_type: DEMO | QUOTE | INQUIRE  (decides which inquiry form shows)
 *   - image_url:    a path under /images/ referencing a file in public/images/
 */

export type ListingCategory = "CONSULTING" | "WEB_DEV" | "CUSTOM_SOFTWARE";

export type InquiryType = "DEMO" | "QUOTE" | "INQUIRE";

export interface Listing {
  /** Stable slug used in the detail page URL. */
  slug: string;
  title: string;
  category: ListingCategory;
  description: string;
  inquiry_type: InquiryType;
  /** Site-relative path under /images/ (file must exist in public/images/). */
  image_url: string;
}

export const listings: Listing[] = [
  {
    slug: "it-strategy-consulting",
    title: "IT Strategy Consulting",
    category: "CONSULTING",
    description:
      "Work with our consultants to map your technology roadmap, assess risk, " +
      "and plan the systems your business needs over the next 12 months.",
    inquiry_type: "INQUIRE",
    image_url: "/images/placeholder-consulting.svg",
  },
  {
    slug: "business-website-build",
    title: "Business Website Build",
    category: "WEB_DEV",
    description:
      "A fast, modern marketing website with a content system you can update " +
      "yourself. Request a quote and we will scope it with you.",
    inquiry_type: "QUOTE",
    image_url: "/images/placeholder-web-dev.svg",
  },
  {
    slug: "inventory-management-app",
    title: "Custom Inventory Management App",
    category: "CUSTOM_SOFTWARE",
    description:
      "A tailored inventory and ordering application built around your workflow. " +
      "Book a live demo to see a working example.",
    inquiry_type: "DEMO",
    image_url: "/images/placeholder-custom-software.svg",
  },
];
