# Acceptance Test Checklist — AT1 to AT7

> Run during Steps 3-9 of the review process. Each AT has explicit pass/fail criteria.

## AT1 — First-glance test

**Method**: View the desktop screenshot. Within 3 seconds of first viewing, answer 3 questions.

**Questions**:
1. What do you see? (Compare to `first_glance.sees_in_3s` in the contract.)
2. What do you know to do next? (Compare to `first_glance.knows_what_to_do`.)
3. Do you need a guide? (Compare to `first_glance.needs_guide`, must be `false`.)

**Pass criteria**: 3/3 answers match the contract's `first_glance:` section.

**Fail criteria**: Any answer does not match. Record:
- What you actually saw (not what the contract says you should see).
- What you would actually do next (not what the contract says).
- Whether you needed a guide.

**Severity on fail**: 3 (major). If the user cannot understand the screen in 3 seconds, the placement is wrong.

**Source**: Nielsen heuristic 6 (recognition over recall). Norman's perceived affordance. The user should perceive what to do without reading instructions.

---

## AT2 — Flow step count

**Method**: Read the flow simulation from the evidence package. For each task, count the steps from entry to done.

**Pass criteria**: All tasks <= 3 steps AND step counts match the contract's `flows:` section.

**Fail criteria**: Any task > 3 steps, or step count does not match the contract.

**Severity on fail**:
- 4 steps: severity 2 (minor).
- 5+ steps: severity 3 (major).
- 7+ steps: severity 4 (catastrophic, working memory overload).

**Record on fail**: Task name, actual step count, contract expected step count, which step feels unnecessary or could be merged.

**Source**: Hick's Law (more choices = more decision time per step). Goal-Gradient Effect (users slow down with more steps). Miller's Law (working memory overload with too many items on screen at once).

---

## AT3 — Visual tell sweep

**Method**: View all screenshots (desktop, mobile, active state, empty state, error state). Scan for AI-slop tells. Also grep the code diff for tell signatures.

**Tells to scan** (full list in `heuristic-evaluation-checklist.md`):

Visual tells (from screenshots):
- [ ] Em-dash (`—`) visible in any text.
- [ ] AI-purple gradient in any background or button.
- [ ] 3 equal cards in a row.
- [ ] Fake screenshot (div-based product UI visible in screenshot).
- [ ] Scroll cue text ("Scroll", "↓ scroll", "Scroll to explore").
- [ ] Locale strip ("Lisbon 14:23 · 18°C").
- [ ] Version footer ("v1.4.2", "Build 0048").
- [ ] Centered hero when variance > 4 (landing pages only).
- [ ] Decorative colored dots on every list/nav item.
- [ ] Photo-credit captions as decoration.
- [ ] Pills/labels overlaid on images.
- [ ] Eyebrow count > ceil(sectionCount / 3).

Code tells (grep code diff):
- [ ] `font-family: 'Inter'` or `font-family: Inter` (banned default).
- [ ] `—` (em-dash character) in any string.
- [ ] `from-purple` or `to-purple` in CSS (AI-purple gradient).
- [ ] `#000000` (pure black) in CSS.
- [ ] `height: 100vh` (should be `100dvh`).

**Pass criteria**: Zero tells found.

**Fail criteria**: Any tell present. List each tell with: tell name, location (screenshot name or file:line), severity.

**Severity on fail**: Per tell, see `heuristic-evaluation-checklist.md` AI-slop section. Em-dash is always severity 3 (non-negotiable).

---

## AT4 — A11y runtime

**Method**: Read the a11y report from the evidence package (browser a11y panel output). Also run static checks on the code diff.

**Runtime checks** (from a11y report):
- [ ] 0 violations in the browser a11y panel.

**Static checks** (from code diff, compute where needed):
- [ ] Text contrast >= 4.5:1 (WCAG 1.4.3 AA). Compute from hex: `canvas` vs `text_primary`, `surface` vs `text_primary`, `surface` vs `text_secondary`.
- [ ] Large text contrast >= 3:1 (WCAG 1.4.3, text >= 18px or >= 14px bold).
- [ ] Focus indicator >= 2px perimeter, 3:1 contrast against unfocused state (WCAG 2.4.13).
- [ ] Touch targets >= 44x44px (WCAG 2.5.8). Check button padding in CSS.
- [ ] ARIA roles match contract `a11y:` section.
- [ ] Tablist: `role="tablist"` present. Each `role="tab"` has `aria-controls` pointing to a panel `id`. Each `role="tabpanel"` has `aria-labelledby` pointing back to a tab `id`.
- [ ] `aria-selected="true"` only on the active tab.
- [ ] Keyboard: tab order is logical (follows visual order). No keyboard traps. Arrow keys move within tablist. Tab key moves from tablist to active panel. Home/End jump to first/last tab.
- [ ] Skip link present and functional (hidden until focused).
- [ ] Alt text on every meaningful image. Decorative images have `alt=""`.

