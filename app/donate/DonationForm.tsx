"use client";

import { useState } from "react";

import {
  Button,
  Card,
  Feedback,
  Field,
  FormRow,
  StatusBadge,
} from "@/app/_components/ui";

/**
 * DonationForm — the PUBLIC donation submission form (design Flow 3).
 *
 * No account required. Collects an amount (required, must be > 0), an optional
 * donor name and/or email (omit both to donate anonymously), and a GCash
 * receipt file. Submits to `POST /api/donations` as multipart form data.
 *
 * Composes the Task 6.5 primitives and implements every required state
 * (Requirement 15):
 *   - ERROR: field-level validation for the amount (client-side guard mirrors
 *     the server's amount>0 rule, 9.2/9.3) and inline Feedback for a failed
 *     submit, with the form staying editable as the recovery action (15.8).
 *   - LOADING: the submit button shows an in-flight label and is disabled.
 *   - SUCCESS: a Feedback confirming the PENDING donation.
 *   - INTERACTIVE: Field/Button encode hover/focus/active/disabled states.
 *
 * No design values are hardcoded — styling is tokens/primitives only.
 */

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success" }
  | { phase: "error"; message: string };

export function DonationForm() {
  const [submit, setSubmit] = useState<SubmitState>({ phase: "idle" });
  const [amountError, setAmountError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    // Client-side field validation mirrors the server rule so the user gets
    // immediate field-level feedback (Requirement 15.8); the server stays the
    // authority (Requirements 9.2, 9.3).
    const rawAmount = formData.get("amount");
    const amount = typeof rawAmount === "string" ? Number(rawAmount) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      setAmountError("Enter an amount greater than zero.");
      return;
    }
    setAmountError(null);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setSubmit({ phase: "error", message: "Choose a receipt file to upload." });
      return;
    }

    setSubmit({ phase: "submitting" });
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        body: formData,
      });
      if (res.status === 201) {
        form.reset();
        setSubmit({ phase: "success" });
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setSubmit({
        phase: "error",
        message: data?.error ?? "Could not record your donation. Please try again.",
      });
    } catch {
      setSubmit({
        phase: "error",
        message: "Could not record your donation. Please try again.",
      });
    }
  }

  const submitting = submit.phase === "submitting";
  return (
    <Card>
      <form className="stack-5" onSubmit={handleSubmit} noValidate>
        <div className="stack-3">
          <h2 className="card__title">Make a donation</h2>
          <p className="muted">
            Pay via the GCash QR, then tell us the amount and upload your
            receipt. Leave your name and email blank to donate anonymously.
          </p>
        </div>

        <FormRow
          actions={
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit donation"}
            </Button>
          }
        >
          <Field
            id="donation-amount"
            label="Amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            required
            error={amountError}
            hint="Enter the amount you paid via GCash."
            disabled={submitting}
          />
          <Field
            id="donor-name"
            label="Name (optional)"
            name="donorName"
            type="text"
            autoComplete="name"
            hint="Leave blank to stay anonymous."
            disabled={submitting}
          />
          <Field
            id="donor-email"
            label="Email (optional)"
            name="donorEmail"
            type="email"
            autoComplete="email"
            disabled={submitting}
          />
          <div className="field">
            <label className="field__label" htmlFor="donation-file">
              Receipt file
              <span className="field__required" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="donation-file"
              className="field__control"
              type="file"
              name="file"
              accept="image/*,application/pdf"
              required
              disabled={submitting}
            />
            <span className="field__hint" id="donation-file-hint">
              Accepted: images or PDF, up to 10 MB.
            </span>
          </div>
        </FormRow>

        {submit.phase === "success" ? (
          <Feedback tone="success">
            Thank you! Your donation was recorded. Status:{" "}
            <StatusBadge status="PENDING" /> — we&apos;ll verify it shortly.
          </Feedback>
        ) : null}
        {submit.phase === "error" ? (
          <Feedback tone="error">{submit.message}</Feedback>
        ) : null}
      </form>
    </Card>
  );
}
