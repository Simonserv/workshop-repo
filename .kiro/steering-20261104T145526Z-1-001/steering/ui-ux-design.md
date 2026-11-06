---
inclusion: fileMatch
fileMatchPattern: '{app/**/*.tsx,app/**/*.css,components/**/*.tsx,**/theme.css,tailwind.config.*,app/globals.css}'
---

# UI/UX Design & Component Steering Rules

These rules govern every UI/UX task in this project. They apply to all Next.js
components, pages, and styles (`app/**`, shared components, and the design-token
files). RLS and the application layer remain the authoritative security
boundary (see `tech.md`); these rules govern the presentation layer only.

## 1. Design Philosophy & Intent-First Rule

- Always define user intent, user flows, and requirements in the Kiro spec
  before generating or modifying UI components.
- Prioritize accessibility (WCAG 2.1 Level AA minimum) and clear visual
  hierarchy over decorative noise.
- Maintain mobile-first responsive design principles across all layouts.

## 2. Design System First (non-negotiable before component code)

Ensure a proper design system is in place **before** building or restyling any
screen. Concretely, that means the following exist and are the single source of
truth for all UI work:

- A central **design-token file** (`theme.css` or the Tailwind config) — no
  component hardcodes colors, spacing, radii, or shadows outside the tokens.
- Documented, reusable **primitive components** (button, input/field, card,
  badge/status, form row) that already encode the interactive states in §4.
- Strict **dark/light mode parity** driven by tokens, not per-component
  overrides.

New screens compose these primitives; they do not invent one-off styles.

## 3. Interactive & Edge-Case Requirements

For every UI task or screen generated, you must explicitly account for:

- **Loading states** (skeletons or spinners)
- **Empty states** (helpful guidance or CTAs when no data exists)
- **Error states** (clear validation feedback and recovery actions)
- **Hover/Focus/Active interactive states** for all clickable elements

These are requirements, not nice-to-haves. A screen that renders only its happy
path is incomplete.

## 4. Craft Rules

### 4.1 Ban generic tropes
NO random glowing mesh gradients, NO floating 3D glassmorphism blobs, NO
oversized centered hero text with generic badge pills ("#1 AI-Powered…"), and NO
cookie-cutter 3-column equal card grids unless explicitly requested.

### 4.2 Tokenize everything first
Before writing component code, define and stick strictly to a central design
token file (`theme.css` or Tailwind config) containing:

- A restrained, high-contrast color palette (maximum 2 primary/accent colors,
  intentional neutrals, strict dark/light mode parity).
- A consistent typographic scale with intentional line-heights and tight
  tracking on headings.
- Unified border radii, shadow depth rules (subtle, directional, or
  flat/border-driven), and padding scales.

### 4.3 Layout & density
- Design for actual information density and ergonomic scanning (F-pattern or
  Z-pattern depending on workflow).
- Vary component sizes; not every box or card needs the exact same height,
  padding, or icon-on-top layout.
- Prioritize whitespace, clear visual hierarchy, and crisp 1px borders or
  subtle background shifts over heavy drop shadows.

### 4.4 Micro-interactions & states
- Explicitly code real hover, active, focus-ring, disabled, and empty/error
  states for every interactive element.
- Ensure transitions are fast (150ms–200ms ease-out), subtle, and functional
  rather than flashy or distracting.

## 5. Workshop context

This repo is a student-forked workshop build. Keep the design system simple
enough to teach and customize: students edit content/config files and drop in
assets (`content/*`, `public/images/*`), so the token file and primitives must
absorb their changes (new copy, new images, a new brand color) without the
layout breaking. Favor clarity and robustness over cleverness.
