# UI-Contract — Muji Redesign (Options + Popup + Tokens)

> Phase 1 output of `02_design-driven-development`. Approval gate before Phase 2 (code).
> Input: `docs/intent/intent-muji-redesign.md`
> Screens in scope: **options page** + **popup** + **design system tokens**.
> Out of scope: content-script DOM injection (subtitle overlay, download button, drag-drop) — phase sau.

---

## Step 1 — Intent read

Reading this as `settings + tool popup` for `single-dev self-use`, `calm neutral Muji` language, leaning `minimalist-ui`.

## Step 2 — Three dials

| Dial | Value | Reason |
|---|---|---|
| VARIANCE | 3 | Muji = near-zero variance. One layout family per screen. |
| MOTION | 2 | Subtle, 200ms cubic-bezier. No decorative motion. |
| DENSITY | 4 | Airy. Whitespace > density. Settings readable, not packed. |

## Step 3 — Audit (existing UI, 8 axes)

### Typography
- Inter as default → ban (anti-slop). Switch to system stack `-apple-system, 'Segoe UI', sans-serif`.
- Popup section title `text-transform: uppercase` + `letter-spacing: 0.06em` → Muji doesn't uppercase. Remove transform, keep weight 600.
- Em-dash in ResourcesPanel success `Đã import "..." — ${wordCount} mục` → replace with colon.

### Color & surfaces
- `--color-primary: #2563eb` blue → drop. Neutral `#0f172a` light / `#f1f5f9` dark.
- `--color-background: #ffffff` pure → warm bone `#FAFAF9` light. Dark `#0f172a` keep (off-black OK).
- `--shadow-md: 0 4px 12px rgba(0,0,0,0.08)` pure black → tint to bg hue `rgba(15,23,42,0.06)`.
- Popup `border-radius: var(--radius-lg)` 12px → Muji uses 8px max. Drop `--radius-lg`.

### Layout
- Options: tab ngang phẳng → sidebar trái fixed 220px + content phải.
- Popup: 480x600 fixed → keep (chrome popup constraint). Internal padding tăng từ 16px → 20px.
- Options max-width 900px → tăng 960px (sidebar 220 + content 740).

### Interactivity & states
- `--transition: 150ms ease` → `200ms cubic-bezier(0.16, 1, 0.3, 1)`.
- Focus ring `--color-border-focus: #2563eb` → neutral. `--color-border-focus: var(--color-text)` light / `var(--color-text)` dark, 2px solid, 3:1 contrast.
- No hover bg shift on text buttons → add `var(--color-surface-hover)` subtle.

### Content
- "Video Downloader" title → keep (product name, not AI cliche).
- "Select All" / "Download All" / "Deselect All" → keep, plain.
- "Oops!" / exclamation → none present, good.

### Component patterns
- Generic card (border + shadow + white) for ResourceCard, VideoCard, DownloadCard → Muji: remove shadow, border hairline 1px only. Elevation = spacing, not shadow.
- SettingsDialog modal → keep modal but minimal: no shadow-md, border 1px + radius 8px.
- IconButton ghost/danger variants → Muji: ghost = transparent, active = `var(--color-surface-hover)` bg + neutral bold icon. Danger = `var(--color-error)` text only (no bg).

### Iconography
- Hand-rolled SVG in Header → keep (simple line icons, Muji-compatible). Stroke width 2 standardize.
- No cliche metaphors present.

### Code quality
- Inline style on ThemePanel reset cancel button (`style={{ borderColor: ... }}`) → move to CSS class.
- `data-theme={resolveMode(themeMode)}` → keep, works with ThemeProvider.

## Step 4 — Functions → placement matrix

### Options page

