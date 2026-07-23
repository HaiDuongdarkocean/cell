# Todo: Orbital Badge Dictionary Trigger

## Phase 1: Settings foundation

- [ ] **T1: Extend `DictionaryPopupSettings` type, default config, and migration**
  - Description: Add `badgePointerTrigger?: { enabled: boolean; position: 'top' | 'left' | 'right' | 'center' }` to `DictionaryPopupSettings`. Update `DEFAULT_DICTIONARY_POPUP_SETTINGS`. Add settings migration v15 → v16 that injects the default `{ enabled: false, position: 'center' }`.
  - Acceptance:
    - [ ] `DictionaryPopupSettings` includes `badgePointerTrigger`.
    - [ ] Default is `enabled: false`, `position: 'center'`.
    - [ ] `CURRENT_SCHEMA_VERSION` bumped to `16` with additive migration.
    - [ ] `npx tsc --noEmit` clean.
  - Files:
    - `src/entities/settings/types.ts`
    - `src/shared/config/config.ts`
    - `src/shared/lib/storage/settingsStore.ts`
  - Size: S
  - Dependencies: None

- [ ] **T2: Add UI toggle + preset select to `DictionaryPopupSettingsPanel`**
  - Description: Render a checkbox to enable/disable the orbital badge trigger and a select for `top` / `left` / `right` / `center`. Only show the select when enabled.
  - Acceptance:
    - [ ] Toggle updates `badgePointerTrigger.enabled`.
    - [ ] Select updates `badgePointerTrigger.position`.
    - [ ] Existing tests still pass.
  - Files:
    - `src/features/settings/ui/DictionaryPopupSettingsPanel.tsx`
  - Size: XS
  - Dependencies: T1

