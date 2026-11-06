import Link from "next/link";
import { Card } from "@/app/_components/ui";

/**
 * Login page — Session-1 scaffolding placeholder.
 *
 * Gives the navigation an auth destination so the landing ↔ catalog ↔ auth
 * path resolves (Requirement 1.2). Real registration/login via Supabase Auth
 * is implemented in a later task (5); nothing here authenticates yet.
 *
 * Composes the Task 6.5 design system (Requirement 15): the panel is the shared
 * Card primitive and widths/spacing come from tokens — no inline styles. The
 * live sign-in form (task 7) will use the Field/FormRow/Feedback primitives for
 * labels, inline validation, and recovery feedback.
 */
export default function LoginPage() {
  return (
    <section className="section">
      <div className="container">
        <h1 className="section__title">Sign in</h1>
        <Card className="panel-narrow">
          <p className="muted panel-copy">
            Authentication is added in a later session. You can browse the
            catalog and send inquiries without an account.
          </p>
          <p className="panel-copy">
            <Link href="/catalog">Browse the catalog →</Link>
          </p>
        </Card>
      </div>
    </section>
  );
}
