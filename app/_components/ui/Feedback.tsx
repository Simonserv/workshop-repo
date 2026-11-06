import type { ReactNode } from "react";

/**
 * Feedback — inline success / error / info messaging (Requirement 15.8).
 *
 * Used by forms (inquiry, auth, receipt, donation) to confirm a submit or to
 * surface a failed action with a recovery action. Renders as a polite/assertive
 * live region so assistive tech announces the change.
 */

export type FeedbackTone = "success" | "error" | "info";

export function Feedback({
  tone,
  children,
}: {
  tone: FeedbackTone;
  children: ReactNode;
}) {
  return (
    <div
      className={`feedback feedback--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="feedback__body">{children}</div>
    </div>
  );
}
