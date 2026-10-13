# Design Brief — Resources import UX

> Stage: DESIGN. Spec: `docs/specs/resources-import-ux.md`. Mockup: `src/entrypoints/mockup-resources-import-ux/` (`npm run dev` → `/src/entrypoints/mockup-resources-import-ux/index.html`).

## Design Read

The shipped `ResourcesPanel` gives a dropped dictionary one shared progress line with a hardcoded `/100` denominator, imports files strictly in series, reorders via up/down buttons, and hides a per-resource "Thử tra từ" inside each detail expansion. Six files dropped together produce one invisible queue: the user cannot tell which file is loading, how far it is, which one finished, or which one failed — and there is no quick way to sanity-check a freshly imported dictionary.

Three surfaces must change together: (1) per-file import jobs rendered *inside* the resource list with real entry totals and independent terminal states, (2) a left-edge drag grip that replaces up/down buttons and lifts the row while dragging, (3) an integrated lookup column to the right of the list so the user can verify dictionaries and frequency lists immediately.

## Function audit

| Function | Class | Why |
|---|---|---|
| One visible job row per dropped file (queued → counting → importing → done/error/duplicate) | `must-have` | The core complaint: six files must produce six independent states |
| Real entry total as progress denominator (`processed / total`, spinner while counting) | `must-have` | Hardcoded /100 is the reported bug; spec mandates exact counts |
| Determinate fill + % text at the row's right edge | `must-have` | User's stated ideal; non-color-only status |
| Files import concurrently (bounded), each reports its own outcome immediately | `must-have` | Sequential is "quá chậm"; unbounded parallelism risks SW memory |
| Dropzone + list stay interactive while imports run | `must-have` | Explicit non-blocking requirement |
| Six-dot grip on the left edge; row lifts while dragging; order persists | `must-have` | User's stated ideal (Yomitan reference) |
| Keyboard reorder fallback on the grip | `must-have` | A11y; existing up/down affordance must not regress |
| Lookup surface to the right of the list, editable query, hits real enabled dictionaries + frequency lists | `must-have` | Replaces removed per-resource "Thử tra từ" |
| Per-resource "Thử tra từ" inside detail expansion | `remove` | User explicitly asked to delete it; supplanted by the integrated column |
| Sample entries + profile assignment in detail expansion | `must-have` | Existing function, kept |
| Any separate lookup implementation | `remove` | Reuse `DictionaryPanelView` per user decision |

**Primary job:** *let the user watch every dropped file become a resource — and check the result — without the UI ever freezing or lying about progress.*

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Begin | Drop 6 files on the dropzone | 6 placeholder job rows appear inline in the matching resource section; dropzone stays usable | Resource list |
| 2 | Middle | Watch | Each row counts entries (spinner), then fill rises `processed / total`; ≤N run at once, rest show "queued" | Job rows |
| 3 | End | Per file | Row solidifies into a resource card with its own result; siblings keep importing | List |
| 4 | Edge | A file fails / duplicates | Only that row turns error/duplicate; others unaffected | That row |
| 5 | Edge | Type a word in the right column | Dictionary + frequency results render from enabled resources | Lookup column |
| 6 | Edge | Grab a grip and drag | Row lifts (`--shadow-floating`), siblings slide, drop persists order | List rows |
| 7 | Edge | Focus grip, press arrows | Same reorder without a mouse | Grip |

Moments of uncertainty: "which of my 6 files is the one still going?" → row keeps the source filename; "is it stuck?" → determinate fill with real denominator + spinner phase; "did it work?" → type a term on the right and see hits.

## Dials

Baseline: `DESIGN_VARIANCE 3` (the list stays a card list; only the *fill channel* is new), `MOTION_INTENSITY 2` (fill transition + lift-on-grab; honors `prefers-reduced-motion`), `VISUAL_DENSITY 6` (six concurrent jobs must read at one glance).

## Inspiration anchor

The Yomitan dictionaries screen the user referenced — six-dot grip, card that floats above a dashed placeholder while dragged — filtered through Tihoka's water story: progress is *water rising in a vessel*, not a detached bar.

## Context quote

User: "khi user kéo vào thì màn hình sẽ hiển thị có những items nào đang được load và hiển thị trạng thái đang load được bao nhiêu phần trăm... ở bên trái ngoài cùng là khi tôi nhấn vào hoặc click chuột giữ drag thì item dictionary đó sẽ được thay đổi vị trí. xóa bỏ tính năng thử tra từ mà thay vào đó là tích hợp dictionary ở bên phải resources."

