# Example — Reviewing OptionsApp Redesign

> Worked example for `ui-ux-reviewer`. Shows a full review of the OptionsApp redesign from `design-driven-development`.

## Context

The implementer completed Phase 2 of the OptionsApp redesign and submitted:
- `UI-Contract.md` (the approved contract from Phase 1)
- `evidence/options-app/` containing:
  - `desktop_full.png` (1440x900)
  - `mobile_375.png` (375x812)
  - `tab_active_state.png`
  - `empty_state.png`
  - `error_state.png`
  - `console_log.txt`
  - `a11y_report.txt`
  - `flow_simulation.md`
  - `code_diff.patch`

## Step 1 — Read the contract

Read `UI-Contract.md`. Key points:
- 3 functions (F1 Resources, F2 Theme, F3 Settings), all primary zone, above-fold.
- 3 flows, all <= 2 steps.
- Aesthetic: minimalist-ui, Geist font, accent `#1F6C9F`.
- States: TabButton (hover/active/focus), ResourcesPanel (loading/empty/error), ThemePanel (loading/error), SettingsPanel (error).
- Anti-slop: em-dash ban, Inter ban, AI-purple ban, 3-card ban, eyebrow cap.
- First-glance: "3 tabs, active underline, content below", "click tab to config", needs_guide = false.

## Step 2 — Read the evidence

View screenshots. Read console log, a11y report, flow simulation, code diff.

## Step 3 — AT1 First-glance

View `desktop_full.png` for 3 seconds:
1. **What do you see?** 3 tabs at top (Tài nguyên active with underline, Giao diện, Cài đặt), content panel below showing a drag-drop zone and a list.
2. **What do you know to do next?** Click a tab to switch, or drag a file into the zone.
3. **Do you need a guide?** No.

Compare to contract:
- `sees_in_3s`: "3 tabs, active underline, content below" — MATCH.
- `knows_what_to_do`: "click tab to config" — MATCH.
- `needs_guide`: false — MATCH.

**AT1: PASS**

## Step 4 — AT2 Flow step count

Read `flow_simulation.md`:
- Import dictionary: drag file -> confirm. 2 steps. Contract: 2. MATCH.
- Delete dictionary: click delete -> confirm. 2 steps. Contract: 2. MATCH.
- Change theme color: click Giao diện tab -> drag slider. 2 steps. Contract: 2. MATCH.

**AT2: PASS** (all tasks <= 3, counts match contract)

## Step 5 — AT3 Visual tell sweep

View all screenshots. Scan for tells:
- Em-dash: check all text in screenshots. Title says "Tùy chọn" (no em-dash). No em-dash found in any label, heading, or body. PASS.
- Inter font: grep code diff for `Inter`. CSS uses `var(--font-family, 'Geist', sans-serif)`. No Inter. PASS.
- AI-purple gradient: grep for `purple` in CSS. No matches. PASS.
- 3 equal cards: screenshots show tab layout, no card grid. PASS.
- Fake screenshot: no div-based product UI. PASS.
- Scroll cue: no "Scroll" text. PASS.
- Locale strip: no city/time/weather. PASS.
- Version footer: no "v1.4.2". PASS.
- Eyebrow count: 0 eyebrows on 1 section. 0 <= ceil(1/3) = 1. PASS.
- Centered hero: not a landing page. N/A.

**AT3: PASS** (zero tells)

## Step 6 — AT4 A11y runtime

Read `a11y_report.txt`: "0 violations."

Static checks on code diff:
- Contrast: `#18181B` on `#FBFBFA` = 15.3:1 (AAA). PASS.
- Focus ring: CSS has `:focus-visible { outline: 2px solid var(--accent); }`. 2px, accent color. PASS.
- Touch targets: tab button padding `12px 20px`. Height = 12+12+line-height(20px) = 44px. PASS.
- ARIA: code has `role="tablist"`, each tab has `role="tab"` + `aria-controls="panel-resources"`, panel has `role="tabpanel"` + `id="panel-resources"` + `aria-labelledby="tab-resources"`. `aria-selected` on active tab only. PASS.
- Keyboard: `onKeyDown` handler on tablist for Arrow Left/Right, Home, End. PASS.
- Skip link: `<a href="#content" class="skip-link">Skip to content</a>` present. PASS.
- Alt text: no meaningful images on this screen. N/A.

**AT4: PASS** (0 runtime violations, all static checks pass)

## Step 7 — AT5 Console clean

Read `console_log.txt`: "No errors. 1 warning: [Deprecation] chrome.runtime.getURL is deprecated for options pages, use chrome.runtime.getURL with relative path."

The warning is from a Chrome API deprecation, not from the UI code. Justified.

**AT5: PASS** (0 errors, 1 justified warning)

## Step 8 — AT6 Responsive

Compare `desktop_full.png` vs `mobile_375.png`:
- Mobile: single column. Tabs stack as a single row (3 tabs fit in 375px). Content panel below. PASS.
- No horizontal scroll: all elements within 375px. PASS.
- Touch targets on mobile: tabs are 44px height, full width. PASS.
- Text size: body text 14px. PASS.
- Navigation: single row, not two-line. PASS.
- No overlapping elements. PASS.

**AT6: PASS**

## Step 9 — AT7 Contract compliance

Read `code_diff.patch`. Check against contract:

**Placement**:
- F1 Resources: `ResourcesPanel.tsx` at primary zone, above-fold (default tab). MATCH.
- F2 Theme: `ThemePanel.tsx` at primary zone, above-fold. MATCH.
- F3 Settings: `SettingsPanel.tsx` at primary zone, above-fold. MATCH.
- Nav: tabs, 3 items, default Tài nguyên. MATCH.

