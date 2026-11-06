"use client";

import { useEffect, useRef, useState } from "react";

import {
  Button,
  ButtonLink,
  Card,
  Feedback,
  FormRow,
  Spinner,
  StatusBadge,
} from "@/app/_components/ui";

/**
 * MembershipForm — the authenticated membership receipt upload + status panel.
 *
 * Composes the Task 6.5 primitives and implements every required state
 * (Requirement 15):
 *   - LOADING: a spinner while the current membership status loads.
 *   - EMPTY/guidance: when not yet a member, the upload form invites a receipt.
 *   - ERROR: field-level/inline error feedback with a recovery action (the form
 *     stays editable so the user can retry) and a 401 path that guides the user
 *     to sign in.
 *   - INTERACTIVE: the shared Button/Field encode hover/focus/active/disabled;
 *     the submit button is disabled while a request is in flight.
 *
 * Membership status comes from `GET /api/membership/me`; the receipt is sent to
 * `POST /api/membership/receipt` as multipart form data. No design values are
 * hardcoded — styling is tokens/primitives only.
 */

type MembershipStatus = "MEMBER" | "NON_MEMBER";

type StatusState =
  | { phase: "loading" }
  | { phase: "unauthenticated" }
  | { phase: "error" }
  | { phase: "ready"; membershipStatus: MembershipStatus };

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success" }
  | { phase: "error"; message: string };

export function MembershipForm() {
  const [status, setStatus] = useState<StatusState>({ phase: "loading" });
  const [submit, setSubmit] = useState<SubmitState>({ phase: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  async function loadStatus() {
    setStatus({ phase: "loading" });
    try {
      const res = await fetch("/api/membership/me");
      if (res.status === 401) {
        setStatus({ phase: "unauthenticated" });
        return;
      }
      if (!res.ok) {
        throw new Error("request failed");
      }
      const data = (await res.json()) as { membershipStatus: MembershipStatus };
      setStatus({ phase: "ready", membershipStatus: data.membershipStatus });
    } catch {
      setStatus({ phase: "error" });
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setSubmit({ phase: "error", message: "Choose a receipt file to upload." });
      return;
    }

    setSubmit({ phase: "submitting" });
    try {
      const res = await fetch("/api/membership/receipt", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        form.reset();
        setSubmit({ phase: "success" });
        // Refresh the status so the panel reflects the new PENDING receipt.
        void loadStatus();
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      const message =
        res.status === 401
          ? "Please sign in to upload a membership receipt."
          : data?.error ?? "Upload failed. Please try again.";
      setSubmit({ phase: "error", message });
    } catch {
      setSubmit({ phase: "error", message: "Upload failed. Please try again." });
    }
  }

  // ---- Loading (Requirement 15.6) ----
  if (status.phase === "loading") {
    return (
      <Card>
        <Spinner label="Loading your membership status" />
      </Card>
    );
  }

  // ---- Unauthenticated: guide to sign in (recovery path) ----
  if (status.phase === "unauthenticated") {
    return (
      <Card>
        <div className="stack-3">
          <h2 className="card__title">Sign in to request membership</h2>
          <p className="muted">
            Uploading a membership receipt needs an account so we can link the
            receipt to you. Sign in, then come back to upload your GCash
            receipt.
          </p>
          <div>
            <ButtonLink href="/login">Sign in</ButtonLink>
          </div>
        </div>
      </Card>
    );
  }

  // ---- Error loading status: recovery action (Requirement 15.8) ----
  if (status.phase === "error") {
    return (
      <Card>
        <div className="stack-3">
          <Feedback tone="error">
            Couldn&apos;t load your membership status.
          </Feedback>
          <div>
            <Button variant="secondary" size="sm" onClick={() => void loadStatus()}>
              Try again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ---- Ready: already a member ----
  if (status.membershipStatus === "MEMBER") {
    return (
      <Card>
        <div className="stack-3">
          <h2 className="card__title">
            You&apos;re a member <StatusBadge status="APPROVED" />
          </h2>
          <p className="muted">
            Your membership is active. Thanks for supporting us — there&apos;s
            nothing more to upload.
          </p>
        </div>
      </Card>
    );
  }

  // ---- Ready: not a member → show the upload form ----
  const submitting = submit.phase === "submitting";
  return (
    <Card>
      <form ref={formRef} className="stack-5" onSubmit={handleSubmit} noValidate>
        <div className="stack-3">
          <h2 className="card__title">Upload your membership receipt</h2>
          <p className="muted">
            Pay via the GCash QR, then upload your receipt (an image or a PDF).
            A reviewer verifies it and activates your membership.
          </p>
        </div>

        <FormRow
          actions={
            <Button type="submit" disabled={submitting}>
              {submitting ? "Uploading…" : "Upload receipt"}
            </Button>
          }
        >
          <div className="field">
            <label className="field__label" htmlFor="membership-file">
              Receipt file
              <span className="field__required" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="membership-file"
              className="field__control"
              type="file"
              name="file"
              accept="image/*,application/pdf"
              required
              disabled={submitting}
            />
            <span className="field__hint" id="membership-file-hint">
              Accepted: images or PDF, up to 10 MB.
            </span>
          </div>
        </FormRow>

        {submit.phase === "success" ? (
          <Feedback tone="success">
            Receipt submitted. Status: <StatusBadge status="PENDING" /> — a
            reviewer will verify it shortly.
          </Feedback>
        ) : null}
        {submit.phase === "error" ? (
          <Feedback tone="error">{submit.message}</Feedback>
        ) : null}
      </form>
    </Card>
  );
}
