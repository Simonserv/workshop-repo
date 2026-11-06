"use client";

import { useEffect, useState } from "react";

import { Button, Card, ErrorState, Skeleton } from "@/app/_components/ui";

/**
 * PaymentInfoPanel — fetches and renders the GCash QR payment info from a
 * payment-info endpoint, with the required loading and error states
 * (Requirement 15.6, 15.8).
 *
 * Shared by the membership and donation screens: pass the endpoint to read
 * (`/api/membership/payment-info` or `/api/donations/payment-info`). The data
 * (label, account name, QR image path, instructions) comes from the editable
 * `content/payment.ts`; this component never hardcodes it. All styling draws
 * from the design tokens via the Card primitive and token classes — no inline
 * design values.
 */

interface PaymentInfo {
  label: string;
  accountName: string;
  qrImageUrl: string;
  instructions: string;
}

type State =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; data: PaymentInfo };

export function PaymentInfoPanel({ endpoint }: { endpoint: string }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let active = true;

    async function load() {
      setState({ phase: "loading" });
      try {
        const res = await fetch(endpoint);
        if (!res.ok) {
          throw new Error("request failed");
        }
        const data = (await res.json()) as PaymentInfo;
        if (active) {
          setState({ phase: "ready", data });
        }
      } catch {
        if (active) {
          setState({ phase: "error" });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
    // Re-run only when the endpoint changes.
  }, [endpoint]);

  if (state.phase === "loading") {
    // Loading state (Requirement 15.6): skeletons stand in for the QR + text.
    return (
      <Card>
        <div className="stack-3">
          <Skeleton height="var(--text-lg)" width="60%" />
          <Skeleton
            height="var(--space-8)"
            width="var(--space-8)"
            radius="var(--radius-md)"
          />
          <Skeleton height="var(--text-base)" width="80%" />
          <Skeleton height="var(--text-base)" width="90%" />
        </div>
      </Card>
    );
  }

  if (state.phase === "error") {
    // Error state (Requirement 15.8): message + recovery action (retry).
    return (
      <ErrorState
        title="Couldn't load payment details"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setState({ phase: "loading" })}
          >
            Try again
          </Button>
        }
      >
        Refresh the page to try again. You can still fill in the form below.
      </ErrorState>
    );
  }

  const { data } = state;
  return (
    <Card>
      <div className="stack-3">
        <h2 className="card__title">{data.label}</h2>
        {/* Plain <img>: the QR is a static file under /images/ (public/), kept
            dependency-free to match the scaffold. */}
        <img
          className="payment-qr"
          src={data.qrImageUrl}
          alt={`GCash QR code for ${data.accountName}`}
          width={220}
          height={220}
        />
        <p className="card__meta">{data.accountName}</p>
        <p className="muted">{data.instructions}</p>
      </div>
    </Card>
  );
}
