# Test Cases

These are reference pages to run the skill against.

## 1. Landing Page with Generic Hero

- Input: `src/landing/Features.tsx`
- Expected: Detect 3 equal cards, hero overflow, CTA wrap, em-dash.
- Success: Brief includes P0 on hero, P1 on cards, clear 3 dials.

## 2. High-Frequency Tool (e.g. video player control)

- Input: `src/player/ControlBar.tsx`
- Expected: No unnecessary motion, touch targets pass, state visible.
- Success: Motion audit recommends removing or reducing animations; no P0 on decoration.

## 3. Settings/Form Page

- Input: `src/settings/Panel.tsx`
- Expected: 3-tier panel typography, no-background hover for tabs, form contrast.
- Success: Component taxonomy is mostly reuse/extend; brief maps tokens.

## 4. Page with Vague Feedback and No Design System

- Input: a legacy page with `style={{...}}` everywhere.
- Expected: Stop early and report no design system, or propose token map.
- Success: Skill does not hallucinate a redesign.

## 5. Dashboard / Data-Heavy Page

- Input: `src/dashboard/StatsGrid.tsx`
- Expected: Desktop-first context, high density, tabular numbers, no decorative motion.
- Success: 3 dials lean toward low variance, low motion, high density.

## 6. Component showcase with missing tokens

- Input: `src/shared/ui/Button.showcase.tsx` and `src/shared/styles/tokens.json`
- Expected: Detect unresolvable `var(--component-*)` references before reporting "no color" or "no border".
- Success: Brief includes P0 token-mismatch fix and does not stop at layout-only recommendations.

## 7. Gallery / preview card with nested borders

- Input: `src/entrypoints/design-system-showcase/ShowcaseGallery.module.css`
- Expected: Count borders on the preview card; reject more than one visible border and report padding/gap issues.
- Success: Brief proposes removing outer/stage borders and using background + spacing instead.