## Concepts

### Concept A — Conveyor tray (khay hàng đợi)
- **IA mental model:** download manager — a dedicated "Đang thêm" queue pinned under the dropzone, separate from the resource list.
- **UX flow:** drop → jobs live in the tray with bar + % → on success the row disappears and a resource card appears below.
- **UI structure:** new tray block + existing card rows; two visual grammars for the same lifecycle.
- **3 dials:** VARIANCE 4, MOTION 2, DENSITY 6.
- **Why it fits:** clearest job/resource separation; closest to the reference's mental model.
- **Risk:** a completed job "teleports" from tray to list — where the row lands and why it moved is less obvious; one more region of chrome to maintain on narrow widths.

### Concept B — Water fill (nước dâng) — **CHOSEN**
- **IA mental model:** the list IS the queue — a dropped file lands immediately as a placeholder card in the position it will occupy.
- **Visual archetype:** vessel filling — `--color-primary-subtle` fill rises from the card's bottom edge as entries stream in.
- **Non-digital reference:** mực nước dâng trong cốc — water level rising in a glass.
- **Material / surface:** `--color-surface-card` card, dashed `--color-border-subtle` frame while pending, solid when the resource materializes; fill channel is a background layer behind content.
- **Typography treatment:** filename stays `--font-sizes-sm` medium; counter `processed / total` in `--font-sizes-xs` `--color-text-subtle`; % in semibold accent.
- **Motion signature:** fill height animates `--duration-normal` `--ease-standard`; grab lifts the card with `--shadow-floating` + slight scale; drop settles with `--ease-spring`.
- **UX flow:** drop → placeholder card (spinner while counting) → fill rises to 100% → card solidifies into a real resource row; error paints `--color-error-subtle`, duplicate `--color-warning-subtle`; queued rows sit dimmed with "Chờ lượt".
- **UI structure:** no new chrome — job rows reuse the card grammar; right edge hosts spinner → % → icon `circleCheck` / `alertCircle` / `triangleAlert`.
- **3 dials:** VARIANCE 3, MOTION 2, DENSITY 6.
- **Why it fits:** zero teleport — where you drop is where the resource appears; one component grammar (card) covers job + resource + drag states; strongest water-metaphor fit.
- **Risk:** job cards and resource cards share a silhouette — must keep pending state unmistakable (dashed frame + dimmed title + fill) so users don't mistake an importing file for a usable resource.
- **Audit findings:** solves all five reported defects with the least new structure; reorder grip is the same card's left edge, so drag animation applies uniformly.

### Concept C — Ledger (sổ cái)
- **IA mental model:** spreadsheet — resources and jobs share one hairline ledger with a right-aligned numeric column.
- **UX flow:** drop → text rows gain a thin accent underline that grows with progress; statuses are words in the right column.
- **UI structure:** minimal chrome; underline as the only progress channel.
- **3 dials:** VARIANCE 5, MOTION 1, DENSITY 8.
- **Why it fits:** most minimal; dense status scan.
- **Risk:** departs from the card grammar used everywhere else in settings; an underline is a weak "filling" metaphor and the lift-on-drag reads worse on hairline rows.

## Decision

User picked **Concept B — Water fill**: "anh chọn b water fill. xong rồi đó làm đi". Grip must be the six-dot style with a lift animation on grab (Yomitan reference screenshot); lookup column must embed the real dictionary popup surface (`DictionaryPanelView`, `variant="integrated"`), not a mock.

## Layout contract

- Desktop (≥720px container): two columns — resource sections left, lookup column right (`minmax(0,1fr) minmax(0,320px)`), lookup sticks with the section.
- Mobile (<720px): single column — lookup column stacks below the resource sections.
- Job card anatomy (L→R): `DragHandle` (disabled while job active) · filename + `processed / total` · right edge: `Spinner` (counting) → % + fill (importing) → icon `circleCheck` / `alertCircle` / `triangleAlert`.
- Resource card anatomy (L→R): `DragHandle` (enabled, `--color-icon-secondary`) · name + meta · `Toggle` · `IconButton` delete icon `trash` · chevron `chevronDown` expander — replaces the up/down buttons.
- Fill uses `--color-primary-subtle` absolutely-positioned behind content; never obscures text (subtle tint, content has `position:relative`).
- Drag affordance: grab → `--shadow-floating` + dashed drop placeholder; `prefers-reduced-motion` collapses lift/settle to opacity only.
- Status announcements: one `aria-live="polite"` `VisuallyHidden` region per section announcing "X đã thêm xong / X lỗi".
