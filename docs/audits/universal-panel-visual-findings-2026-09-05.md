# Universal Panel — Visual Verification Findings

**Date:** 2026-09-05  
**Environment:** Design-system showcase, built after user token/CSS changes.  
**Method:** Playwright (mcp-playwright) screenshots in Chromium, design-system showcase served at `http://127.0.0.1:8123`.  
**Screenshots directory:** `docs/audits/screenshots/`

---

## 1. What was tested

| View | URL params | Screenshot file |
|---|---|---|
| Dictionary (light, default) | `?showcase=Universal+Panel+Page&mode=light&viewport=full&tab=dictionary` | `universal-panel-light-initial.png` |
| Study Modes after click from Dictionary | click on "Study Modes" tab | `universal-panel-study-modes-light.png` |
| Study Modes direct | `&tab=studyModes` | `universal-panel-study-modes-light-direct.png` |
| Settings after click from Dictionary | click on "Settings" tab | `universal-panel-settings-light.png` |
| Settings direct | `&tab=settings` | `universal-panel-settings-light-direct.png` |
| Settings → TTS Voices nav click | click on "TTS Voices" nav item | `universal-panel-settings-tts-dark.png` |
| Settings nav-item hover (active) | hover on "Media" | `universal-panel-settings-navitem-hover.png` |
| Settings nav-item hover (inactive) | hover on "Block" | `universal-panel-settings-navitem-hover-inactive.png` |

All screenshots are in `docs/audits/screenshots/`.

**Post-fix verification screenshots:**
- `fixed-settings-light-v2.png` — Settings in light mode: no duplicate header, labels restored, no popup, document theme stays light.
- `fixed-settings-dark-boundary.png` — `?mode=dark`: panel subtree dark, showcase shell stays light (correct scoping).
- `fixed-studymodes-dark.png` — real `StudyModesTab` rendering in dark: Play mode / Custom / Advanced sections present.

---

## 2. Executive visual verdict