### Checkpoint: Foundation

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:unit` pass
- [ ] Settings panel renders without errors

## Phase 2: Core orbital badge

- [ ] **T3: Implement pure geometry + gesture modules**
  - Description: Create `pointerPosition.ts` (angle → preset mapping, preset offsets) and `gestureDetector.ts` (double/triple tap on pointer events). Add unit tests.
  - Acceptance:
    - [ ] `angleToPreset(angle)` returns nearest `top`/`left`/`right`/`center`.
    - [ ] `getPresetOffset(position, radius)` returns `{ x, y }` for the pointer.
    - [ ] Gesture detector emits `double` after 2 taps within 300 ms, `triple` after 3 taps, and does not emit double while waiting for triple.
    - [ ] Unit tests pass in jsdom.
  - Files:
    - `src/features/dictionaryPopup/badgePointer/pointerPosition.ts`
    - `src/features/dictionaryPopup/badgePointer/pointerPosition.test.ts`
    - `src/features/dictionaryPopup/badgePointer/gestureDetector.ts`
    - `src/features/dictionaryPopup/badgePointer/gestureDetector.test.ts`
  - Size: M
  - Dependencies: None

- [ ] **T4: Implement Shadow DOM CSS for the badge**
  - Description: Create `orbitalBadgeCss.ts` with BEM classes: `.cell-orbital-badge` (host), `.cell-orbital-badge--collapsed` (crescent on right edge), `.cell-orbital-badge--expanded` (circle), `.cell-orbital-pointer` (moon), position modifiers. Use design tokens.
  - Acceptance:
    - [ ] Crescent shape uses `border-radius` and `clip-path` or `border` (no hardcoded colors).
    - [ ] Expanded badge is a circle using `--radius-full`.
    - [ ] Pointer position controlled by CSS variables `--pointer-x`, `--pointer-y`.
    - [ ] Host and pointer use `z-index: 2147483647` so they render above all page layers.
    - [ ] Build generates CSS without errors.
  - Files:
    - `src/features/dictionaryPopup/badgePointer/orbitalBadgeCss.ts`
  - Size: S
  - Dependencies: None

- [ ] **T5: Implement badge controller `createOrbitalBadge`**
  - Description: Factory that creates a Shadow DOM host, badge, pointer, drag handlers, tap handlers (using T3 modules), and exposes `setPosition`, `setEnabled`, `destroy`. Emits `onPresetChange`, `onDragStart`, `onDragEnd` callbacks.
  - Acceptance:
    - [ ] Drag starts on `pointerdown`; badge expands when moved more than threshold.
    - [ ] Badge collapses back to right edge when released.
    - [ ] Double tap cycles `top` ↔ `center`; triple tap cycles `left` ↔ `right` (only when expanded).
    - [ ] `setPosition` animates pointer to the preset.
    - [ ] `destroy` removes listeners and DOM.
    - [ ] Unit tests pass in jsdom.
  - Files:
    - `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts`
    - `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.test.ts`
    - `src/features/dictionaryPopup/badgePointer/index.ts`
  - Size: L
  - Dependencies: T3, T4

### Checkpoint: Core badge

- [ ] `npm run test:unit` pass
- [ ] Manual drag/expand/tap works in a minimal HTML test page

## Phase 3: Lookup + fullscreen wiring

- [ ] **T6: Implement pointer tip text resolution**
  - Description: Inside `createOrbitalBadge`, when the drag ends (or after a short hold), compute the pointer tip coordinate and call `document.elementsFromPoint`. Skip elements owned by `.js-cell-orbital-badge`, then extract the text node + word using helpers reused from `webTriggerController.ts` (`extractSentenceContext`, `extractWordAtOffset`).
  - Acceptance:
    - [ ] Tip coordinate matches pointer offset + badge center.
    - [ ] Uses `document.elementsFromPoint` and skips `.js-cell-orbital-badge` owned elements.
    - [ ] Returns a `LookupRequest` + `Range` for the word under the tip.
    - [ ] Returns `null` when tip is over non-text or only the badge.
  - Files:
    - `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts`
    - `src/features/dictionaryPopup/badgePointer/pointerPosition.ts`
  - Size: M
  - Dependencies: T5

- [ ] **T7: Wire badge into `content-script.ts` and fullscreen lifecycle**
  - Description: Initialize `createOrbitalBadge` at top-level `content-script.ts` when `dictionaryPopup.enabled && dictionaryPopup.badgePointerTrigger?.enabled`. On settings change, destroy or recreate. Listen to `fullscreenchange` to move the badge host into/out of `document.fullscreenElement`. Pass lookup result to the existing `WebTextDictionaryController.handleLookup()`.
  - Acceptance:
    - [ ] Badge appears when enabled in settings.
    - [ ] Badge disappears when disabled.
    - [ ] Badge survives entering/exiting fullscreen.
    - [ ] Lookup triggers popup + highlight in normal page and fullscreen video.
  - Files:
    - `src/entrypoints/content/content-script.ts`
  - Size: M
  - Dependencies: T2, T5, T6

### Checkpoint: Lookup integration

- [ ] Manual test on a text article (Apple HIG / National Geographic)
- [ ] Manual test in fullscreen YouTube/Netflix subtitle
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:unit` pass

## Phase 4: Docs + verification

- [ ] **T8: Write ADR and update architecture docs**
  - Description: Write `docs/adr/055-orbital-badge-dictionary-trigger.md` explaining why the orbital badge trigger exists and key decisions. Update `docs/2-architechture-system.md` with new files and dependencies.
  - Acceptance:
    - [ ] ADR covers objective, decisions, alternatives rejected, risks.
    - [ ] Architecture doc tree + function index updated.
    - [ ] `docs/0-wiki.md` updated if docs changed.
  - Files:
    - `docs/adr/055-orbital-badge-dictionary-trigger.md`
    - `docs/2-architechture-system.md`
    - `docs/0-wiki.md`
  - Size: S
  - Dependencies: T7

- [ ] **T9: Final verification**
  - Description: Run full build, unit tests, typecheck, and manual verification on mobile emulation and fullscreen video.
  - Acceptance:
    - [ ] `npx tsc --noEmit` clean.
    - [ ] `npm run test:unit` pass.
    - [ ] `npm run build` success.
    - [ ] Manual test passes on text article and fullscreen video.
  - Files:
    - All touched files
  - Size: S
  - Dependencies: T8

## Final Checkpoint

- [ ] All success criteria in `docs/specs/spec-badge-pointer-dictionary-trigger.md` met.
- [ ] PR ready with clean commit message and diff review.
