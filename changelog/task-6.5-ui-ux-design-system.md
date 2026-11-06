# Task 6.5 — Establish the UI/UX design system foundation

Status: completed
Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10

## What was built

The presentation-layer design system that all later UI tasks (7.x, 8.x, 9.x)
must compose. No new styling dependency was added — the project stays on plain
CSS with custom properties (no Tailwind, no CSS-in-JS). The system is a single
token file, a small set of reusable primitive components, shared required-state
building blocks, and a refactor of the Session-1 scaffold pages onto the tokens
and primitives.

Delivered:

- **Design tokens — single source of truth** (`app/theme.css`): color roles
  (bg/surface/surface-2/border/text/muted + status colors for
  PENDING/APPROVED/REJECTED/NEW/IN_PROGRESS/CLOSED/VERIFIED), a restrained
  palette of two accents (`--accent`, `--accent-2`) plus a neutral ramp, a
  typographic scale with intentional line-heights and tight heading tracking, a
  single spacing scale, unified radii (two steps + pill), border-driven shadow
  rules, and motion tokens (150–200ms ease-out). **Dark and light** are both
  defined with strict parity (same semantic roles, different values) via
  `prefers-color-scheme` and a `data-theme` override, plus a reduced-motion
  guard. _Satisfies 15.1, 15.2, 15.3._

- **Primitive components** (`app/_components/ui/`):
  - `Button` / `ButtonLink` — primary/secondary/ghost variants, each with
    hover, focus-visible ring, active, and disabled states.
  - `Field` / `TextAreaField` + `FormRow` — label + control + inline error/hint
    slot, wiring `aria-invalid` and `aria-describedby` for field-level
    validation.
  - `Card` — token-driven surface; content-sized (not a forced uniform grid
    cell), with an optional interactive (hover/focus) mode.
  - `StatusBadge` — maps every record status to a status token color.
  - `Feedback` — inline success/error/info messaging as a live region.
  - Barrel `index.ts` so screens import from `@/app/_components/ui`.
  _Satisfies 15.4, 15.5._

- **Shared required-state building blocks** (`app/_components/ui/States.tsx`):
  `Spinner` and `Skeleton` (loading), `EmptyState` (guidance/CTA), and
  `ErrorState` (message + recovery action), reused by later screens.
  _Satisfies 15.6, 15.7, 15.8._

- **Component styles** (`app/_components/ui/ui.css`): all primitive styling,
  drawing exclusively from the tokens, including the responsive `card-grid`
  (1 → 2 → auto-fill columns, content-sized, not a fixed equal-height
  3-column grid). _Satisfies 15.1, 15.9, 15.10._

## Scaffold refactor (consume tokens + primitives)

- `app/globals.css` — now imports `theme.css` + `ui.css` and styles base
  elements and layout utilities strictly from tokens; added global
  focus-visible rings and `color-scheme`. Removed the old dark-only `:root`
  block and the hardcoded `--radius: 10px` / inline pixel values.
- `app/page.tsx` (landing) — hero CTA is now the `ButtonLink` primitive; hero is
  left-aligned and token-spaced (no oversized centered hero + badge pills).
- `app/catalog/page.tsx` — removed all inline `style` objects (including the
  hardcoded `borderRadius: 8px` that conflicted with the radius token); cards
  use the `Card` primitive and token classes; **added an explicit catalog
  EMPTY STATE** (`EmptyState`) shown when `content/listings.ts` is empty
  (15.7).
- `app/login/page.tsx` — panel is now the `Card` primitive with token-driven
  width/spacing; removed inline margin styles.
- `app/_components/SiteNav.tsx` and `app/layout.tsx` — already class-driven;
  their classes now resolve against the new tokens (dark/light aware). Existing
  accessibility wins preserved (`aria-label="Primary"` on nav, `lang="en"`,
  listing `alt` text) and extended (focus-visible rings, `aria-invalid`/
  `aria-describedby` on fields, live regions on feedback/states).

Students still customize only `content/*` and `public/images/*`; the tokens and
primitives are pre-built infrastructure they do not edit. A changed brand accent
or replaced image flows through the tokens/primitives without breaking layout
(workshop-fit goal).

## Requirement 15 coverage map

- 15.1 central token source, components draw from tokens → `app/theme.css`,
  all primitives/pages.
- 15.2 dark/light parity driven by tokens → `theme.css` light block mirrors
  every role.
- 15.3 ≤2 accents + neutrals, WCAG AA contrast → palette discipline in
  `theme.css`.
- 15.4 primitives (button/field/card/status badge/form row) → `app/_components/ui/`.
- 15.5 hover/focus-visible/active/disabled, 150–200ms ease-out → `ui.css`
  interactive states + motion tokens.
- 15.6 loading state → `Spinner` / `Skeleton`.
- 15.7 empty state → `EmptyState` + catalog empty state.
- 15.8 error state (field-level + recovery) → `Field` error slot, `Feedback`,
  `ErrorState`.
- 15.9 mobile-first responsive → `card-grid` breakpoints, fluid type, `%`/`ch`
  constraints.
- 15.10 no banned tropes → left-aligned hero, content-sized grid, border-driven
  depth; no mesh gradients / glassmorphism blobs / badge pills.

## Files

- app/theme.css (new) — design tokens (dark + light).
- app/_components/ui/ui.css (new) — primitive + state styles.
- app/_components/ui/Button.tsx, Field.tsx, Card.tsx, StatusBadge.tsx,
  Feedback.tsx, States.tsx, index.ts (new) — primitives + shared states.
- app/globals.css (refactored) — imports tokens, token-driven base/layout.
- app/page.tsx, app/catalog/page.tsx, app/login/page.tsx (refactored) —
  consume primitives/tokens; catalog gains an empty state.
- .kiro/specs/pos-catalog-site-core/tasks.md — marked Task 6.5 done.

## Verification

Type-check and production build, run once, both clean:

- `npx tsc --noEmit` — exit 0, no type errors.
- `npm run build` (`next build`) — compiled successfully; lint + type
  validation passed; 6 pages generated.

There is no browser automation in this environment, so visual rendering,
responsive breakpoints, and dark/light parity were verified by **static review
against Requirement 15 and the `ui-ux-design` steering rules**, not at runtime.
Static review confirmed: no inline/hardcoded design values remain in the
refactored scaffold pages (grep for `style={{`, `borderRadius`, hex colors, and
`px"` in `app/**/*.tsx` outside the primitives returns nothing); the catalog
empty state exists and renders when `listings` is empty; both themes define the
full set of semantic roles with parity; and every interactive primitive encodes
hover/focus-visible/active/disabled with 150–200ms ease-out transitions. The
one remaining inline style (the `Skeleton` size props in `States.tsx`)
references tokens only and carries no hardcoded design value.
