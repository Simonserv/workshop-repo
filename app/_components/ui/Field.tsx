import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Field / Input — primitive form control (Requirement 15.4).
 *
 * Renders a label + control + inline error/hint slot. When `error` is set the
 * field shows field-level validation feedback and wires `aria-invalid` +
 * `aria-describedby` so assistive tech announces it (Requirement 15.8). The
 * control's focus-visible, hover, disabled, and error styles live in ui.css
 * (Requirement 15.5).
 */

type BaseProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
};

function describedBy(id: string, hasError: boolean, hasHint: boolean) {
  const ids: string[] = [];
  if (hasError) ids.push(`${id}-error`);
  else if (hasHint) ids.push(`${id}-hint`);
  return ids.length ? ids.join(" ") : undefined;
}

function Label({
  id,
  label,
  required,
}: {
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="field__label" htmlFor={id}>
      {label}
      {required ? (
        <span className="field__required" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

function Messages({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string | null;
  hint?: string;
}) {
  if (error) {
    return (
      <span className="field__error" id={`${id}-error`} role="alert">
        {error}
      </span>
    );
  }
  if (hint) {
    return (
      <span className="field__hint" id={`${id}-hint`}>
        {hint}
      </span>
    );
  }
  return null;
}

type FieldProps = BaseProps & ComponentPropsWithoutRef<"input">;

/** Single-line text input field. */
export function Field({
  id,
  label,
  required,
  error,
  hint,
  className,
  ...rest
}: FieldProps) {
  const hasError = Boolean(error);
  return (
    <div className={`field${hasError ? " field--error" : ""}`}>
      <Label id={id} label={label} required={required} />
      <input
        id={id}
        className="field__control"
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy(id, hasError, Boolean(hint))}
        {...rest}
      />
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}

type TextAreaFieldProps = BaseProps & ComponentPropsWithoutRef<"textarea">;

/** Multi-line variant for longer input (e.g. inquiry messages). */
export function TextAreaField({
  id,
  label,
  required,
  error,
  hint,
  rows = 4,
  ...rest
}: TextAreaFieldProps) {
  const hasError = Boolean(error);
  return (
    <div className={`field${hasError ? " field--error" : ""}`}>
      <Label id={id} label={label} required={required} />
      <textarea
        id={id}
        className="field__control"
        rows={rows}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy(id, hasError, Boolean(hint))}
        {...rest}
      />
      <Messages id={id} error={error} hint={hint} />
    </div>
  );
}

/**
 * FormRow — layout wrapper that stacks fields and an actions row with
 * consistent spacing (Requirement 15.4). `actions` renders in a trailing row.
 */
export function FormRow({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="form-row">
      {children}
      {actions ? <div className="form-row__actions">{actions}</div> : null}
    </div>
  );
}
