# settings-tab-redesign — Deliver Verify

> Fresh-context adversarial re-review after fix round. The first review returned **FAIL** on I-1 (9 un-swept literal sites named in the component mapping) and I-2 (missing AC-7 evidence), plus a broken `labelFor` and assorted dead-code/a11y nits. This pass re-verifies every claimed fix against the actual source and re-checks the full REQ set. Read-only review — `npm run typecheck/lint/test:unit/build` could not be executed; all claims verified statically or by reading the evidence PNGs directly.

## Scope reviewed

- Fix sites: `WordBadgeSettingsPanel.tsx`, `ImportProgress.module.css`, `BrowserVoicePanel.module.css`, `Dropzone.module.css`, `SourceDetailPanel.module.css`, `LanguageProfilePanel.module.css`, `JobRow.module.css`, `DictionaryPopupSettingsPanel.module.css`, `ResourcesPanel.module.css`.
- A11y: `MultiSelect.tsx` (new `id` prop), `SettingsDialogContent.tsx` (`subtitle-lang-multiselect`, `set-parallel`, `set-workers`), `SettingsRow.tsx` (label/HintIcon restructure).
- Dead code: `shortcutGroup`→`shortcutSection`, empty `@media` shell, stale comments, doc comments, trailing blanks.
- Evidence: `tmp/settings-tab-redesign/` PNGs read directly (gitignored — invisible to glob; the earlier "missing" finding was a tooling blind spot, not absent files). Spot-checked 4 shots across surfaces/widths/themes.
- Mockup cleanup: `src/entrypoints/mockup-settings-tab-redesign/` deleted.

## Findings per REQ

**REQ-1 — Unified section anatomy (13/13): PASS.** Unchanged from first review — all 13 `data-section` blocks on `SettingsSection` with `sectionRef` forwarding (`SettingsDialogContent.tsx:250-739`); zero `Card`/`sectionCard`/`cardHeader`/`cardBody`/`downloadCardBody` in the shell; `headingLevel={4}` preserves pre-redesign h4 titles (evidence: `todo-universal-panel-atomic-design-audit.md:45`).

**REQ-2 — Unified row anatomy: PASS.** Canonical `SettingsRow` API throughout; the two defects found in round 1 are fixed:
- `SettingsDialogContent.tsx:622-631` — `parallel` Select now carries `id="set-parallel"` + `labelFor="set-parallel"`, and even gained a `description` from the new `settings.download.parallel.hint` key (present in `en.json:537` and `vi.json:537`).
- `MultiSelect.tsx:17-18,146` — new `id` prop bound to the always-rendered search `<input>` in the chip field; `SettingsDialogContent.tsx:383` passes `id="subtitle-lang-multiselect"`, so `labelFor` at `:380` resolves to a real focusable element.

**REQ-3 — Supporting text: PASS.** All former `*.hint` strings render inline as `description`; title-level hints retained (`settings.dictionaryPopup.saveHint` `:475`, `settings.wordBadge.hint` `:491`, `audio.outputMode` HintIcon at `AudioPanel.tsx:155-161`); en/vi parity spot-checked including the newly added `parallel.hint`.

**REQ-4 — One grouping/divider grammar: PASS.** `SettingsGroup` remains the sole sub-label recipe (download ×4, shortcuts ×5, resources, dict links, pipeline, TTS, sync ×2, anki, theme). All seven named dialects absent. `TtsLanguagePanel.tsx:142` language rows now `dense` — the double-inset nit is fixed.

