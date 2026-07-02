# Design System Drift Audit — 2026-07-02

> **Audit pass** sau design-system fix pass (Step 2-5 + atom extraction + browser verify).
> Measures 6 axes (radius, color, spacing, hover, focus, typography) across 3 UI surfaces
> (popup, sidepanel, content-script). Pass/fail per axis + evidence.

## Summary

| Axis | Status | Evidence |
|---|---|---|
| **Radius** | PASS | 3 tokens (`--radius-sm/md/lg/full`) resolve đúng trên popup + sidepanel + content-script. 0 raw `border-radius` values trong CSS modules mới. |
| **Color** | PASS | `--color-error-subtle`, `--color-warning-subtle` tokens resolve (`#ef444426`, `#f59e0b26`). `--color-danger` → `--color-error`, `--color-primary-alpha` → `--color-primary-subtle` fix xong. `color: white` → `--color-text-inverse` (3 sites). |
| **Spacing** | PASS | Sidepanel rewrite dùng `--spacing-xs/sm/md` tokens. 0 inline `padding` values. |
| **Hover** | PASS | IconButton atom: 6 CSS rules exist trong stylesheet (`ghost:hover`, `danger:hover`, `activePrimary`, `activeDanger`, `:focus-visible`). Manager icon: `mouseenter`/`mouseleave` listeners added. DownloadCard: `:hover` added. |
| **Focus** | PASS | IconButton `:focus-visible` rule exists (`outline: 2px solid --color-border-focus`). Sidepanel global `:focus-visible` trong `global.css`. |
| **Typography** | PASS | Sidepanel dùng `--font-family` (Inter), `--font-size-base/sm/xs`. 0 inline `font-family`/`font-size`. |

**Overall: PASS** — 6/6 axes pass.

## Inventory → Fix mapping

| Inventory # | Inconsist | Fix | Verify |
|---|---|---|---|
| #1 | IconButton hover inconsistent (4 components, 4 CSS modules) | Extract `IconButton` atom (`src/shared/ui/IconButton.tsx`) — 11 call sites migrated | Browser: 4 header btns cùng class `_iconBtn _md _ghost`, 6 CSS rules exist |
| #2 | Manager icon no hover | Added `mouseenter`/`mouseleave` listeners trong `subtitleManagerPanel.ts` | Code review (icon render cần video active) |
| #3 | `--color-danger` broken token | Renamed → `--color-error` trong `SubtitleStylePanel.module.css` | Build pass, no token resolve error |
| #5 | Card radius inconsistent (`--radius-md` vs `--radius-lg`) | DownloadCard `--radius-md` → `--radius-lg` (align VideoCard/SubtitleCard) | CSS module updated |
| #6 | DownloadCard no hover | Added `:hover` + `error:hover` + `queued:hover` | CSS module updated |
| #8 | `--color-primary-alpha` broken token | Renamed → `--color-primary-subtle` trong `SubtitleStylePanel.module.css` | Build pass |
| #9 | Badge radius chaos (`10px`, `8px`, `3px`, `50%`) | MultiSelect badge `10px` → `--radius-full`, sectionCount `8px` → `--radius-sm`, formatBadge `3px` → `--radius-sm` | CSS modules updated |
| #10 | Select trigger radius inconsistent | VideoCard `qualityTrigger` `--radius-sm` → `--radius-md` (align SettingsDialog) | CSS module updated |
| #11 | Sidepanel no theme import + inline styles | Created `sidepanel/styles/global.css` (import theme.css), `App.module.css`, `CueList.module.css`. Migrated App.tsx + CueList.tsx sang CSS module. 0 inline styles. | Browser: sidepanel tokens resolve, dark mode works (`data-theme="dark"` → bg=#0f172a, text=#f1f5f9) |
| Token gap | Missing `--color-error-subtle`, `--color-warning-subtle` | Added to `theme.css` + `themeTokens.ts` (light + dark) | Browser: tokens resolve (`#ef444426`, `#f59e0b26`) |
| Typo | `[data-theme-Host="light"]` trong themeTokens.ts | Fixed → `[data-theme="light"], :root` | Browser: content-script inject tokens đúng, `hasTypo: false` |

## Browser verification (Edge MCP)

### Popup (`chrome-extension://.../popup/index.html`)
- **Tokens resolve**: `--color-error-subtle=#ef444426`, `--color-warning-subtle=#f59e0b26`, `--radius-full=9999px`, `--color-text-inverse=#0f172a`
- **IconButton atom**: 4 header buttons cùng class `_iconBtn _md _ghost`, size 32×32px, `border-radius: 6px` (=--radius-sm), `color: rgb(100, 116, 139)` (=--color-text-muted)
- **CSS rules exist**: `._ghost:hover` (bg=--color-surface-hover), `._danger:hover` (bg=--color-error-subtle), `._activePrimary` (bg=--color-primary-subtle), `._activeDanger` (bg=--color-error-subtle), `:focus-visible` (outline=--color-border-focus)
- **Header regression fixed**: extension toggle ON dùng `variant='ghost'` (text-muted), OFF dùng `variant='danger'` + `active` (error-subtle bg)

### Sidepanel (`chrome-extension://.../sidepanel/index.html`)
- **Tokens resolve (light)**: `--color-background=#fff`, `--color-text=#0f172a`, `--color-primary-subtle=#2563eb1a`, `--color-border=#e2e8f0`, `--font-family=Inter`
- **Dark mode works**: `data-theme="dark"` → `--color-background=#0f172a`, `--color-text=#f1f5f9`, `--color-primary-subtle=#60a5fa26`
- **0 inline styles**: `hasInlineStyles: 0` (toàn bộ CSS module)
- **CSS built separately**: `dist/assets/sidepanel-*.css` (3.95 kB) — token injection hoạt động

