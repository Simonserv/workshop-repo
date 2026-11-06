"use client";

import { useId, useState } from "react";

import { Button, TextAreaField } from "@/app/_components/ui";

/**
 * RejectForm — shared inline "reason for rejection" form used by the receipt
 * and donation review dashboards (tasks 9.2, 9.3).
 *
 * A rejection requires a non-empty reason (Requirements 8.5, 9.8); the submit
 * button stays usable but the server (and the caller's `onSubmit`) enforce the
 * non-empty rule. All controls disable while the parent request is in flight.
 */
export function RejectForm({
  disabled,
  onCancel,
  onSubmit,
}: {
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const fieldId = useId();
  return (
    <form
      className="stack-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(reason);
      }}
    >
      <TextAreaField
        id={`reject-reason-${fieldId}`}
        label="Reason for rejection"
        required
        rows={3}
        value={reason}
        disabled={disabled}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="cell-actions">
        <Button type="submit" size="sm" disabled={disabled}>
          {disabled ? "Working…" : "Confirm rejection"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
