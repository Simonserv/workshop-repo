import type { ElementType, ReactNode } from "react";

/**
 * Card — token-driven surface primitive (Requirement 15.4).
 *
 * Sizing follows content (not a forced uniform grid cell), honoring the layout
 * rules in the design. Set `interactive` when the whole card is clickable to
 * get hover/focus-visible affordances (Requirement 15.5); render it `as` the
 * appropriate element (e.g. a Link) in that case.
 */

type CardProps = {
  as?: ElementType;
  interactive?: boolean;
  padding?: "md" | "sm";
  className?: string;
  children: ReactNode;
  // Allow arbitrary props (href, aria-*, etc.) to pass to the rendered element.
  [key: string]: unknown;
};

export function Card({
  as,
  interactive = false,
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  const Tag = (as ?? "div") as ElementType;
  const cls = [
    "card",
    padding === "sm" ? "card--sm" : "",
    interactive ? "card--interactive" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
