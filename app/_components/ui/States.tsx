import type { ReactNode } from "react";

/**
 * Shared required-state building blocks (Requirement 15.6, 15.7, 15.8).
 *
 * Later screens (tasks 7/8/9) reuse these so every data-driven screen handles
 * loading, empty, and error conditions consistently rather than reinventing
 * them. All styling is token-driven (ui.css).
 */

/* ---- Loading (spinner) ---- */
export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}…</span>
    </span>
  );
}

/* ---- Loading (skeleton block) ---- */
export function Skeleton({
  height = "var(--space-6)",
  width = "100%",
  radius = "var(--radius-sm)",
}: {
  height?: string;
  width?: string;
  radius?: string;
}) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{ display: "block", height, width, borderRadius: radius }}
    />
  );
}

/* ---- Empty state (guidance / CTA) ---- */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <h2 className="empty-state__title">{title}</h2>
      {children ? <p className="empty-state__body">{children}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

/* ---- Error state (message + recovery action) ---- */
export function ErrorState({
  title = "Something went wrong",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="error-state" role="alert">
      <h2 className="error-state__title">{title}</h2>
      {children ? <p className="error-state__body">{children}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
