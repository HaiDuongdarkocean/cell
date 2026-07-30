# Plan 12 Subagent Execution — Atom Showcase Fix

> Phân bổ 12 subagent theo 3 wave để thực hiện 6 phase trong `plan-verify-atoms-showcase.md`.
> Nguyên tắc: Phase 1 (Token SSOT) phải xong trước hết → Wave 2 fix atoms song song theo nhóm không xung đột file → Wave 3 showcase descriptions + verify.

---

## Dependency Analysis

```
Phase 1 (Token SSOT) ──┬──> Phase 2 (Critical atoms: Avatar, Box, WordChip, Toggle)
                       ├──> Phase 3 (Known visual: VolumeControl, CaptionToggle, LanguageSelector, EmptyState)
                       ├──> Phase 4 (Size props: 16 atoms)
                       └──> Phase 5 (Token compliance: 7 atoms)

Phase 2-5 ─────────────┬──> Phase 6 (Showcase descriptions)
                       └──> Final verification (build + typecheck + test)
```

**Key constraint**: Phase 1 phải xong TRƯỚC vì tất cả atom fixes cần tokens mới (avatar-size, shadow-inset-hover, color-track, color-text-accent, size-element-sm/md/lg, leading-h1/h2/h3, duration-fast, ease-standard...).

**File conflict avoidance**: Mỗi subagent trong Wave 2 sở hữu một tập atom riêng — không overlap file.

---

## Wave 1 — Token SSOT (1 subagent, foreground, blocking)

> **Chạy trước, chờ xong mới chạy Wave 2.**
> Nền tảng cho mọi fix khác.

### SA1: Token SSOT vs daft.md

**Scope**: Sửa `src/shared/styles/tokens.json` + regenerate `tokens.css`/`tokens.ts`.

**Tasks**:
1. Sửa 12 color values sai (section 1.1):
   - `--color-text-secondary` light: `#525252` → `#737373`
   - `--color-border`: `#d4d4d4`/`#525252` → `#00000014`/`#FFFFFF1A`
   - `--color-accent`: `#f1f5f9`/`#334155` → `#262626`/`#ebebeb`
   - `--color-success-muted`, `--color-error-muted`, `--color-warning-muted` → daft.md values
   - `--color-on-warning` → `#171717`/`#171717`
   - `--color-overlay`, `--color-overlay-hover`, `--color-overlay-pressed` → exact hex (not color-mix)
   - `--color-background-card`: light=surface, dark=background
   - `--color-background-popover`: light=surface, dark=background

2. Thêm 12 missing core color tokens (section 1.2):
   - `--color-accent-muted`, `--color-on-accent`, `--color-neutral`
   - `--color-background-inverted`, `--color-background-error-inverted`
   - `--color-text-accent`, `--color-on-dark`, `--color-on-light`
   - `--color-icon-accent`, `--color-track`, `--color-shadow`, `--color-tint-hover`

3. Thêm 8 semantic type tokens (section 1.4):
   - `--text-heading-4/5/6`, `--text-display-1/2/3`, `--text-large`, `--text-code`
   - Thêm precise line-height tokens: `--leading-h1: 1.3333`, `--leading-h2: 1.4`, `--leading-h3: 1.4118`, `--leading-body: 1.4286`, `--leading-label: 1.4286`, `--leading-supporting: 1.6667`

4. Sửa motion tokens (section 1.5):
   - Thêm 9 duration tokens: `--duration-fast-min/max`, `--duration-medium-min/medium/max`, `--duration-slow-min/slow/max`
   - Sửa `--duration-fast`: 150ms → 175ms
   - Sửa `--ease-standard`: `ease` → `cubic-bezier(0.24, 1, 0.4, 1)`

5. Thêm shadow tokens (section 1.6):
   - `--shadow-low`, `--shadow-med`, `--shadow-high` (rename or alias existing floating/popover/modal)
   - `--shadow-inset-hover`, `--shadow-inset-selected`, `--shadow-inset-success`, `--shadow-inset-warning`, `--shadow-inset-error`