**REQ-5 — Embedded panel de-duplication: PASS.** All mapping-named recipe convergences now landed: `.profileForm` and `SourceDetailPanel` use the detail-box recipe (`color-field` + `radius-lg`); `JobRow` converged to the list-row Card recipe (`--card-radius: var(--radius-lg)`). `SyncPanel` hairline `<li>` rows are an accepted design deviation (flat rows match the band grammar better than nested card chrome — consistent with the spec's own rationale).

**REQ-6 — Subnav/scroll behavior: PASS.** `Navigation.tsx` untouched; `data-section`/`sectionRefs`/`aria-current`/hide-on-scroll/reduced-motion contract intact; `scroll-margin-top: var(--space-12)` covers the sticky subnav. Evidence PNGs show the labeled subnav rendering at 600px and 320px.

**REQ-7 — Function preservation: PASS.** All `onChange`→`saveSettings` paths, `data-cell-id`s, workers clamp (`:641`), storage sync, and focus-into behavior unchanged. Label associations now actually work where `labelFor` is used.

## Findings on fix claims

| Claim | Verified |
|---|---|
| I-1.1 `WordBadgeSettingsPanel.tsx:44-46` → `radius-full`/`border-width-thick` | ✅ `borderRadius: 'var(--radius-full)'`, `border: 'var(--border-width-thick) solid var(--color-surface)'` |
| I-1.2 `ImportProgress.module.css:10,45` → `space-12` | ✅ `min-height: var(--space-12)` ×2 |
| I-1.3 `BrowserVoicePanel.module.css:116-118` | ✅ `inset: calc(-1 * var(--space-1))`, `border: var(--border-width-thick) solid var(--color-primary)` |
| I-1.4 `Dropzone.module.css:2` | ✅ `border: var(--border-width-thick) dashed var(--color-border)` |
| I-1.5 `SourceDetailPanel.module.css:10-11` | ✅ `border-radius: var(--radius-lg)` + `background: var(--color-field)` |
| I-1.6 `LanguageProfilePanel .profileForm` | ✅ `radius-lg` + `color-field` + `padding: var(--space-3)` (`:200-210`) |
| I-1.7 `JobRow.module.css` | ✅ `border-left: var(--space-0-75)`, `min-height: var(--space-6)`, `gap: var(--space-0-5)`, `--card-radius: var(--radius-lg)` |
| I-1.8 `surfaceTabActive` color-mix → token | ✅ `background: var(--color-primary-subtle)` (`:53`) |
| I-1.9 `ResourcesPanel` `360px`/gap | ✅ `flex: 0 0 calc(var(--space-9) * 10)` (`:41`), `gap: var(--space-6)` (`:4,14,20`) |
| I-2 evidence exists | ✅ Read 4 PNGs directly: `after-direct-600-light-general.png` (flat bands, inline descriptions, SettingsGroup "Profiles · 3" + "New profile" link, hairline separators), `after-direct-600-dark-sync.png` (group labels, desc-under-title rows, Alert), `after-direct-320-light-download.png` (stacked full-width selects, Speed/Format & quality/Conversion groups), `after-dialog-1200-dark-shortcuts.png` (Playback group + 2-col ShortcutInput grid). Content confirms the shipped grammar; 13-section coverage claimed and consistent with spot-checks. |
| I-3 label associations | ✅ `id` bound to always-rendered input (`MultiSelect.tsx:144-156`); `set-parallel` id+labelFor pair (`:622,625`) |
| I-5 dead code | ✅ `styles.shortcutGroup` → `styles.shortcutSection` (live class `SettingsDialog.module.css:41`); empty `@media` shell removed; stale `cardHeader`/`cardBody`/`sectionCard` comments rewritten (`LanguageProfilePanel.module.css:1-4,101-104`); `SettingsRow.tsx:28` doc now matches `var(--space-2) 0`; `ResourcesPanel.module.css` ends cleanly at :157 |
| I-7 TTS rows `dense` | ✅ `TtsLanguagePanel.tsx:142` |
| I-8 HintIcon out of `<label>` | ✅ `SettingsRow.tsx:74-78` — `<label htmlFor>` wraps only the title text; `HintIcon` is a sibling inside `styles.title` |
| I-4 mockup deleted | ✅ `src/entrypoints/mockup-settings-tab-redesign/` absent; wiki changelog deferred to ship step per process |

## Issues found

### Remaining (non-blocking)

- **I-4b — `docs/0-wiki.md` changelog entry** is still absent; deferred to the ship step per repo convention (`docs/` → wiki at ship). Track it in `tasks/todo-settings-tab-redesign.md` S5.
- **I-9 (deferred, pre-existing):** `data-testid` vs `data-cell-id` convention on `LanguageProfilePanel.tsx` profile cards; raw `err.message` in sync Alerts; dict-popup tabstrip `role="tablist"` without `aria-controls`/`tabpanel`. Pre-date this change; acceptable to defer.
- **AC-8 unverified:** gates (`typecheck`, `lint`, `test:unit`, `build`) were not runnable in this read-only review — run them before commit. No unused imports or dead CSS-module refs found statically (the `shortcutGroup` dead ref is fixed).
- **Note:** `flex: 0 0 calc(var(--space-9) * 10)` is a compliant token expression for the 360px lookup column; flagged only as stylistically unusual, not a violation.

### Closed this round

All HIGH/MEDIUM findings from round 1 are closed: I-1 (9/9 literal sweep sites token-based), I-2 (pixel evidence confirmed on disk and inspected), I-3 (both label associations repaired), I-5 (dead code swept), I-7 (dense rows), I-8 (label/hint structure). I-6 accepted as intentional design deviation.

## VERDICT: PASS

Both blocking failures are resolved with code-verified fixes; the AC-7 evidence exists and the rendered output matches the approved band grammar. Recommend running `npm run typecheck && npm run lint && npm run test:unit && npm run build` before commit (not runnable here) and landing the `docs/0-wiki.md` changelog entry at ship.