| Element | Zone | Priority | Affordance | Steps |
|---|---|---|---|---|
| Sidebar nav (Tài nguyên / Giao diện / Cài đặt) | primary | above-fold | Vertical list, active = neutral bold + subtle bg left bar 2px | 1 |
| Page title "Cell — Tùy chọn" | tertiary | above-fold | Top of content, font-size 18px weight 500 | 0 |
| Resources: Dictionary dropzone | primary | above-fold | Dashed border 1px, hover bg subtle, click + drag-drop | 1 |
| Resources: Dictionary list | primary | below-fold | Cards border 1px, no shadow, delete icon right | 1 |
| Resources: Frequency dropzone | primary | below-fold | Same as dictionary | 1 |
| Resources: Frequency list | primary | below-fold | Same as dictionary list | 1 |
| Theme: Mode cards (light/dark/system) | primary | above-fold | 3 cards, active = neutral border 2px + subtle bg | 1 |
| Theme: Color customization | primary | below-fold | Color swatches + inputs, no blue default | 1 |
| Theme: Preview | secondary | below-fold | Live preview box | 0 |
| Theme: Backup (import/export) | secondary | below-fold | Text buttons | 2 |
| Theme: Reset | tertiary | below-fold | Text button → confirm inline | 2 |
| Settings: placeholder | tertiary | below-fold | Muted text "Sắp có" | 0 |

### Popup (480x600)

| Element | Zone | Priority | Affordance | Steps |
|---|---|---|---|---|
| Header: logo + title | tertiary | above-fold | Left, font-size 13px weight 500 | 0 |
| Header: extension toggle | primary | above-fold | Icon button, ghost ON / danger OFF | 1 |
| Header: auto-download toggle | primary | above-fold | Icon button, active = subtle bg | 1 |
| Header: theme toggle | primary | above-fold | Icon button, cycle light/dark/system | 1 |
| Header: settings open | primary | above-fold | Icon button, opens modal | 1 |
| Media section title | tertiary | above-fold | "Media" font-size 11px weight 600 muted, NO uppercase | 0 |
| Select All / Download All | primary | above-fold | Text buttons right, neutral color (was blue) | 1 |
| Video cards | primary | below-fold | Border 1px no shadow, checkbox + title + quality select + download | 2 |
| Subtitle cards | primary | below-fold | Same pattern, language label | 2 |
| Media empty state | secondary | on-demand | Composed "No media detected" + hint | 0 |
| Downloads section title | tertiary | below-fold | "Downloads" same style as Media | 0 |
| Download cards | primary | below-fold | Border 1px, progress bar neutral, pause/resume/cancel/retry/remove | 2 |
| Downloads empty state | secondary | on-demand | Composed "No downloads yet" | 0 |
| SettingsDialog modal | on-demand | on-demand | Overlay + panel, scrollable, grouped sections | 1 |

## Step 5 — Task flows (max 3 steps)

| Task | Steps |
|---|---|
| Import dictionary | open options → drag file to dropzone → (auto-import) = 2 |
| Delete resource | open options → click delete icon → confirm = 2 (inline confirm, no modal if possible) |
| Switch theme mode | open options → Giao diện → click mode card = 2 |
| Customize color | Giao diện → click swatch → pick = 2 |
| Download video from popup | popup → click download on card = 1 (or select + Download All = 2) |
| Toggle auto-download | popup → click AD icon = 1 |
| Open settings | popup → click gear = 1 |
| Pause download | popup → click pause on card = 1 |

All ≤ 3. No flow > 3.

## Step 6 — Information architecture

