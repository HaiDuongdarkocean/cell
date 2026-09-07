# Post-Universal-Panel Areas Audit — 2026-09-05

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

Extension of the Universal Panel atomic-design audit to the surrounding areas
(popup entrypoint, sidepanel, launcher-dashboard, subtitle overlay, srs-study,
shared Sheet/BottomSheet). Four parallel read-only audits; same taxonomy:
P0 broken/a11y-blocking, P1 SSOT violation w/ shared-atom mapping,
P2 hardcode→token, P3 cosmetic.

**Full per-file tables live in the agent transcripts; this doc is the
prioritized summary + remediation queue.**

---

## P0 — broken / accessibility-blocking

| # | Finding | File:line |
|---|---|---|
| 1 | `--stroke-width-xl` undefined token | `popup/components/SelectionBar.module.css:38` |
| 2 | `VideoCard` quality dropdown is a hand-rolled `role="listbox"` — no keyboard nav, no `aria-activedescendant`/`aria-controls` | `popup/components/media/VideoCard.tsx:146-176` |
| 3 | `CueList` built on plain `<div>`s — no `role="list"`/`listitem` | `sidepanel/components/CueList.tsx:69-73` |
| 4 | Cue timestamp seek is `<span onClick>` — not focusable, no keyboard | `sidepanel/components/CueList.tsx:81-93` |
| 5 | `LauncherTile` grid rendered without `onClick` — dead buttons | `launcher-dashboard/App.tsx:31-33` |
| 6 | `LauncherSearchBar` raw `<input>` — no label/`aria-label` | `launcher-dashboard/components/LauncherSearchBar.tsx:41` |
| 7 | `LauncherUserBar` Settings/Add buttons — no `onClick`, not `disabled` | `launcher-dashboard/components/LauncherUserBar.tsx:49-64` |
| 8 | `SubtitleHint` `role="button"` div — no `tabIndex`, no keyboard handler | `subtitle/ui/SubtitleHint.tsx:15-20` |
| 9 | `--shadow-text-soft` / `--shadow-text-cinema` undefined → soft/cinema text-shadow presets silently broken | `subtitle/ui/subtitleUI.ts:17-18` |

## P1 — SSOT violations with clear shared mapping

| Area | Findings |
|---|---|
| popup | `tabBadge`/`qualityBadge`/`parallelBadge` → `Badge`; `h1` → `Heading`; custom progress bar → `Progress`; `HStack role="button"` cards (SubtitleCard, VideoCard) → `SelectableCard`; copy `<button>`s → `Button`; quality `<select>`-like → `Select` |
| sidepanel | `App.tsx` empty state → `EmptyState` |
| launcher | `LauncherSearchBar` custom search → `SearchField`/`Input` |
| subtitle | undefined tokens: `--duration-medium` (×4), `--icon-default-size`, `--color-border-strong`, `--transition-fast` (×2), `--blur-xs`, `--ease-bounce`; raw inputs → `Input`/`SearchField` (`SubtitleSearchPanel:270`, `SubtitleManagerPanel:265`, `SubtitleStylePanel` ×8); `.trackList` missing `role="listbox"`; `PlayerModeOverlay` separator resize not keyboard-operable |
| srs-study | `UserCssPanel` raw `<textarea>` → `Textarea`; `SrsManagePanel.module.css:120` uses undefined `--color-danger` |
| shared Sheet | `Sheet` (non-BottomSheet) lacks `aria-label`/`title`, `useFocusTrap`, and any close button — only drag/Esc/overlay |

## P2 — hardcode → token (bulk)

- `opacity` literals: DownloadCard `.queued` 0.6, `.detailItem svg` 0.7, MediaEmpty 0.5/0.7, SubtitleCard/VideoCard `.downloading` 0.5, SubtitleBlock 0.7, SrsReviewCard 0.4, various subtitle panels
- `ease`/`ease-in-out`/ms durations instead of `var(--ease-*)/--duration-*` — SelectionBar, DownloadCard, MediaEmpty, SubtitleCard, VideoCard, BottomNav `120ms`, SubtitleManagerPanel 280/320/220ms, etc.
- `inset 0 0 0 1px` glass-border shadows → `--border-width-hairline` (launcher ×4)
- px literals: `max-width: 720px`, `flex-basis: 200px`, `360px`, `660px`, `280px`, `80px`, `160px`, `240px`, `44px`, `40px`, `34px`, `18px`, `16px`, `8px`, `6px`, `2px`, `24px` — mostly subtitle UI
- `em` literals: `3.2em`, `2.8em` (CueList), `2em`, `3em`, `0.85em`, `0.05em`/`0.1em`/`0.15em` letter-spacing
- `z-index: 1/2/3` local stacking — acceptable convention; `z-index: 2147483646/2147483647` (max-int) in HostManagerSheet, SubtitlePanels, iframePlayerModeBridge, error boundary — need a `--z-overlay-top`-level token or documented ceiling
- `var(--token, literal)` fallbacks for registered tokens — widespread in srs-study + subtitle (drop fallbacks)
- Dead selectors: `App.module.css` (srs-study) ×10; SubtitlePanel `.footer/.buttonRow/.addFilesBtn/.addFolderBtn/.dragHint`; SubtitleManagerPanel `.backBtn/.searchSectionWrapper/.empty`; SubtitleSearchPanel `.manageKeysLink`
- Button-variant CSS overrides fighting atoms: `.audioButton`/`.forgetButton`/`.rememberButton`/`.toolRow`, destructive actions using `variant="ghost"` → `variant="destructive"`
- Wrong Icon barrel: `@/shared/icons/Icon` → `@/shared/ui/Icon` (popup-wide, SrsReviewCardBack, BottomSheet)
- Raw `<h2>`/`h3>`: BottomSheet `<h2>`, popup Header `<h1>` (P1), `SubtitleManagerFooter.showcase` inline-styled `<h3>`