6. Thêm size + spacing tokens (section 1.7):
   - `--size-element-sm: 28px`, `--size-element-md: 32px`, `--size-element-lg: 36px`
   - `--spacing-14: 56px`

7. Thêm avatar size tokens (section 2.1):
   - `--avatar-size-xs: 24px`, `--avatar-size-sm: 32px`, `--avatar-size-md: 40px`, `--avatar-size-lg: 56px`
   - `--avatar-status-dot: 10px`

8. Fix radius circular references (section 1.8):
   - `--radius-element` (derived) → direct `12px` (not `var(--radius-pill)`)
   - `--radius-container` (derived) → direct `16px` (not `var(--radius-card)`)
   - `--radius-page` (derived) → direct `32px` (not `var(--radius-2xl)`)

9. Defer tint/data/syntax colors (section 1.3) — 65 tokens, chưa dùng ngay. Ghi TODO.

10. Run `npm run build` to regenerate `tokens.css`/`tokens.ts`.

**Files touched**: `src/shared/styles/tokens.json` (only).
**Profile**: `subagent_general` (write access).
**Blocking**: YES — Wave 2 chờ SA1 xong.

---

## Wave 2 — Atom Fixes (8 subagent, background, song song)

> **Chạy sau khi SA1 hoàn thành.**
> Mỗi subagent sở hữu một tập atom riêng — KHÔNG overlap file.
> Merge Phase 2+3+4+5 cho mỗi atom group.

### SA2: Generic Core Fixes (3 atoms)

**Atoms**: Avatar, Button, Toggle
**Files**: `src/shared/ui/Avatar.{tsx,module.css,showcase.tsx}`, `src/shared/ui/Button.module.css`, `src/shared/ui/Toggle.tsx`

**Tasks**:
1. **Avatar** (CRITICAL): Replace 5 hardcoded pixel values với tokens:
   - `24px` → `var(--avatar-size-xs)`
   - `32px` → `var(--avatar-size-sm)`
   - `40px` → `var(--avatar-size-md)`
   - `56px` → `var(--avatar-size-lg)`
   - `10px` (status dot) → `var(--avatar-status-dot)`
2. **Button** (MINOR): Change `scale(0.98)` → `scale(0.97)` at 5 locations (lines 64, 79, 96, 111, 126)
3. **Toggle** (MAJOR): Change `aria-pressed={checked}` → `role="switch" aria-checked={checked}` (line 45)

**Profile**: `subagent_general`

---

### SA3: Layout Fixes A (5 atoms)

**Atoms**: Spinner, Progress, Kbd, Box, Container
**Files**: `src/shared/ui/{Spinner,Progress,Kbd,Box,Container}.{tsx,module.css,showcase.tsx}`

**Tasks**:
1. **Spinner** (MAJOR):
   - Add size variants: 2xs, xs, xl (total 6: 2xs/xs/sm/md/lg/xl)
   - Change size mapping: `--space-*` → `--font-size-*`
   - Add `ariaLabel?: string` prop (default "Loading")
   - Change `aria-hidden="true"` → `role="status" aria-label={ariaLabel}`
2. **Progress** (MAJOR):
   - Track: `--color-muted` → `--color-track`
   - Fill: `--color-primary` → `--color-accent` (accent variant)
   - Add circular variant (SVG implementation)
3. **Kbd** (MAJOR):
   - Add `size?: 'sm' | 'md'` prop
   - bg: `--color-surface` → `--color-background-muted`
   - radius: `--radius-sm` → `--radius-inner`
   - font-size: `--font-size-base` → `--font-size-xs` (sm) / `--font-size-sm` (md)
   - shadow: custom rgba → `--shadow-inset-hover`
