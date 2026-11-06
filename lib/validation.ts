/**
 * validation.ts — shared input validation + sanitization helpers.
 *
 * These are the application-layer input guards used by route handlers before
 * anything is persisted. They are a correctness/UX concern: Row Level Security
 * remains the authoritative access boundary (see tech.md), while this module
 * enforces the field-level rules the design's algorithms require and strips
 * unsafe characters from free-text before it is stored (defense against stored
 * XSS when that text is later rendered in a dashboard).
 *
 * Kept deliberately dependency-free (no validation library) so the workshop
 * build stays small and teachable.
 *
 * Requirements: 4.2, 4.5 (non-empty name/details + well-formed email → else 400
 * with field errors), 4.6 (sanitize name/details before persisting), 12.6
 * (escape/sanitize user-supplied text to prevent XSS).
 */

/**
 * Trims a candidate string. Non-string inputs (e.g. a missing/`null`/array form
 * value) collapse to an empty string so downstream checks treat them as absent.
 */
export function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** True when `value`, once trimmed, contains at least one character. */
export function isNonEmpty(value: unknown): boolean {
  return normalizeString(value).length > 0;
}

/**
 * Conservative, well-formed-email check. Intentionally simple (one `@`, a
 * non-empty local part, and a dotted domain) rather than a full RFC 5322
 * grammar — it rejects the obviously invalid while staying readable. The
 * authoritative uniqueness/deliverability checks live in Supabase Auth; this is
 * only the "well-formed email" gate the inquiry algorithm calls for.
 */
export function isValidEmail(value: unknown): boolean {
  const email = normalizeString(value);
  if (email.length === 0 || email.length > 254) {
    return false;
  }
  // local@domain.tld — no spaces, exactly one @, a dot in the domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Sanitizes a free-text field before it is persisted (Requirement 4.6). We trim
 * surrounding whitespace and strip the angle-bracket characters that would
 * otherwise let stored text open an HTML/script tag when later rendered in a
 * Staff/Admin dashboard (stored-XSS defense, Requirement 12.6). This is a
 * belt-and-suspenders measure on top of React's own output escaping — the
 * stored value itself is kept inert.
 */
export function sanitizeText(value: unknown): string {
  return normalizeString(value).replace(/[<>]/g, "");
}
