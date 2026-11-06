/**
 * StatusBadge — maps a record status to a token-driven color (Requirement 15.4).
 *
 * Covers every status across the domain models (structure.md): membership
 * receipts (PENDING/APPROVED/REJECTED), inquiries (NEW/IN_PROGRESS/CLOSED),
 * and donations (PENDING/VERIFIED/REJECTED). Colors come from the status tokens
 * in theme.css so dark/light parity holds and nothing is hardcoded
 * (Requirements 15.1, 15.2). Used by the Staff/Admin dashboards (tasks 9.x).
 */

export type RecordStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "NEW"
  | "IN_PROGRESS"
  | "CLOSED"
  | "VERIFIED";

const LABELS: Record<RecordStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  NEW: "New",
  IN_PROGRESS: "In progress",
  CLOSED: "Closed",
  VERIFIED: "Verified",
};

export function StatusBadge({ status }: { status: RecordStatus }) {
  // Class suffix matches the lowercase token name (e.g. badge--in_progress).
  const modifier = status.toLowerCase();
  return <span className={`badge badge--${modifier}`}>{LABELS[status]}</span>;
}