**Pass criteria**: 0 runtime violations AND all static checks pass.

**Fail criteria**: Any runtime violation or any static check fails.

**Severity on fail**:
- Contrast < 3:1: severity 4 (catastrophic, text unreadable for low-vision users).
- Contrast 3:1 to 4.5:1: severity 3.
- Missing focus ring: severity 3.
- Missing ARIA role: severity 3.
- Touch target < 44px: severity 2.
- Missing alt text: severity 2.
- Missing skip link: severity 2.

---

## AT5 — Console clean

**Method**: Read the console log from the evidence package.

**Pass criteria**: 0 errors. Warnings are acceptable if justified (e.g., a deprecation warning from a library the project depends on).

**Fail criteria**: Any error.

**Severity on fail**:
- Error that breaks functionality: severity 4.
- Error that degrades functionality: severity 3.
- Error with no visible impact: severity 2.

**Record on fail**: Error message, likely cause, which file/function it originates from.

---

## AT6 — Responsive collapse

**Method**: Compare the desktop screenshot (1440x900) vs the mobile screenshot (375x812).

**Checks**:
- [ ] Mobile collapses to single column (no multi-column layout on mobile).
- [ ] No horizontal scroll (no element wider than 375px viewport).
- [ ] Touch targets >= 44px on mobile (check button/tab sizes in mobile screenshot).
- [ ] Text readable at mobile size (minimum 14px / 0.875rem).
- [ ] Navigation collapses cleanly (single row, hamburger menu, or bottom nav). No two-line nav.
- [ ] No overlapping elements on mobile (asymmetric layouts that overlap on desktop must stack on mobile).
- [ ] Images scale or crop appropriately (no images wider than viewport).

**Pass criteria**: All checks pass.

**Fail criteria**: Any check fails.

**Severity on fail**:
- Horizontal scroll: severity 3 (breaks mobile UX).
- Multi-column on mobile: severity 3.
- Touch target < 44px: severity 2.
- Text < 14px: severity 2.
- Two-line nav: severity 2.

---

## AT7 — Contract compliance

**Method**: Read the code diff. Check against the contract section by section.

**Placement compliance**:
- [ ] Every function row in `functions:` has a corresponding component in code.
- [ ] Each component is at the `zone` specified (primary = above-fold, secondary = supporting, tertiary = buried).
- [ ] Each component is at the `priority` specified (above-fold, below-fold, on-demand).
- [ ] Navigation structure matches `ia:` section (nav type, items, grouping, default tab).
- [ ] No component was moved to a different zone or priority without a contract addendum.

**Token compliance**:
- [ ] Every color in components comes from a CSS variable defined in `palette:`.
- [ ] No freeform hex values in component CSS (grep for `#` in component files).
- [ ] Font-family in CSS matches `fonts:` section. No Inter.
- [ ] Border-radius values match `shape:` section.
- [ ] Spacing uses the scale defined in the contract.
- [ ] Motion duration and easing match `motion:` section. No `linear` or `ease-in-out`.

**State compliance**:
- [ ] Every component has all states listed in `states:` implemented.
- [ ] Loading states use skeletons, not spinners.
- [ ] Empty states are composed, not blank.
- [ ] Error states are inline, not alerts.
- [ ] Focus rings are visible and meet 3:1 contrast.

**ARIA compliance**:
- [ ] ARIA roles match contract `a11y:` section.
- [ ] Tablist/tab/tabpanel linkage correct.
- [ ] `aria-selected` only on active tab.

**Anti-slop compliance**:
- [ ] Zero em-dash in output (grep all files for `—`).
- [ ] Zero Inter as font-family default.
- [ ] Zero AI-purple gradient.
- [ ] Zero 3-card equal feature row.
- [ ] Zero fake screenshot divs.
- [ ] Eyebrow count <= ceil(sectionCount / 3).

**Pass criteria**: 100% match across all compliance checks.

**Fail criteria**: Any mismatch.

**Severity on fail**:
- Missing component for a function: severity 4 (function not accessible).
- Wrong zone/priority: severity 3.
- Freeform hex (token drift): severity 2.
- Missing state: severity 3 (loading/empty/error) or 2 (hover/active/focus).
- Anti-slop violation: per tell severity (see AT3).

**Record on fail**: Contract field, expected value, code location, actual value.
