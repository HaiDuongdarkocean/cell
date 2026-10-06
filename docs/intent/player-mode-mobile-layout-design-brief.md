# Design Brief — Player Mode mobile layout (<600px)

> Spec: `docs/specs/player-mode-mobile-layout.md` · Reference: `docs/mockups/player-mode-mobile-layout.png` (user-provided, 14 vùng)
> Mockup site: `src/entrypoints/mockup-player-mode-mobile-layout/` · Evidence: `tmp/player-mode-mobile-layout/*.png`

## Design Read

Mobile Player Mode trở thành **reading-first layout**: video trên, cue cards là bề mặt đọc chính, transport gọn ở bar đáy, mọi nút phụ tách thành rail phải + ⋯ menu — không còn dock 14 nút đè subtitle.

## Function audit

| Function | Class | Why |
|---|---|---|
| Play/pause, prev/next cue, repeat | `must-have` | transport lõi — bottomBar |
| Exit Player Mode | `must-have` | bar trái, 1 chạm |
| Quick Add, Send to Card Creator | `must-have` | study actions tần suất cao — rail top |
| Cue filter, Generate subtitle | `must-have` | contextual — rail bottom |
| Subtitle Manager, comprehension pill, track caption | `must-have` | status surfaces — anchorRow |
| Cue-list toggle, OCR, study modes, speed, practice | `merge` | ⋯ menu |
| Rewind/forward | `adaptive swap` | KHÔNG vào ⋯ — thay prev/next trên bar khi cues=0 |
| Subtitle running text trong dock | `remove` | cuelist đã hiển thị (user decision) |
| `tools-toggle`/`subtitle-tools-extra` group | `remove` (mobile only) | group giải thể → items rải rail/⋯ |

Primary job: **đọc + điều hướng cue trên mobile PM** — 1 tay, video vẫn tap được.

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Vào PM | `g` / player-mode-btn | stack render video→cues→anchor→bar | overlay |
| 2 | Đọc subtitle | cue cards (no scroll — system auto-position) | active card accent border, auto-follow | cueRegion |
| 3 | Study action | tap rail FAB | quick-add/edit-card/filter/generate | actionRail |
| 4 | Transport | tap bar | adaptive prev/next↔rewind/forward | bottomBar |
| 5 | Action phụ | tap ⋯ | Menu (list toggle, OCR, modes, speed) | pm-more-menu |
| 6 | Mật độ đọc | đổi trong Manager | list↔active card mode live | cueRegion |
| Edge | no cues | — | bar swap rewind/forward, EmptyState | bar+cueRegion |
| Edge | practiceMode | — | region = practice session | cueRegion |
| Edge | `t` / ⋯ hide list | — | region collapse, video fills | cueRegion |

## Dials

| Dial | Baseline | Chosen |
|---|---|---|
| DESIGN_VARIANCE | 3 (giữ dock) | **8** — phá dock, bố cục mới hoàn toàn (user: "thay đổi toàn quyền") |
| MOTION_INTENSITY | 2 | **2** — không animation mới; `prefers-reduced-motion` tôn trọng |
| VISUAL_DENSITY | 4 | **6** — rail+bar compact nhưng vùng đọc thoáng (card radius lớn, padding space-4) |

## Chosen concept — "Reading Deck" (user-provided mockup, single justified variant)