4. **Box** (MAJOR): `--color-background-inverted` now exists from SA1 — verify it works
5. **Container** (MINOR): Add `--container-max-width-sm/md/lg/xl` tokens OR document as acceptable

**Profile**: `subagent_general`

---

### SA4: Layout Fixes B (3 atoms)

**Atoms**: Link, Overlay, Section
**Files**: `src/shared/ui/{Link,Overlay,Section}.{tsx,module.css,showcase.tsx}`

**Tasks**:
1. **Link** (MAJOR):
   - Rename variants: `default|subtle|destructive` → `inline|standalone`
   - inline: always underline; standalone: no underline, hover underline
   - Default color: `--color-primary` → `--color-text-accent`
   - Add `disabled` prop + styling
   - Add external icon when `external=true`
2. **Overlay** (MAJOR):
   - Rename prop: `open` → `visible`
   - Add `elevation?: 'low' | 'med' | 'high'` with z-index mapping
   - Add `blur?: boolean` with backdrop-filter
   - Add enter/exit animations
   - Add `onKeyDown Escape` handler
3. **Section** (MAJOR):
   - Add `as?: 'section' | 'article' | 'main' | 'aside' | 'header' | 'footer' | 'nav'`
   - Rename `size` → `padding` (SpacingToken)
   - Add `gap?: SpacingToken`
   - Add `ariaLabel`, `ariaLabelledBy` props

**Profile**: `subagent_general`

---

### SA5: Extension Fixes A (5 atoms)

**Atoms**: IconButton, CloseButton, CopyButton, DragHandle, ResizeHandle
**Files**: `src/shared/ui/{IconButton,CloseButton,CopyButton,DragHandle,ResizeHandle}.{tsx,module.css,showcase.tsx}`

**Tasks**:
1. **IconButton** (MAJOR): Add `solid`, `outline`, `transparent` variants (currently only ghost, danger)
2. **CloseButton** (MAJOR): Add `solid` variant (currently only ghost)
3. **CopyButton** (MINOR): No code fix needed — verify implementation correct
4. **DragHandle** (MAJOR):
   - Add `orientation?: 'horizontal' | 'vertical'` prop
   - Add `size?: 'sm' | 'md' | 'lg'` prop
5. **ResizeHandle** (MINOR):
   - Add `size?: 'sm' | 'md'` prop
   - 8-direction support: defer (horizontal/vertical sufficient for extension)

**Profile**: `subagent_general`

---

### SA6: Extension Fixes B (6 atoms)

**Atoms**: PinButton, BackButton, InfoButton, CollapseButton, MinimizeButton, MaximizeButton
**Files**: `src/shared/ui/{PinButton,BackButton,InfoButton,CollapseButton,MinimizeButton,MaximizeButton}.{tsx,module.css,showcase.tsx}`

**Tasks** (all MAJOR — missing size prop):
1. **PinButton**: Add `size?: 'sm' | 'md' | 'lg'`
2. **BackButton**: Add `size?: 'sm' | 'md' | 'lg'`
3. **InfoButton**: Add `variant?: 'ghost' | 'outline'` + `size?: 'sm' | 'md' | 'lg'`
4. **CollapseButton**: Add `direction?: 'horizontal' | 'vertical'` + `showLabel?: boolean`
5. **MinimizeButton**: Add `variant?: 'ghost' | 'outline'` + `size?: 'sm' | 'md' | 'lg'`
6. **MaximizeButton**: Add `size?: 'sm' | 'md' | 'lg'`

**Profile**: `subagent_general`

---

### SA7: Domain Video + Subtitle Fixes (4 atoms)

**Atoms**: VolumeControl, CaptionToggle, LanguageSelector, EmptyState
**Files**: `src/shared/domain/video/atoms/VolumeControl.{tsx,module.css,showcase.tsx}`, `src/shared/domain/subtitle/atoms/CaptionToggle.{tsx,module.css,showcase.tsx}`, `src/shared/domain/subtitle/atoms/LanguageSelector.{tsx,module.css,showcase.tsx}`, `src/shared/ui/EmptyState.{tsx,module.css,showcase.tsx}`