## P3 — cosmetic / possibly-intentional

- Subtitle-content sizing px (preview frames, `scale(0.3333)`, clamp() cluster sizes) — subtitle text geometry is user-facing config, likely intentional; document rather than tokenize
- `autoFocus` on `InputField` (SrsReviewCardFront), `alt={fieldId}` non-human alt text
- `SHEET_MARGIN_PX` hardcoded px constants in `useSheet.ts` (documented mirror of `--space-2`)
- Error-boundary crash-only inline styles (SubtitlePanels:1412)

---

## Totals

| Area | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| popup | 2 | 10 | 15 | 1 |
| sidepanel + launcher | 5 | 3 | 8 | 0 |
| subtitle | 2 | ~14 | ~55 | ~12 |
| srs-study + sheets | 0 | 5 | ~25 | ~50 (mostly fallbacks) |
| **Total** | **9** | **~32** | **~103** | **~63** |

## Suggested order

1. **P0 sweep** (9 items) — undefined tokens + keyboard-blocked controls + dead launcher buttons
2. **P1 atom migrations** — Badge/Heading/Progress/SelectableCard/Select/Input/SearchField/Textarea (~32)
3. **P2 tokenization + dead CSS** — bulk, can be done per-directory
4. P3 — document intentional, fix trivial ones opportunistically

*Generated with Devin — 4 parallel read-only subagent audits.*

---

## Status update — remediation in progress (2026-09-05)

- **T11 P0: DONE** — 8/9 fixed (see task file); launcher dead buttons deferred (WIP design page, needs product intent).
- **T12 P1: DONE** — all undefined tokens remapped to registered names; Badge/Heading/Progress/Select/Input/Textarea/EmptyState migrations; Sheet a11y (aria-label + focusTrap + keyboard handle); destructive variants; `role=listbox` trackList; Icon barrel unified; dead `Icon.module.css` deleted.
  - *Reverted-by-design*: bare inputs inside styled chrome wrappers (`SubtitleSearchPanel.searchBar`, `ManagerPanel.valueField`) — shared `Input` would double-chrome; `type="color"` stays native (no `ColorInput` atom).
- **T13 P2: IN PROGRESS** — bulk tokenization + dead-CSS removal via 3 parallel subagents (popup+sidepanel+launcher / subtitle / srs+bottomnav).
- **T14 P3: documented below.**

## P3 — intentionally retained (documented)

| Pattern | Where | Rationale |
|---|---|---|
| Subtitle-content px sizing (`fontSize`, preview `scale(0.3333)`, `160px` frame) | `SubtitlePreview.tsx`, `OverlayPreview.module.css` | User-facing subtitle geometry — px IS the config unit; preview frame is a fixed reference surface |
| `clamp()` cluster sizing (`--cluster-btn-size`, `--cluster-icon-size`) | `NavCluster.module.css`, `subtitlePanelsShared.module.css` | Container-query-driven cluster scaling — user-configured size range, not design chrome |
| Error-boundary inline styles (`#1a1a1a`, `#ff4444`, `14/16px`, z-index max) | `SubtitlePanels.tsx:1412-1416` | Crash-only UI must render even when the token pipeline fails — inline literals are the feature |
| `SHEET_MARGIN_PX` px constants | `useSheet.ts:12-18` | JS gesture math mirrors `--space-2`; CSS vars can't be read in pointer math — documented mirror |
| `autoFocus` on `InputField` | `SrsReviewCardFront.tsx:66` | Deliberate — typing answer immediately on card flip; revisit if SR complaints |
| Bare inputs inside chrome wrappers | `SubtitleSearchPanel.searchBar`, `SubtitleManagerPanel.valueField` | Wrapper provides border/bg/focus-within chrome; shared `Input` would double-chrome; `aria-label` already present |
| Native `type="color"` inputs | `SubtitleStylePanel` ×3 | Platform color-picker primitive; no `ColorInput` atom exists — promote when 2nd consumer appears |
| `HStack role="button"` card rows | `SubtitleCard`, `VideoCard` | Clickable sub-region inside `Card` — `SelectableCard` renders its own Card (wrong DOM); keyboard already wired + `:focus-visible` added |
| Launcher dead buttons (tiles, Settings, Add) | `launcher-dashboard` | WIP design-concept page — wire when product intent lands |
| `z-index` max-int (`2147483646/7`) | overlay injection points | Intentional top-most vs host page; `var(--z-ceiling)` rejected — injected CSS runs in foreign documents where our token scope may not exist, `var()` would silently fail |
