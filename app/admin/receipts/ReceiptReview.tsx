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
import type { DbMembershipReceipt } from "@/lib/membership";

/**
 * ReceiptReview — the interactive pending-receipt list (task 9.2, Req 15).
 *
 * Each PENDING receipt is a card with a "View receipt" link (the server-minted
 * short-lived signed URL — the only way to view the file) and approve / reject
 * actions. Approve posts to `/approve`; reject reveals a reason field and posts
 * to `/reject`. On success the server data is refreshed so the handled receipt
 * leaves the pending list.
 *
 * Required states: EMPTY (no pending receipts), ERROR (inline per-card Feedback
 * with the action as recovery — including the 409 "already reviewed" message
 * that tells the reviewer to refresh), INTERACTIVE (buttons/field states;
 * controls disable while a request is in flight).
 */

type RowState =
  | { phase: "idle" }
  | { phase: "rejecting" }
  | { phase: "busy" }
  | { phase: "error"; message: string };

export function ReceiptReview({
  receipts,
}: {
  receipts: DbMembershipReceipt[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>({});

  function setRow(id: string, state: RowState) {
    setRows((prev) => ({ ...prev, [id]: state }));
  }

  async function approve(id: string) {
    setRow(id, { phase: "busy" });
    try {
      const res = await fetch(`/api/admin/receipts/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setRow(id, {
          phase: "error",
          message: data?.error ?? "Could not approve. Please try again.",
        });
        return;
      }
      router.refresh();
    } catch {
      setRow(id, { phase: "error", message: "Could not approve. Please try again." });
    }
  }

  async function reject(id: string, reason: string) {
    if (reason.trim().length === 0) {
      setRow(id, { phase: "error", message: "Enter a reason for rejecting." });
      return;
    }
    setRow(id, { phase: "busy" });
    try {
      const res = await fetch(`/api/admin/receipts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setRow(id, {
          phase: "error",
          message: data?.error ?? "Could not reject. Please try again.",
        });
        return;
      }
      router.refresh();
    } catch {
      setRow(id, { phase: "error", message: "Could not reject. Please try again." });
    }
  }

  if (receipts.length === 0) {
    return (
      <EmptyState title="No pending receipts">
        There are no membership receipts waiting for review right now. Approved
        and rejected receipts leave this list.
      </EmptyState>
    );
  }

  return (
    <ul className="review-list stack-5">
      {receipts.map((r) => {
        const state = rows[r.id] ?? { phase: "idle" };
        const busy = state.phase === "busy";
        return (
          <li key={r.id}>
            <Card>
              <div className="review-card">
                <div className="stack-3">
                  <div className="review-card__head">
                    <span className="cell-strong">
                      {r.user?.email ?? "Unknown member"}
                    </span>
                    <StatusBadge status="PENDING" />
                  </div>
                  <div className="cell-muted">
                    Submitted {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.viewUrl ? (
                    <a
                      href={r.viewUrl}
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

                  {state.phase === "rejecting" ? (
                    <RejectForm
                      disabled={busy}
                      onCancel={() => setRow(r.id, { phase: "idle" })}
                      onSubmit={(reason) => void reject(r.id, reason)}
                    />
                  ) : (
                    <div className="cell-actions">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void approve(r.id)}
                      >
                        {busy ? "Working…" : "Approve"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => setRow(r.id, { phase: "rejecting" })}
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
  );
}