| # | Finding | Severity | Status | Notes |
|---|---|---|---|---|
| 1 | **Content-script/WebTrigger lookup fires on nav-item clicks inside the panel** — opens `PopupDictionary` overlay for the clicked label text | **P0** | ✅ **FIXED** | `.js-cell-universal-panel` hook added to panel root; `CELL_UI_HOST_SELECTORS` is now SSOT shared across `webTriggerController.ts`, `tokenizeBlock.ts`, `subtitleShortcuts.ts`. |
| 2 | **Settings `ThemePanel` overwrites global `data-theme`** via `applyTheme()` to `document.documentElement` | **P0** | ✅ **FIXED** | Deleted the redundant `applyTheme` effect in `ThemePanel` — all real mounts already have `ThemeProvider`/`ShadowThemeProvider` re-applying on store change. Standalone showcase wrapped in `ThemeProvider`. |
| 3 | **Duplicate "Settings" header** — sidebar header + content header | **P1** | ✅ **FIXED** | `SettingsDialogContent` gained `showSidebarHeader` prop; `SettingsTab` passes `false`. |
| 4 | **Study Modes tab is only a placeholder** in the showcase | **P1** | ✅ **FIXED** | Showcase now renders real `StudyModesTab` (loads defaults via `getStorage` fallback when chrome API absent). |
| 5 | **NavItem active/hover states hard to distinguish in dark mode** | **P2** | ✅ **FIXED** | Replaced invisible `filter: brightness(1.05)` (no-op on transparent bg) with M3 state layer: hover → `var(--color-surface-hover)`, active → `primary-subtle` + pill + primary icon, active:hover → `--button-primary-subtle-hover-bg`. |
| 6 | **`sidebar.bg`/`sidebar.fg` tokens orphaned** | **P2** | ✅ **FIXED** | `Sidebar.module.css` now uses `var(--sidebar-bg)`/`var(--sidebar-fg)` (matching user's `CollapsibleSidebar` convention). |
| 7 | **TokenizeControls `color-mix` background looks flat** | **P2/P3** | ✅ **FIXED** | Tokenized depth: `border: var(--border-width-hairline) solid var(--color-border-subtle)` + `box-shadow: var(--shadow-sm)` — separation visible in both themes. |
| 8 | **NEW: `?mode=`/`?preset=` params were dead** — showcase ignored them entirely | **P1** | ✅ **FIXED** | `UniversalPanelPage` now reads `mode`/`preset` params and wraps the panel in a `data-theme`/`data-preset` boundary — the same scoping the shadow-root `ShadowThemeProvider` provides in production. Panel can now be screenshotted in dark mode inside a light shell. |
| 9 | **NEW: Settings inner sidebar permanently collapsed to icon circles** | **P1** | ✅ **FIXED** | Root cause: `container-type: inline-size` on `Navigation .vertical` + `width: max-content` on `Sidebar` → intrinsic size resolves to 0 → items always collapsed. `SettingsDialog.module.css` now gives `.sidebarWidth` a definite `var(--sidebar-width)` at ≥840px so the container query has a real input. |
| 10 | Card Creator error alert `border-radius: var(--radius-pill)` renders as a disc on short boxes | n/a | ✅ **INTENTIONAL** | Confirmed by owner — the disc look is a design choice. Comment added in `CardCreatorDialog.module.css` so future audits don't flag it. |

---

## 3. Detailed findings

### 3.1 P0 — WebTrigger / content script lookup fires inside the panel

**Evidence:**
- `universal-panel-study-modes-light.png` — after clicking "Study Modes", a dark `PopupDictionary` overlay appears for the term "modes".
- `universal-panel-settings-tts-dark.png` — after clicking "TTS Voices" in the Settings sidebar, the same overlay appears for the term "voices".
- Snapshot `settings-tts-overlay-snapshot.yml` confirms the overlay is a `dialog "Dictionary popup"` with heading "voices".
- `src/features/dictionaryPopup/trigger/webTriggerController.ts:36-48` defines `UI_HOST_SELECTORS` including `#cell-universal-panel-host`, and `ALLOW_LOOKUP_SELECTOR = '[data-allow-lookup]'`.
- `src/features/universalPanel/UniversalPanel.tsx:175` only sets `data-cell-id="universal-panel"`, **not** an id or class matching `UI_HOST_SELECTORS`.
- `src/entrypoints/design-system-showcase/pages/UniversalPanelPage.showcase.tsx:99` uses the `UniversalPanel` component directly (inline), not `mountUniversalPanel`, so the host is never created.

**Why it happens:**
The content script's `WebTriggerController` attaches `document` level `mouseup`/`selectionchange` listeners. In the real extension the panel is mounted into `#cell-universal-panel-host`, which `isInsideBlockedHostForLookup` catches. In any other context (showcase, unit tests, third-party integrations), the component itself has no host selector, so clicks on nav text are treated as page-text lookups.

**Fix direction:**
- Add a stable host class/attribute to `UniversalPanel` (e.g. `data-cell-id="universal-panel-host"` and add `.js-cell-universal-panel-host` to `UI_HOST_SELECTORS`).
- OR add `data-no-lookup` to the panel root and to `NavItem`/`Navigation` text nodes.
- OR change `webTriggerController.ts` to also block by `data-cell-id="universal-panel"`.
- The showcase should use `mountUniversalPanel` or a mock host wrapper if it wants real content-script isolation.

### 3.2 P0 — Settings `ThemePanel` overwrites the whole document theme

**Evidence:**
- Every direct or clicked `tab=settings` render turns the whole design-system page dark, including the left showcase shell (`universal-panel-settings-light-direct.png`, `universal-panel-settings-light.png`, `universal-panel-settings-navitem-hover.png`).
- `src/features/theme/ui/ThemePanel.tsx:26-28` calls `applyTheme(resolveMode(mode), config)` with **no `target` argument**, so it writes to `document.documentElement`.
- `src/features/theme/logic/themeManager.ts:21-34` defaults `target = document.documentElement`.
- In the real extension, `mountUniversalPanel` uses `ShadowThemeProvider` with `container: mount.rootEl`, but `ThemePanel` still touches the host page root, breaking shadow-DOM scoping.

**Fix direction:**
- `ThemePanel` must receive a scoped `container` (e.g. from `ShadowThemeProvider` or `UniversalPanel`'s shadow root) and pass it to `applyTheme()`.
- If `ThemePanel` is embedded inside a non-shadow context, it should use the nearest `[data-theme]` ancestor or accept a `target` prop.
- The live-preview use-case can still apply to a scoped preview element (`ThemePreview`) instead of `document.documentElement`.

### 3.3 P1 — Duplicate "Settings" header

**Evidence:**
- `universal-panel-settings-light-direct.png` and `universal-panel-settings-light.png` show:
  - Left sidebar header: "Settings".
  - Content area top: "Settings" with a back arrow.
- `src/features/settings/ui/SettingsDialogContent.tsx:160` passes `header="Settings"` to `Sidebar`.
- `src/features/settings/ui/SettingsDialog.tsx:18` also sets `title="Settings"`.

**Fix direction:**
- Add `showSidebarHeader={false}` when `SettingsDialogContent` is rendered inside the Universal Panel.
- When rendered as a standalone dialog, the `Dialog` title can be the single "Settings" label.

### 3.4 P1 — Study Modes tab not visualized in showcase

**Evidence:**
- `UniversalPanelPage.showcase.tsx:99`:
  ```tsx
  studyModesPanel={<div data-cell-id="study-modes-panel">Study Modes</div>}
  ```
- Direct URL `&tab=studyModes` shows only a white panel with the text "Study Modes" (`universal-panel-study-modes-light-direct.png`).

**Fix direction:**
- Replace the placeholder with the real `StudyModesTab` (or a mock state) before any visual audit of Study Modes can be meaningful.

### 3.5 P2 — NavItem active/hover states lack distinction

**Evidence:**
- `universal-panel-settings-navitem-hover.png` (hover on active "Media") and `universal-panel-settings-navitem-hover-inactive.png` (hover on inactive "Block") look nearly identical.
- Recent user change in `src/shared/ui/NavItem.module.css`:
  ```css
  .item:hover:not(:disabled) {
    filter: brightness(1.05);
  }
  ```
- The active item uses a background color; the hover only changes brightness by 5 %. On dark `color-surface-elevated`/`color-primary-subtle` this is barely visible.

**Fix direction:**
- Use a stronger hover surface token (`--color-surface-hover`) or increase brightness to at least `1.08–1.1`.
- Restore `color: var(--color-text-hover)` or add an underline/focus-ring change on hover.
- Consider adding a `data-active` modifier with a distinct style from hover.

### 3.6 P2 — New `sidebar.bg` / `sidebar.fg` tokens are not wired

**Evidence:**
- User added in `tokens.json`:
  ```json
  "sidebar": {
    "bg": "var(--color-surface-elevated)",
    "fg": "var(--color-text)"
  }
  ```
- `src/shared/ui/Sidebar.module.css:13` still reads `background: var(--color-surface); color: var(--color-text);`.
- `NavItem.module.css` also does not use `--sidebar-fg`.

**Fix direction:**
- Decide whether `Sidebar` should consume `--sidebar-bg`/`--sidebar-fg`.
- If the tokens are meant for the Settings sidebar only, add them to `SettingsDialog.module.css` or rename to `settings-sidebar-*`.
- Otherwise, update `Sidebar.module.css` and `NavItem.module.css` to use the new tokens.

### 3.7 P2/P3 — TokenizeControls flat after shadow removal

**Evidence:**
- User change in `src/features/universalPanel/TokenizeControls.module.css`:
  ```css
  background: color-mix(in srgb, var(--universal-panel-tokenize-capsule-bg) 96%, var(--color-text) 4%);
  ```
  (removed two layered `box-shadow` lines).
- In `universal-panel-light-initial.png` and `universal-panel-settings-navitem-hover.png` the tokenize pill is a single flat color.

**Fix direction:**
- If the design intent is flat, add a `border` or `outline` token to maintain separation from the header surface.
- If depth is still needed, use a tokenized `box-shadow` from `tokens.json` (e.g. `--shadow-raised`) rather than the old hardcoded `color-mix` shadows.
- Check contrast against both light and dark header backgrounds.

---

## 4. User changes observed and their visual impact

| File | Change | Visual impact |
|---|---|---|
| `src/shared/styles/tokens.json` | Added `sidebar.bg` and `sidebar.fg` | No visible impact yet because CSS does not consume them. |
| `src/shared/ui/NavItem.module.css` | Hover now uses `filter: brightness(1.05)`; removed `background`/`color`; added `filter` transition | Subtle hover; active vs hover distinction is weak in dark mode. Padding change to `0 var(--space-3)` makes text alignment symmetric. |
| `src/features/universalPanel/TokenizeControls.module.css` | Removed dual inset `box-shadow`; background now `color-mix(..., 96%, color-text 4%)` | Capsule looks flatter and less separated from the header. |

---

## 5. Recommendations before any further polish

1. **Stop the two P0 regressions first:**
   - Make `UniversalPanel`/`SettingsDialogContent` safe from the content-script `WebTriggerController`.
   - Scope `ThemePanel.applyTheme` to the panel's shadow root or a supplied container.
2. **Add the real `StudyModesTab` to the showcase** so visual QA can cover it.
3. **Wire or remove the new `sidebar.bg`/`fg` tokens.**
4. **Tighten `NavItem` active/hover contrast.**
5. **Decide whether `TokenizeControls` should be flat or token-shadowed**, then implement consistently.

---

*Audit report generated with agent tooling. Screenshots and snapshots are in `docs/audits/screenshots/`.*

---

## Post-remediation verification (addendum)

After the atomic-design + SSOT remediation commits, the panel was re-screenshotted
in light and dark modes across all three tabs (Dictionary / Study Modes /
Settings) at 1280×800. No visual regressions observed: SelectableCard active
states, shared Toggle/Select/Heading/Text controls, dictionary sub-panels after
the CSS module split, and the settings inner sidebar all render correctly in
both themes. `e2e/showcase-universal-panel-bugs.spec.ts` — 7/7 pass.

Status: **all findings closed.** Playwright webServer config already sets
`reuseExistingServer: !process.env.CI` — the earlier `EADDRINUSE :8123` was a
stale dev server, not a config gap.