**Tasks**:
1. **VolumeControl** (MAJOR — known issue):
   - Slider thumb: 12px → 8px (`var(--space-2)`)
   - Slider width: 80px → 48-56px (`var(--space-12)`)
2. **CaptionToggle** (MAJOR — known issue):
   - Width: `calc(var(--touch-target) * 1.8)` (72px) → `calc(var(--touch-target) * 1.2)` (48px)
3. **LanguageSelector** (MAJOR — known issue):
   - Refactor from native `<select>` to use generic Select component
   - Style dropdown options per Astryx pattern
4. **EmptyState** (MAJOR — redesign):
   - Icon 48px with `--color-text-secondary`
   - Title (heading-3 scale)
   - Description (body, `--color-text-secondary`)
   - Optional action button
   - Centered layout
   - `role="status"` for screen readers

**Profile**: `subagent_general`

---

### SA8: Domain Dictionary Fixes (5 atoms)

**Atoms**: PhoneticText, PartOfSpeechTag, SynonymChip, AntonymChip, SourceBadge
**Files**: `src/shared/domain/dictionary/atoms/{PhoneticText,PartOfSpeechTag,SynonymChip,AntonymChip,SourceBadge}.{tsx,module.css,showcase.tsx}`

**Tasks** (all MAJOR — missing size prop):
1. **PhoneticText**: Add `size?: 'sm' | 'md' | 'lg'` with `--font-size-sm|base|lg`
2. **PartOfSpeechTag**: Add `size?: 'sm' | 'md'` with `--font-size-2xs|xs`
3. **SynonymChip**: Add `size?: 'sm' | 'md'` (adjust padding/font-size)
4. **AntonymChip**: Add `size?: 'sm' | 'md'` (adjust padding/font-size)
5. **SourceBadge**: Add `size?: 'sm' | 'md'` with `--font-size-2xs|xs`

**Profile**: `subagent_general`

---

### SA9: Domain Learning + Display Fixes (3 atoms)

**Atoms**: WordChip, StatusDot, Heading
**Files**: `src/shared/domain/learning/atoms/WordChip.{tsx,module.css,showcase.tsx}`, `src/shared/ui/StatusDot.{tsx,module.css,showcase.tsx}`, `src/shared/ui/Heading.{tsx,module.css,showcase.tsx}`

**Tasks**:
1. **WordChip** (MAJOR):
   - Fix hover token: `--color-accent` → `--color-surface-hover` (line 42)
   - Add `size?: 'sm' | 'md'` prop
2. **StatusDot** (MINOR):
   - Add `size?: 'sm' | 'md'` prop (sm=8px, md=10px)
3. **Heading** (MINOR):
   - Fix line-heights: H1 → `--leading-h1`, H2 → `--leading-h2`, H3 → `--leading-h3`
   - Add H4-H6 using `--text-heading-4/5/6` composite tokens
   - Add Display 1-3 variants

**Profile**: `subagent_general`

---

## Wave 3 — Showcase Descriptions + Verify (3 subagent, sau Wave 2)

> **Chạy sau khi tất cả SA2-SA9 hoàn thành.**
> Thêm description text vào showcaseMeta + final build verification.

### SA10: Showcase Descriptions — Generic Core + Layout (22 showcases)

**Scope**: 10 Generic Core + 12 Layout + Utility showcases
**Files**: `src/shared/ui/{Button,Input,Label,Text,Icon,Badge,Checkbox,Toggle,Avatar,Separator,Box,Flex,Grid,Stack,Container,AspectRatio,Spinner,Progress,Link,Kbd,Overlay,Section}.showcase.tsx`

**Tasks**:
1. Thêm `description` field vào `showcaseMeta` cho 22 showcases
2. Thêm hover state demos (Button, Input, Checkbox, Toggle)
3. Thêm disabled state demos (IconButton, Chip)
4. Thêm missing variant demos (Flex wrap, Grid inline/rows, AspectRatio 4:3/3:2/1:2)