- **IA mental model:** deck thẻ cue — video là stage, cue cards là nội dung, controls là khung xung quanh.
- **Non-digital reference:** bento box — 1 món chính (cue cards), ngăn nhỏ bên (rail), đế hộp (bar).
- **Material/surface:** solid dark `color-background`; mọi card `color-surface` + `radius-2xl`; active card `border: 4px color-primary` + `surface-elevated` + `shadow-floating`; video inset `space-3` + `radius-2xl`.
- **Typography:** active cue target `font-size-xl`/`font-weight-semibold`, native `font-size-base`/`color-text-secondary`; context cards `font-size-lg`; timestamps `font-size-xs` + icons **gọn trái** cùng hàng (không space-between); caption `Subtitles: <label>` căn giữa, `color-primary`.
- **Layout (mockup-exact):** `pmCueWrap` (relative) > `pmCueRegion` (**scrollable** — user cuộn được bằng touch/wheel, system vẫn auto-follow active cue và hiện sync pill khi user cuộn rời; `mask-image` fade đáy — card tan dần khi vào vùng band) + `pmAnchorBand` (sibling, **trong suốt hoàn toàn**, card xuyên thấu); quick-add + edit-card = rail dọc in-flow bên phải text trong active card (`pm-card-actions` — không absolute, card tự cao theo rail); cue-filter + generate = cột dọc mép phải band (filter trên card peek, generate ngang hàng CC — `player-mode-actions`); CC = `neutralSubtle` size lg (48px), pill căn giữa (spacer đối xứng = `iconbutton-size-lg`); mọi nút = `Button` shared; rail filter/generate = `neutralSubtle` md (40px); hero play = `warningSubtle` xl 64px; X + ⋯ = `ghost` md (icon trần như mẫu). **Icon-in-button scale (DS)**: `iconbutton-icon-{xs,sm,md,lg,xl}` = 16/18/20/24/28 (~50–57% container — M3/HIG-aligned, trước flat 18px); glyphs bare: prev=`chevronLeft`, repeat=`rotateCcw` (↺ — khớp mẫu), hero=`play`/`pause`, next=`chevronRight`, CC=`captions`.
- **Motion signature:** none new.
- **Why it fits:** trực tiếp từ mockup user approve; mọi vùng đánh số 1–14 có chỗ.
- **Risk:** card-rail FABs overlap mép phải card → cần `padding-right` cueRegion ≥ rail width; pill reposition qua `:host-context` (spec REQ-4).
- **Deviation từ mockup (user-approved direction):** mọi nút = **`Button` subtle-family** (DS mở rộng: `primarySubtle`/`successSubtle`/`warningSubtle`/`errorSubtle`/`neutralSubtle`) — đúng cặp `comprehension-pill`: bg = `*-subtle`/`tint-*-background` của gốc, fg = **root nguyên màu, không pha**. quick-add+transport = `primarySubtle`, edit-card = `errorSubtle`, hero = `warningSubtle`, filter/generate/CC = `neutralSubtle`, X/⋯ = `ghost` (icon trần theo mẫu), pill = `success` family (exemplar). States (hover/press/focus/disabled/loading/active) dùng sẵn của Button — không override.

## Contrast plan (dark theme, PM overlay surface `#0F0F0F`/`#212121`)

| Element | FG | BG | Ratio check |
|---|---|---|---|
| Cue target text | `color-text` #F1F1F1 | `color-surface` #212121 | ~15:1 ✅ |
| Native/footer text | `color-text-secondary` #AAAAAA | `color-surface` | ~7:1 ✅ |
| Active card border | `color-primary` #8C94E7 | bg | đủ tương phản viền ✅ |
| Quick-add FAB (`primarySubtle`) | `color-primary` thuần | `color-primary-subtle` | pill pair ✅ |
| Edit-card FAB (`errorSubtle`) | `color-error` thuần | `color-error-subtle` | ✅ |
| Filter/generate/CC (`neutralSubtle`) | `color-tint-gray-icon` | `color-tint-gray-background` | ✅ |
| X/⋯ (`ghost`) | `text-secondary` | transparent | ✅ |
| Transport prev/repeat/next (`primarySubtle`) | `color-primary` thuần | `color-primary-subtle` | ✅ |
| Hero play (`warningSubtle`) | `color-warning` thuần | `color-warning-subtle` | ✅ |
| Track caption | `color-primary` | `color-background` | ~5.6:1 ✅ |
| Pill | `color-success` #5FD389 | `color-success-subtle` | ✅ |

Light mode verified bằng screenshot — tokens tự flip.

## States

default (cues>0, list mode) · no-cues (bar swap + EmptyState) · active-only mode (single card; gap → next-upcoming dimmed; none → EmptyState) · cueList hidden (`t`/⋯ → region collapse) · practiceMode (region = session UI) · menu open · pill absent (row vẫn CC+caption) · small-height ≤568px (bar+row hide, giữ rule cũ) · safe-area bottom padding.

## Responsive table

| Width | Behavior |
|---|---|
| 320–599 | layout mới (stack + rail + bar) |
| 600–1279 | desktop PM hiện tại — không đổi |
| ≥1280 | như trên |

## Anti-patterns avoided

- Không invent UI mới: ⋯ dùng canonical Menu; icon từ catalog; tokens only.
- Rail `pointer-events:none` trên container, `auto` trên nút — không nuốt tap video/panel.
- Không gradient/màu rời ngoài tokens.
