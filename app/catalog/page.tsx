import Link from "next/link";
import { listings } from "@/content/listings";

/**
 * Catalog page — Session-1 scaffolding placeholder.
 *
 * Renders the catalog content from the editable content/listings.ts file so
 * students can customize and preview it. The live, role-aware, RLS-backed
 * catalog is wired to Supabase in a later task (7.2); for now this reads the
 * static content so the navigation path from the landing page resolves.
 */
export default function CatalogPage() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Catalog</h1>
        <p className="muted">
          Placeholder catalog rendered from content/listings.ts. The live,
          database-backed catalog is added in a later session.
        </p>
        <ul
          style={{
            listStyle: "none",
            margin: "24px 0 0",
            padding: 0,
            display: "grid",
            gap: "16px",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}
        >
          {listings.map((listing) => (
            <li key={listing.slug} className="card">
              {/* Plain <img> keeps the scaffold dependency-free; later tasks
                  can switch to next/image if desired. */}
              <img
                src={listing.image_url}
                alt={listing.title}
                width={640}
                height={400}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: "8px",
                  display: "block",
                  marginBottom: "12px",
                }}
              />
              <h2 style={{ fontSize: "1.1rem", margin: "0 0 6px" }}>
                {listing.title}
              </h2>
              <p className="muted" style={{ margin: "0 0 10px" }}>
                {listing.description}
              </p>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                {listing.category} · {listing.inquiry_type}
              </p>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: "28px" }}>
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </section>
  );
}