- Options: **sidebar** (3 items = boundary case, but intent Q5 confirmed sidebar). Labels: "Tài nguyên" / "Giao diện" / "Cài đặt" (Vietnamese, user's vocabulary).
- Popup: **single column** vertical stack (480px width constraint). No nav. Header + 2 sections.
- SettingsDialog: **grouped sections** inside modal (Media / Overlay / Shortcuts / Nav Cluster / Download). Keep existing grouping from `mockup-settings-rearrange.html`.

## Step 7 — Visual hierarchy

**Options**: eye goes 1st sidebar active item (neutral bold + left bar), 2nd page title, 3rd content panel. F-pattern (text-dominant).

**Popup**: eye goes 1st header icons (top-right cluster), 2nd Media section title + actions, 3rd card list. F-pattern.

Gestalt: proximity — section title + content grouped by `gap: var(--spacing-md)`. Similarity — all cards same border + radius, differentiated by content not style.

## Step 8 — Aesthetic

**Selected**: `minimalist-ui` (Muji thuần).
**Rejected**: `high-end-visual-design` (too rich for settings), `industrial-brutalist-ui` (too harsh, not calm).

Commit for whole screen. No mixing.

## Step 9 — Tokens

### Color (changes from current theme.css)

| Token | Light (new) | Dark (new) | Change |
|---|---|---|---|
| `--color-primary` | `#0f172a` | `#f1f5f9` | was #2563eb / #60a5fa → neutral |
| `--color-primary-hover` | `#1e293b` | `#e2e8f0` | derived shade |
| `--color-primary-subtle` | `rgba(15,23,42,0.06)` | `rgba(241,245,249,0.08)` | was blue rgba → neutral |
| `--color-background` | `#FAFAF9` | `#0f172a` | was #ffffff → warm bone |
| `--color-surface` | `#f5f5f4` | `#1e293b` | was #f8fafc → warmer neutral |
| `--color-surface-hover` | `#ebebea` | `#334155` | was #f1f5f9 |
| `--color-border` | `#e7e5e4` | `#334155` | was #e2e8f0 → warmer |
| `--color-border-subtle` | `#f0eeec` | `#1e293b` | warmer |
| `--color-border-focus` | `var(--color-text)` | `var(--color-text)` | was blue → neutral |
| `--color-info` | `var(--color-text-secondary)` | `var(--color-text-secondary)` | was blue → neutral |
| `--color-success` | `#16a34a` | `#22c55e` | keep green (semantic) |
| `--color-warning` | `#d97706` | `#f59e0b` | keep amber (semantic) |
| `--color-error` | `#dc2626` | `#ef4444` | keep red (semantic) |

**Rule**: success/warning/error giữ color (semantic feedback). Không decorative. Active state = neutral bold + `--color-surface-hover` bg.

### Typography

| Token | New value | Change |
|---|---|---|
| `--font-family` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif` | was Inter → system stack (Muji native feel) |
| `--font-size-xs` | 11px | was 12px (slightly smaller, Muji compact labels) |
| `--font-size-sm` | 13px | keep |
| `--font-size-base` | 14px | keep |
| `--font-size-lg` | 17px | was 16px (page title presence) |

### Spacing (increase whitespace)

| Token | New value | Change |
|---|---|---|
| `--spacing-xs` | 4px | keep |
| `--spacing-sm` | 8px | keep |
| `--spacing-md` | 12px | keep |
| `--spacing-lg` | 16px | keep |
| `--spacing-xl` | 24px | keep |
| `--spacing-2xl` (NEW) | 32px | page padding, section gap |
| `--spacing-3xl` (NEW) | 40px | options page outer padding |

### Radius (Muji small)

| Token | New value | Change |
|---|---|---|
| `--radius-sm` | 4px | was 6px (tighter) |
| `--radius-md` | 6px | was 8px |
| `--radius-lg` | 8px | was 12px (max radius now 8px) |
| `--radius-full` | 9999px | keep (toggle dots only) |

### Shadow (tint, subtle)

| Token | New value | Change |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,0.04)` | tint to bg hue, lighter |
| `--shadow-md` | `0 2px 8px rgba(15,23,42,0.06)` | was 0 4px 12px 0.08 → subtle, tinted |

### Motion

| Token | New value | Change |
|---|---|---|
| `--transition` | `200ms cubic-bezier(0.16, 1, 0.3, 1)` | was 150ms ease |
| `--transition-fast` | `150ms` | keep |
| `--transition-normal` | `200ms` | keep |
| `--ease-standard` | `cubic-bezier(0.16, 1, 0.3, 1)` | was ease |

## Step 10 — State coverage

| Component | loading | empty | error | hover | active | focus | disabled |
|---|---|---|---|---|---|---|---|
| Sidebar nav item | n/a | n/a | n/a | bg subtle | neutral bold + left bar 2px | 2px ring neutral | opacity 0.4 |
| Dropzone | n/a | "Kéo thả hoặc click" | inline text | bg subtle + border darker | n/a | 2px ring | opacity 0.5 |
| Resource card | skeleton row | "Chưa có tài nguyên" | inline | bg subtle | n/a | 2px ring | n/a |
| Mode card | n/a | n/a | n/a | border darker | border 2px neutral + bg subtle | 2px ring | opacity 0.4 |
| Video/Subtitle card | skeleton | MediaEmpty composed | inline | bg subtle | checkbox checked | 2px ring | opacity 0.5 (downloading) |
| Download card | progress bar neutral | MediaEmpty composed | inline error text | bg subtle | n/a | 2px ring | n/a |
| Icon button | n/a | n/a | n/a | bg subtle | bg subtle (toggle ON) | 2px ring neutral | opacity 0.4 |
| Text button | n/a | n/a | n/a | bg subtle | n/a | 2px ring | opacity 0.4 |
| Settings modal | n/a | n/a | n/a | n/a | n/a | 2px ring first focusable | n/a |

Focus ring: `2px solid var(--color-border-focus)` with `outline: 2px solid var(--color-border-focus); outline-offset: 2px;` — 3:1 contrast (neutral on bg).

## Step 11 — Anti-slop rules (active bans)

- No Inter as default → system stack.
- No pure `#000000` → off-black `#0f172a`.
- No pure `#ffffff` canvas → warm bone `#FAFAF9`.
- No blue/purple gradient → neutral base, no accent.
- No em-dash (`—`) → colon/hyphen/period.
- No `linear`/`ease-in-out` → `cubic-bezier(0.16, 1, 0.3, 1)`.
- No generic card border+shadow+white → border 1px only, no shadow (elevation = spacing).
- No `text-transform: uppercase` on section titles.
- No exclamation marks in success.
- No fake round numbers.
- No scroll cues, version footers, decorative dots.
- No animating `top/left/width/height` → `transform` + `opacity` only.

## Step 12 — Acceptance tests

| ID | Name | Pass criteria |
|---|---|---|
| AT1 | First-glance | Desktop screenshot 3s: sees sidebar + content (options) / header + media list (popup), knows to import dictionary / download video, no guide needed |
| AT2 | Flow step count | All tasks in Step 5 ≤ 3 steps |
| AT3 | Visual tell sweep | Zero AI tells: no Inter, no blue, no em-dash, no uppercase section titles, no shadow-heavy cards, no purple gradient |
| AT4 | A11y runtime | 0 violations (axe): contrast 4.5:1 body, 3:1 large + focus ring, ARIA tablist/tab/tabpanel with aria-controls + aria-labelledby, keyboard arrow keys in sidebar, Tab to panel, Home/End, skip link |
| AT5 | Console clean | 0 errors |
| AT6 | Responsive collapse | Options: 768px → sidebar collapses to top tab bar. Popup: 480px fixed (chrome constraint), no h-scroll, targets ≥ 44px |
| AT7 | Contract compliance | Every function row → component, every token via CSS var (grep `#` in component files = 0), fonts no Inter, radii ≤ 8px, all states implemented, ARIA matches Step 10 |

## Step 13 — Mockup

Files:
- `docs/mockups/mockup-muji-options.html` — options page (sidebar + content, light + dark toggle)
- `docs/mockups/mockup-muji-popup.html` — popup 480x600 (header + media + downloads, light + dark toggle)

Both show desktop + dark mode side by side. Apply tokens from Step 9. Font: system stack.

## Step 14 — User approval

**GATE**: No approval → no Phase 2.

Anh duyệt:
1. Open `docs/mockups/mockup-muji-options.html` in browser → toggle dark mode → check vibe Muji thuần?
2. Open `docs/mockups/mockup-muji-popup.html` in browser → toggle dark mode → check vibe?
3. Review token changes Step 9 — đặc biệt `--color-primary` → neutral (affect toàn UI, không chỉ options/popup).
4. Review anti-slop Step 11 — có ban nào anh muốn lift không?

Confirm "yes" → em lưu contract + invoke Phase 2 (implement).
Refine → em sửa mockup/token, re-submit.
