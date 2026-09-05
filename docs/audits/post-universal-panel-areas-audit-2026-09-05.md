# Post-Universal-Panel Areas Audit — 2026-09-05

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
