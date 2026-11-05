import Link from "next/link";

/**
 * Login page — Session-1 scaffolding placeholder.
 *
 * Gives the navigation an auth destination so the landing ↔ catalog ↔ auth
 * path resolves (Requirement 1.2). Real registration/login via Supabase Auth
 * is implemented in a later task (5); nothing here authenticates yet.
 */
export default function LoginPage() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Sign in</h1>
        <div className="card" style={{ maxWidth: "420px" }}>
          <p className="muted" style={{ marginTop: 0 }}>
            Authentication is added in a later session. You can browse the
            catalog and send inquiries without an account.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link href="/catalog">Browse the catalog →</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