**Profile**: `subagent_general`

---

### SA11: Showcase Descriptions — Display + Extension (19 showcases)

**Scope**: 7 Display + 12 Extension showcases
**Files**: `src/shared/ui/{Heading,Thumbnail,Timestamp,Blockquote,Citation,Code,StatusDot,IconButton,Chip,CloseButton,CopyButton,DragHandle,ResizeHandle,PinButton,BackButton,InfoButton,CollapseButton,MinimizeButton,MaximizeButton}.showcase.tsx`

**Tasks**:
1. Thêm `description` field vào `showcaseMeta` cho 19 showcases
2. Thêm missing variant demos (Heading Display 1-3, Thumbnail loading/error, IconButton disabled, etc.)

**Profile**: `subagent_general`

---

### SA12: Final Verification (build + typecheck + test + showcase)

**Scope**: Toàn bộ project
**Tasks**:
1. Run `npm run typecheck` — verify no TS errors
2. Run `npm run test:unit` — verify all tests pass
3. Run `npm run build` — verify build pass + tokens regenerated
4. Run `npx vite build --mode development` — verify dev build pass
5. Check showcase at `http://localhost:8123/design-system-showcase.html`:
   - Light/dark mode toggle works
   - All atoms render correctly
   - No console errors
6. Report any remaining issues

**Profile**: `subagent_general`

---

## Execution Flow

```
Wave 1 (blocking):
  SA1: Token SSOT ──────────────────────────> [wait for completion]
                                                │
Wave 2 (parallel, 8 agents):                    ▼
  SA2: Generic Core ──────┐
  SA3: Layout A ──────────┤
  SA4: Layout B ──────────┤
  SA5: Extension A ───────┼──> [all 8 must complete]
  SA6: Extension B ───────┤       │
  SA7: Domain Video+Sub ──┤       │
  SA8: Domain Dictionary ─┤       │
  SA9: Domain Learn+Disp ─┘       │
                                   ▼
Wave 3 (parallel, 3 agents):
  SA10: Showcase Desc A ───┐
  SA11: Showcase Desc B ───┼──> [all 3 must complete]
  SA12: Final Verify ──────┘
```

## Summary Table

| Wave | Subagent | Phase | Atoms/Scope | Files | Profile |
|------|----------|-------|-------------|-------|---------|
| 1 | SA1 | Phase 1 | Token SSOT | tokens.json | general (foreground) |
| 2 | SA2 | Phase 2+5 | Avatar, Button, Toggle | 5 | general |
| 2 | SA3 | Phase 4+5 | Spinner, Progress, Kbd, Box, Container | 10 | general |
| 2 | SA4 | Phase 4+5 | Link, Overlay, Section | 6 | general |
| 2 | SA5 | Phase 4+5 | IconButton, CloseButton, CopyButton, DragHandle, ResizeHandle | 10 | general |
| 2 | SA6 | Phase 4+5 | PinButton, BackButton, InfoButton, CollapseButton, MinimizeButton, MaximizeButton | 12 | general |
| 2 | SA7 | Phase 3 | VolumeControl, CaptionToggle, LanguageSelector, EmptyState | 8 | general |
| 2 | SA8 | Phase 4 | PhoneticText, PartOfSpeechTag, SynonymChip, AntonymChip, SourceBadge | 10 | general |
| 2 | SA9 | Phase 4+5 | WordChip, StatusDot, Heading | 6 | general |
| 3 | SA10 | Phase 6 | 22 showcase descriptions | 22 | general |
| 3 | SA11 | Phase 6 | 19 showcase descriptions | 19 | general |
| 3 | SA12 | Verify | Build + typecheck + test + showcase | — | general |

**Total**: 12 subagent, ~113 file changes, 3 waves.
