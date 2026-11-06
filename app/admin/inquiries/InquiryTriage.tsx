"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  EmptyState,
  Feedback,
  StatusBadge,
} from "@/app/_components/ui";
import { StatusFilterBar } from "@/app/admin/_components/StatusFilterBar";
import type { DbInquiry, InquiryStatus } from "@/lib/inquiries";

/**
 * InquiryTriage — the interactive inquiry list (task 9.1, Requirement 15).
 *
 * Receives the server-fetched inquiries and renders a status-filter bar plus a
 * table. Each row lets a reviewer change status or assign the inquiry to
 * themselves; both call `PATCH /api/admin/inquiries/[id]` and then refresh the
 * server data (`router.refresh()`) so the list reflects the change.
 *
 * Required states: EMPTY (guidance when no inquiries match), ERROR (inline
 * Feedback with the action as the recovery path), INTERACTIVE (buttons/select
 * encode hover/focus/disabled; controls disable while a row request is in
 * flight). All styling is token/primitive-driven.
 */

const STATUS_OPTIONS: readonly InquiryStatus[] = ["NEW", "IN_PROGRESS", "CLOSED"];

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "CLOSED", label: "Closed" },
];

export function InquiryTriage({
  inquiries,
  statusFilter,
}: {
  inquiries: DbInquiry[];
  statusFilter: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "Update failed. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Update failed. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack-5">
      <StatusFilterBar
        basePath="/admin/inquiries"
        current={statusFilter}
        filters={FILTERS}
      />

      {error ? <Feedback tone="error">{error}</Feedback> : null}

      {inquiries.length === 0 ? (
        <EmptyState title="No inquiries here">
          No inquiries match this filter. New customer inquiries will appear
          here as they come in.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Listing</th>
                <th scope="col">Details</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inq) => {
                const busy = busyId === inq.id;
                return (
                  <tr key={inq.id}>
                    <td>
                      <div className="cell-strong">{inq.customer_name}</div>
                      <div className="cell-muted">{inq.customer_email}</div>
                      {inq.customer_phone ? (
                        <div className="cell-muted">{inq.customer_phone}</div>
                      ) : null}
                    </td>
                    <td>{inq.listing?.title ?? "—"}</td>
                    <td className="cell-details">{inq.project_details}</td>
                    <td>
                      <StatusBadge status={inq.status} />
                    </td>
                    <td>
                      <div className="cell-actions">
                        <label className="sr-only" htmlFor={`status-${inq.id}`}>
                          Set status for {inq.customer_name}
                        </label>
                        <select
                          id={`status-${inq.id}`}
                          className="field__control select-inline"
                          value={inq.status}
                          disabled={busy}
                          onChange={(e) =>
                            void patch(inq.id, { status: e.target.value })
                          }
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void patch(inq.id, { assignToSelf: true })}
                        >
                          {inq.handled_by ? "Reassign to me" : "Assign to me"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
