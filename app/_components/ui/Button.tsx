import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Button — primitive action control (Requirement 15.4).
 *
 * Variants: primary / secondary / ghost. Every variant encodes the required
 * interactive states — hover, focus-visible ring, active, and disabled — via
 * token-driven CSS in ui.css with 150–200ms ease-out transitions
 * (Requirement 15.5). Use it for real actions; use ButtonLink for navigation.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "sm";

function classes(
  variant: ButtonVariant,
  size: ButtonSize,
  block: boolean,
  extra?: string,
): string {
  return [
    "btn",
    `btn--${variant}`,
    size === "sm" ? "btn--sm" : "",
    block ? "btn--block" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(variant, size, block, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
};

/** ButtonLink — same visual styling as Button, rendered as a navigation link. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  block = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classes(variant, size, block, className)} {...rest}>
      {children}
    </Link>
  );
}
