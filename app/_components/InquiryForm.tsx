"use client";

import { useState } from "react";

import type { InquiryType } from "@/content/listings";
import {
  Button,
  Feedback,
  Field,
  FormRow,
  TextAreaField,
} from "@/app/_components/ui";

/**
 * InquiryForm — the per-listing inquiry form (Requirements 3.5, 4.x).
 *
 * The form that renders depends on the listing's `inquiry_type`
 * (DEMO / QUOTE / INQUIRE): the heading, lead copy, details-field label, and
 * submit label are selected from the map below so a visitor sees the inquiry
 * form that corresponds to the listing's type (Requirement 3.5). The underlying
 * fields (name, email, optional phone, details) and the POST target are the
 * same for every type — the server persists one `inquiries` row regardless.
 *
 * It composes the Task 6.5 primitives (Field / TextAreaField / FormRow /
 * Button / Feedback) and implements the required states (Requirement 15):
 *   - interactive: the primitives encode hover/focus-visible/active/disabled;
 *     the submit button is disabled and relabelled while submitting.
 *   - error: field-level validation errors returned by the route handler are
 *     mapped back onto the matching Field; a non-field error shows a recovery
 *     message (Requirement 15.8).
 *   - success: a confirming Feedback message replaces the form and surfaces the
 *     inquiry id returned by the server (Requirement 4.2).
 *
 * Submits to the public `POST /api/inquiries` route handler, which is the
 * authoritative validator — this client-side wiring is UX only.
 */

type Copy = {
  heading: string;
  lead: string;
  detailsLabel: string;
  detailsHint: string;
  submitLabel: string;
  success: string;
};

const COPY: Record<InquiryType, Copy> = {
  DEMO: {
    heading: "Request a demo",
    lead: "Tell us what you'd like to see and we'll set up a live walkthrough.",
    detailsLabel: "What would you like the demo to cover?",
    detailsHint: "Mention the features or use cases you want to see in action.",
    submitLabel: "Request demo",
    success: "Thanks! Your demo request has been received.",
  },
  QUOTE: {
    heading: "Request a quote",
    lead: "Share a few details about your project and we'll scope a quote.",
    detailsLabel: "Describe your project",
    detailsHint: "Rough scope, timeline, and anything else that helps us quote.",
    submitLabel: "Request quote",
    success: "Thanks! Your quote request has been received.",
  },
  INQUIRE: {
    heading: "Send an inquiry",
    lead: "Have a question? Send us the details and we'll get back to you.",
    detailsLabel: "Your message",
    detailsHint: "Let us know what you'd like to discuss.",
    submitLabel: "Send inquiry",
    success: "Thanks! Your inquiry has been received.",
  },
};

type FieldErrors = {
  name?: string;
  email?: string;
  details?: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; inquiryId?: string }
  | { kind: "error"; message: string; fieldErrors: FieldErrors };

export function InquiryForm({
  listingId,
  inquiryType,
}: {
  listingId: string;
  inquiryType: InquiryType;
}) {
  const copy = COPY[inquiryType];
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const fieldErrors = status.kind === "error" ? status.fieldErrors : {};
  const submitting = status.kind === "submitting";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus({ kind: "submitting" });

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          details: data.get("details"),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        inquiryId?: string;
        error?: string;
        fieldErrors?: FieldErrors;
      };

      if (response.status === 201) {
        form.reset();
        setStatus({
          kind: "success",
          inquiryId: payload.inquiryId,
        });
        return;
      }

      setStatus({
        kind: "error",
        message:
          payload.error ?? "We couldn't send your request. Please try again.",
        fieldErrors: payload.fieldErrors ?? {},
      });
    } catch {
      setStatus({
        kind: "error",
        message: "We couldn't reach the server. Please try again.",
        fieldErrors: {},
      });
    }
  }

  if (status.kind === "success") {
    return (
        <Feedback tone="success">
          <span>{copy.success}</span>
          {status.inquiryId ? (
            <span className="muted">Reference: {status.inquiryId}</span>
          ) : null}
        </Feedback>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 className="section__title">{copy.heading}</h2>
      <p className="section__lead">{copy.lead}</p>

      {status.kind === "error" && status.message ? (
        <div className="stack-4">
          <Feedback tone="error">{status.message}</Feedback>
        </div>
      ) : null}

      <div className="stack-4">
        <FormRow
          actions={
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : copy.submitLabel}
            </Button>
          }
        >
          <Field
            id="inquiry-name"
            name="name"
            label="Your name"
            required
            autoComplete="name"
            error={fieldErrors.name ?? null}
          />
          <Field
            id="inquiry-email"
            name="email"
            type="email"
            label="Email"
            required
            autoComplete="email"
            error={fieldErrors.email ?? null}
          />
          <Field
            id="inquiry-phone"
            name="phone"
            type="tel"
            label="Phone (optional)"
            autoComplete="tel"
          />
          <TextAreaField
            id="inquiry-details"
            name="details"
            label={copy.detailsLabel}
            hint={copy.detailsHint}
            required
            rows={5}
            error={fieldErrors.details ?? null}
          />
        </FormRow>
      </div>
    </form>
  );
}
