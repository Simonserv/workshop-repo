"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Card,
  EmptyState,
  Feedback,
  StatusBadge,
} from "@/app/_components/ui";
import { RejectForm } from "@/app/admin/_components/RejectForm";
import { StatusFilterBar } from "@/app/admin/_components/StatusFilterBar";
import type { DbDonation } from "@/lib/donations";

/**
 * DonationReview — interactive donation review list (task 9.3, Requirement 15).
 *
 * A status-filter bar plus per-donation cards. PENDING donations offer verify
 * and reject actions; already-reviewed donations show their terminal status
 * only. Each card links to the server-minted signed receipt URL. On success the
 * server data refreshes so a filtered list stays accurate.
 */

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

type RowState =
  | { phase: "idle" }
  | { phase: "rejecting" }
  | { phase: "busy" }
  | { phase: "error"; message: string };

function formatAmount(amount: number): string {
  // Peso amounts (GCash). Intl keeps this locale-correct without hardcoding.
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function DonationReview({
  donations,
  statusFilter,
}: {
  donations: DbDonation[];
  statusFilter: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>({});

  function setRow(id: string, state: RowState) {
    setRows((prev) => ({ ...prev, [id]: state }));
  }

  async function act(
    id: string,
    action: "verify" | "reject",
    reason?: string,
  ) {
    if (action === "reject" && (reason ?? "").trim().length === 0) {
      setRow(id, { phase: "error", message: "Enter a reason for rejecting." });
      return;
    }
    setRow(id, { phase: "busy" });
    try {
      const res = await fetch(`/api/admin/donations/${id}/${action}`, {
        method: "POST",
        headers:
          action === "reject" ? { "Content-Type": "application/json" } : undefined,
        body: action === "reject" ? JSON.stringify({ reason }) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setRow(id, {
          phase: "error",
          message: data?.error ?? "Update failed. Please try again.",
        });
        return;
      }
      router.refresh();
    } catch {
      setRow(id, { phase: "error", message: "Update failed. Please try again." });
    }
  }

  return (
    <div className="stack-5">
      <StatusFilterBar
        basePath="/admin/donations"
        current={statusFilter}
        filters={FILTERS}
      />

      {donations.length === 0 ? (
        <EmptyState title="No donations here">
          No donations match this filter. New donations appear here as they are
          submitted.
        </EmptyState>
      ) : (
        <ul className="review-list stack-5">
          {donations.map((d) => {
            const state = rows[d.id] ?? { phase: "idle" };
            const busy = state.phase === "busy";
            const isPending = d.status === "PENDING";
            const donorLabel =
              d.donor_name || d.donor_email || "Anonymous donor";
            return (
              <li key={d.id}>
                <Card>
                  <div className="review-card">
                    <div className="stack-3">
                      <div className="review-card__head">
                        <span className="cell-strong">
                          {formatAmount(d.amount)}
                        </span>
                        <StatusBadge status={d.status} />
                      </div>
                      <div className="cell-muted">{donorLabel}</div>
                      {d.donor_email && d.donor_name ? (
                        <div className="cell-muted">{d.donor_email}</div>
                      ) : null}
                      <div className="cell-muted">
                        Submitted {new Date(d.created_at).toLocaleString()}
                      </div>
                      {d.review_note ? (
                        <div className="cell-muted">
                          Note: {d.review_note}
                        </div>
                      ) : null}
                      {d.viewUrl ? (
                        <a
                          href={d.viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--secondary btn--sm review-card__view"
                        >
                          View receipt
                        </a>
                      ) : (
                        <span className="cell-muted">
                          Receipt link unavailable — reload to retry.
                        </span>
                      )}
                    </div>

                    <div className="review-card__actions stack-3">
                      {state.phase === "error" ? (
                        <Feedback tone="error">{state.message}</Feedback>
                      ) : null}

                      {!isPending ? (
                        <span className="cell-muted">
                          This donation was already reviewed.
                        </span>
                      ) : state.phase === "rejecting" ? (
                        <RejectForm
                          disabled={busy}
                          onCancel={() => setRow(d.id, { phase: "idle" })}
                          onSubmit={(reason) => void act(d.id, "reject", reason)}
                        />
                      ) : (
                        <div className="cell-actions">
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void act(d.id, "verify")}
                          >
                            {busy ? "Working…" : "Verify"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => setRow(d.id, { phase: "rejecting" })}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