### Content-script (lordflix.org video page)
- **Tokens inject đúng**: `subtitle-theme-tokens` style el có `--color-error-subtle`, `--color-warning-subtle`
- **Typo fixed**: `hasTypo: false` (`[data-theme-Host]` → `[data-theme="light"], :root`)
- **Content-script load OK**: no `Failed to fetch dynamically imported module` errors (sau extension reload)

## Test results

- **Unit tests**: 1301/1302 pass (1 pre-existing fail `conversionTimer.test.ts` — không liên quan design-system)
- **CueList tests**: 6/6 pass (sau migrate `style.backgroundColor` → `data-current` attribute)
- **Typecheck**: `npx tsc --noEmit` pass (exit 0)
- **Lint**: 0 errors trong 12 files sửa (43 pre-existing errors trong files không touch)
- **Build**: `npm run build` pass (359ms, sidepanel CSS 3.95 kB)

## Files changed (Step 2-5)

### New files (4)
- `src/shared/ui/IconButton.tsx` — atom (47 lines)
- `src/shared/ui/IconButton.module.css` — atom styles (56 lines)
- `src/entrypoints/sidepanel/styles/global.css` — theme import + reset (43 lines)
- `src/entrypoints/sidepanel/App.module.css` — App layout (37 lines)
- `src/entrypoints/sidepanel/components/CueList.module.css` — CueList styles (42 lines)

### Modified files (12)
- `src/entrypoints/popup/styles/theme.css` — +`--color-error-subtle`, `--color-warning-subtle` (light + dark)
- `src/shared/lib/themeTokens.ts` — sync tokens + fix `[data-theme-Host]` typo
- `src/entrypoints/popup/components/layout/Header.tsx` — migrate 4 buttons sang IconButton
- `src/entrypoints/popup/components/layout/Header.module.css` — remove iconBtn/extDisabled/adActive
- `src/entrypoints/popup/components/SelectionBar.tsx` — migrate clearBtn sang IconButton
- `src/entrypoints/popup/components/SelectionBar.module.css` — remove clearBtn, `white` → `--color-text-inverse`
- `src/entrypoints/popup/components/media/VideoCard.tsx` — migrate expandBtn sang IconButton
- `src/entrypoints/popup/components/media/VideoCard.module.css` — remove expandBtn, qualityTrigger `--radius-sm` → `--radius-md`
- `src/entrypoints/popup/components/media/SubtitleCard.tsx` — migrate expandBtn sang IconButton
- `src/entrypoints/popup/components/media/SubtitleCard.module.css` — remove expandBtn, `rgba(245,158,11,0.1)` → `--color-warning-subtle`
- `src/entrypoints/popup/components/media/DownloadCard.tsx` — migrate 5 action buttons sang IconButton
- `src/entrypoints/popup/components/media/DownloadCard.module.css` — remove actionBtn/danger, card `--radius-md` → `--radius-lg` + `:hover`, `rgba(239,68,68,0.04/0.08)` → `--color-error-subtle`
- `src/features/settings/ui/SettingsDialog.tsx` — migrate 3 buttons sang IconButton
- `src/features/settings/ui/SettingsDialog.module.css` — remove iconBtn/iconBtnSm/asActive, `border-radius: 6px` → `--radius-sm`
- `src/features/settings/ui/MultiSelect.module.css` — badge `10px` → `--radius-full`, sectionCount `8px` → `--radius-sm`, `white` → `--color-text-inverse`
- `src/features/settings/ui/SubtitleStylePanel.module.css` — `--color-danger` → `--color-error`, `--color-primary-alpha` → `--color-primary-subtle`, `white` → `--color-text-inverse`
- `src/features/subtitle/ui/subtitleManagerPanel.ts` — add mouseenter/mouseleave hover, formatBadge `3px` → `--radius-sm`, `rgba(245,158,11,0.1)` → `--color-warning-subtle`, `white` → `--color-text-inverse`
- `src/entrypoints/sidepanel/App.tsx` — rewrite sang CSS module
- `src/entrypoints/sidepanel/components/CueList.tsx` — rewrite sang CSS module + `data-current` attribute
- `src/entrypoints/sidepanel/main.tsx` — import `global.css`
- `src/entrypoints/sidepanel/index.html` — remove inline `<style>` reset
- `tests/unit/entrypoints/sidepanel/CueList.test.tsx` — `style.backgroundColor` → `data-current` attribute

## Known limitations

1. **Manager icon hover**: verify bằng code review (icon chỉ render khi video active + subtitle detected). Browser verify không trigger được vì popup standalone không có active tab context.
2. **Pre-existing test fail**: `conversionTimer.test.ts` (1 test) — không liên quan design-system, pre-existing.
3. **Pre-existing lint errors**: 43 errors trong files không touch (tests, transmuxer, storage) — pre-existing.
4. **Lint rule (ban raw hex/rgba)**: skipped — solo project, drift-audit-checklist.md đã đủ cho human review.

## Next steps

- [ ] Commit design-system fix pass (atomic: code commit + docs commit)
- [ ] Update `docs/2-architechture-system.md` (add `src/shared/ui/IconButton.tsx` + sidepanel CSS modules)
- [ ] Update `docs/0-wiki.md` (add drift audit report)
