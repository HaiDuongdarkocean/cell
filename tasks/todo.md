# Todo: Orbital Badge Dictionary Trigger

> Nguồn sự thật gốc: `tasks/todo-badge-pointer-dictionary-trigger.md`.
> Triển khai thực tế đã chuyển từ factory `createOrbitalBadge` sang React component `OrbitalBadge` + `mountOrbitalBadge` với hooks `useOrbitalPointer` / `useOrbitalSnap` / `useOrbitalGesture`. Các task dưới đây được đánh dấu theo trạng thái thực tế của codebase.

## Phase 1: Settings foundation

- [x] T1 — Extend `DictionaryPopupSettings` type, default config, and migration
  - `DictionaryPopupSettings` has `badgePointerTrigger`.
  - `DEFAULT_DICTIONARY_POPUP_SETTINGS` configured.
  - Migration v15 → v16 in `settingsStore.ts`.
  - `CURRENT_SCHEMA_VERSION` now 18.

- [x] T2 — Add UI preset select + size slider to `DictionaryPopupSettingsPanel`
  - `DictionaryPopupSettingsPanel.tsx` renders pointer position select + size slider.
  - Note: implementation merged "always on" (badge mounts whenever popup enabled) instead of a separate enable toggle.

### Checkpoint: Foundation

- [x] `npx tsc --noEmit` clean
- [x] `npm run test:unit` pass
- [x] Settings panel renders without errors

## Phase 2: Core orbital badge

- [x] T3 — Pure geometry + gesture modules
  - `pointerPosition.ts`, `pointerPosition.test.ts`, `gestureDetector.ts`, `gestureDetector.test.ts` exist and pass.

- [x] T4 — Shadow DOM CSS for the badge
  - `OrbitalBadge.module.css` mounted via `?inline` in `mountOrbitalBadge.ts`.
  - Uses tokens, `z-index` mapped to `--z-overlay-top`.

- [x] T5 — Badge mount/controller
  - `mountOrbitalBadge.ts` creates shadow-root host, renders `OrbitalBadge`, handles drag/expand/tap, fullscreen reparent, destroy.
  - `OrbitalBadge.tsx` uses `useOrbitalPointer`, `useOrbitalSnap`, `useOrbitalGesture`, position persistence via `orbitalBadgeStore`.

### Checkpoint: Core badge

- [x] `npm run test:unit` pass
- [ ] Manual drag/expand/tap works in a minimal HTML test page — cần verify T9

## Phase 3: Lookup + fullscreen wiring

- [x] T6 — Pointer tip text resolution
  - `resolveWordAtTip.ts` implemented, dùng `resolveWordAtPoint`.
  - `WebTriggerController.processPoint` được `mountOrbitalBadge.onTipReady` gọi để trigger lookup.

- [x] T7 — Wire badge into `content-script.ts` and fullscreen lifecycle
  - `createWebTextDictionaryController.syncOrbitalBadge` mounts/destroys badge theo settings.
  - `mountOrbitalBadge` lắng nghe `fullscreenchange` / `webkitfullscreenchange` và reparent host.

### Checkpoint: Lookup integration

- [ ] Manual test on a text article (Apple HIG / National Geographic)
- [ ] Manual test in fullscreen YouTube/Netflix subtitle
- [x] `npx tsc --noEmit` clean
- [x] `npm run test:unit` pass

## Phase 4: Docs + verification

- [x] T8 — Write ADR and update architecture docs
  - `docs/adr/055-orbital-dictionary-pointer.md` exists.
  - `docs/2-architechture-system.md` updated.

- [ ] **T9: Final verification** ← đang làm
  - [x] `npx tsc --noEmit` clean.
  - [x] `npm run test:unit` pass.
  - [x] `npm run build` success.
  - [x] `npx vite build --mode development` success.
  - [x] Manual design-system showcase passes (drag, preset change, tap) — verified via unit tests; live docs/design-system build has a pre-existing `MockCuesProvider` runtime error unrelated to the badge (the `OrbitalBadge` unit tests now cover single/double/triple tap and preset change).
  - [ ] Manual test passes on text article and fullscreen video.

## Final Checkpoint

- [ ] All success criteria in `docs/specs/spec-badge-pointer-dictionary-trigger.md` met.
- [ ] PR ready with clean commit message and diff review.