**Tokens**:
- Colors: all via `var(--color-*)`. No freeform hex in components. PASS.
- Font: `var(--font-family, 'Geist', sans-serif)`. No Inter. PASS.
- Radius: cards `12px`, buttons `6px`, inputs `6px` via `var(--radius-*)`. MATCH.
- Motion: `transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1)`. No `linear` or `ease-in-out`. PASS.

**States**:
- TabButton: hover (color shift), active (scale 0.98 + translate-y 1px), focus (2px ring). All in CSS. MATCH.
- ResourcesPanel: loading (skeleton list), empty (composed drag-drop hint), error (inline + retry). All implemented. MATCH.
- ThemePanel: loading (skeleton sliders), error (inline). MATCH.
- SettingsPanel: error (inline per field). MATCH.

**ARIA**: matches contract `a11y:` section. PASS.

**Anti-slop**: zero em-dash, zero Inter, zero AI-purple, zero 3-card, zero fake screenshot. Eyebrow count 0. PASS.

**AT7: PASS** (100% match)

## Step 10 — Heuristic evaluation

Run through Nielsen 10:

| # | Heuristic | Result | Notes |
|---|---|---|---|
| H1 | Visibility of system status | PASS | Active tab has underline + aria-selected. Loading skeleton on import. Success toast after import. |
| H2 | Match real world | PASS | Labels: "Tài nguyên", "Giao diện", "Cài đặt" — user vocabulary. No codebase terms. |
| H3 | User control | PASS | Delete has confirmation dialog. Modal has close + escape. Back nav N/A (options root). |
| H4 | Consistency | PASS | One accent (#1F6C9F). One font (Geist). One radius system (6/12px). One transition. |
| H5 | Error prevention | PASS | Delete confirmation. File type validation on import. Disabled state on import while processing. |
| H6 | Recognition over recall | PASS | Options visible (tabs). Active state visible (underline). Empty state guides user. |
| H7 | Flexibility | PASS | Arrow keys navigate tabs. Home/End jump to first/last. Tab moves to panel. |
| H8 | Aesthetic minimalist | PASS | No decoration. Generous padding (48px block). No noise. |
| H9 | Error recovery | PASS | Errors inline, plain language, tell user what to do. No codes, no "Oops!". |
| H10 | Help and documentation | PASS | Empty state guides first action. No external manual needed. |

**Heuristic violations: 0**

## Step 11 — Cognitive walkthrough

Walk through each task:

### Task: Import 1 dictionary

**Step 1: Drag file into zone**
- Q1 Know what to do? Yes. Drag-drop zone has hint text "Kéo file vào đây".
- Q2 See the control? Yes. Zone is in primary area, large, visually distinct.
- Q3 Know it is the right control? Yes. Hint text + dashed border signals drop target.
- Q4 Understand feedback? Yes. File appears in list after drop, confirm dialog appears.

**Step 2: Confirm dialog**
- Q1 Know what to do? Yes. Dialog has "Xác nhận" and "Hủy" buttons.
- Q2 See the control? Yes. Buttons in dialog, centered.
- Q3 Know it is the right control? Yes. "Xác nhận" is primary (accent fill), "Hủy" is secondary.
- Q4 Understand feedback? Yes. Dialog closes, success toast appears, list updates.

No failures.

### Task: Delete 1 dictionary

**Step 1: Click delete**
- Q1 Know what to do? Yes. Each list item has a delete icon button.
- Q2 See the control? Yes. Delete button on the right of each item.
- Q3 Know it is the right control? Yes. Trash icon is universally recognized.
- Q4 Understand feedback? Yes. Confirmation dialog appears.

**Step 2: Confirm**
- Q1-Q4: Same as import confirm. No failures.

No failures.

### Task: Change theme color

**Step 1: Click Giao diện tab**
- Q1 Know what to do? Yes. Tab is visible at top.
- Q2 See the control? Yes. Tab in nav row.
- Q3 Know it is the right control? Yes. Label "Giao diện" matches user vocabulary.
- Q4 Understand feedback? Yes. Panel switches to theme controls.

**Step 2: Drag slider**
- Q1 Know what to do? Yes. Slider is visible with label "Màu chủ đạo".
- Q2 See the control? Yes. Slider in primary area.
- Q3 Know it is the right control? Yes. Slider with color preview shows it controls color.
- Q4 Understand feedback? Yes. Live preview updates as user drags.

No failures.

**Cognitive walkthrough failures: 0**

## Step 12 — Compile review report

Write to `evidence/options-app/review-round-1.md`:

```markdown
# UI-UX Review — Round 1

## Summary
- Overall: PASS
- Acceptance tests: 7/7 passed
- Heuristic violations: 0
- Cognitive walkthrough failures: 0

## Acceptance test results
| AT | Name | Result | Notes |
|---|---|---|---|
| AT1 | First-glance | PASS | 3/3 match contract |
| AT2 | Flow step count | PASS | All tasks 2 steps, <= 3 |
| AT3 | Visual tell sweep | PASS | Zero tells |
| AT4 | A11y runtime | PASS | 0 violations, all static checks pass |
| AT5 | Console clean | PASS | 0 errors, 1 justified warning |
| AT6 | Responsive | PASS | Single column mobile, no horizontal scroll |
| AT7 | Contract compliance | PASS | 100% match |

## Heuristic violations
None.

## Cognitive walkthrough failures
None.

## Verdict
PASS: ship.
```

## Step 13 — Addendum

No addendum needed. Review is PASS. The implementer can ship.
