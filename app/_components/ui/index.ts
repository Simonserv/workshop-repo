/**
 * UI primitives barrel — the design-system public surface.
 *
 * Screens import primitives from here (`@/app/_components/ui`) and compose them
 * rather than inventing one-off styles (Requirement 15.4). These are pre-built
 * infrastructure; students customize content/* and public/images/*, not this.
 */

export { Button, ButtonLink } from "./Button";
export type { ButtonVariant, ButtonSize } from "./Button";
export { Field, TextAreaField, FormRow } from "./Field";
export { Card } from "./Card";
export { StatusBadge } from "./StatusBadge";
export type { RecordStatus } from "./StatusBadge";
export { Feedback } from "./Feedback";
export type { FeedbackTone } from "./Feedback";
export { Spinner, Skeleton, EmptyState, ErrorState } from "./States";
