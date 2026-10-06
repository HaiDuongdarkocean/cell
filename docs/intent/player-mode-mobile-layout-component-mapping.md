# Component Mapping — Player Mode mobile layout (<600px)

> Brief: `docs/intent/player-mode-mobile-layout-design-brief.md` · Elements deconstructed từ `docs/mockups/player-mode-mobile-layout.png`
> Token names theo leaf của `tokens.json` (vd `spacing-4` = CSS var space-4).

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Bottom bar container | Flex | create (layout region `pm-bottom-bar` trong `PlayerModeOverlay.module.css` — region CSS, không phải shared component mới) | `touchTarget-mobile`, `spacing-2`, `spacing-3`, `color-border-subtle` | — |
| Exit button | Button | reuse (`player-mode-exit-btn` — `variant="ghost"` size md) | `text-secondary`, `touchTarget-mobile` | `x` |
| Transport group (prev/repeat/next) | Button | reuse (`variant="primarySubtle"` size lg circle; ids `nav-prev`/`nav-repeat`/`nav-next`; wrapper giữ `nav-cluster`; icon `iconbutton-icon-lg` 24px) | `touchTarget-mobile`, `primary`, `color-primary-subtle` | `chevronLeft`, `rotateCcw`, `chevronRight` |
| Rewind/forward (adaptive swap) | Button | reuse (`nav-rewind`/`nav-forward` khi cues=0 — cùng `primarySubtle`) | `primary`, `color-primary-subtle` | `navRewind`, `navForward` |
| Hero play/pause | Button | reuse (`variant="warningSubtle"` size xl → 64px `spacing-16`; icon `iconbutton-icon-xl` 28px) | `color-warning`, `color-warning-subtle`, `shadow-floating`, `radius-full`, `spacing-16` | `play`, `pause` |
| ⋯ trigger | Button | reuse (`pm-more-btn` — `variant="ghost"` size md) | `text-secondary` | `ellipsis` |
| ⋯ menu surface + items | Menu | reuse (canonical `Menu`/`MenuItem`/`MenuSeparator` exports; `align="right"`; radio items cho study modes + speed) | internal Menu | `navRewind`, `navForward`, `sidePanel`, `scanText`, `captions`, `bookOpen`, `gauge` |
| Card rail container | Flex | create (region `pm-card-actions` — absolute mép phải active card, overlap edge; nằm trong card element) | `spacing-3`, `spacing-6` | — |
| Quick-add FAB | Button | reuse (`variant="primarySubtle"` size md; trong active card) | `primary`, `color-primary-subtle`, `shadow-floating` | `zap` |
| Edit-card FAB | Button | reuse (`variant="errorSubtle"` size md; trong active card) | `color-error`, `color-error-subtle` | `pencil` |
| Floating rail container | Flex column | create (region `player-mode-actions` — absolute mép phải anchor band; filter trên card peek, generate ngang hàng CC; `pointer-events:none` trên container, `auto` trên nút) | `spacing-3` | — |
| Cue-filter FAB | Button | reuse — feature `CueRecommendFab` portal vào `pm-fab-slot` (SubtitlePanel `createPortal`; state giữ trong panel) | internal fab | `slidersHorizontal` |
| Generate FAB | Button | reuse (`variant="neutralSubtle"` size md) | `color-tint-gray-background`, `color-tint-gray-icon` | `generateNative` |
| Anchor band (floating) | Flex | create (region `pm-anchor-band` — absolute đè đáy `pm-cue-wrap`, **trong suốt hoàn toàn**; `pm-cue-region` scrollable có `mask-image` fade đáy; `pointer-events:none` trừ CC/pill/rail) | `spacing-6`, `spacing-16`, `spacing-8` | — |
| Manager/CC button | Button | reuse (`manager-toggle-btn` — `variant="neutralSubtle"` size lg 48px; glyph `captions` thay `subtitleManager` cho khớp mẫu) | `color-tint-gray-background`, `color-tint-gray-icon` | `captions` |
| Track caption | Text | create (span + prop `trackLabel`; căn giữa, primary) | `sizes-sm`, `primary`, `weights-medium` | — |
| Comprehension pill | Chip | extend — feature `ComprehensionPill` không đổi JSX; thêm `:host-context` rule trong `ComprehensionPill.module.css`, offset qua custom var pmAnchorBottom (không phải token mới — runtime var do PM set) | `color-success-subtle`, `success` | internal |
| Cue cards | Card | extend — `CueList` item render variant khi panel `barebones` trong PM mobile: mọi card `surface` + `radius-2xl` (không transparent), active `border 4px primary` + `surface-elevated`; footer time+icons gọn trái; panel chrome (header, StudyModeActionBar) ẩn; scroll region **scrollable** (touch/wheel, auto-follow + desync pill) + `mask-image` fade đáy | `radius-2xl`, `spacing-4`, `spacing-3`, `surface`, `color-surface-elevated`, `primary`, `sizes-xl`, `font-size-sm` … leaf `sizes-sm` | `pin`, `layers` |
| Orbital badge | Avatar | reuse — feature `OrbitalBadge` không đổi; layout chừa dead-zone | — | — |

## Notes

- "create" = region CSS trong `PlayerModeOverlay.module.css`, KHÔNG tạo shared component mới — không archetype mới cần shared.
- `playerModeGeometry.ts`: mobile dock height → compact bar (`touchTarget-mobile` + paddings + anchorRow auto).
- bottomBar `padding-bottom` += `env(safe-area-inset-bottom)`.
