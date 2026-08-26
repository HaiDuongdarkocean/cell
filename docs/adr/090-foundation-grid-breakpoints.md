# ADR-090: Grid & Breakpoints for "Quiet Confidence" Foundation

## Status

Proposed — awaiting build + showcase prototype before final acceptance.

## Context

Cell chạy trên desktop, tablet, Android. UI surfaces khác nhau: popup (nhỏ, 320-400px), sidepanel (trung bình, 360-480px), options page (lớn, 800px+), content script overlays. Cần breakpoint và grid rõ ràng để responsive không phải "cắt cho có".

## Decision

### 1. Mobile-first breakpoints

| Token | Value | Range | Usage |
|-------|-------|-------|-------|
| `--breakpoint-sm` | 320px | 0 → 479px | Mobile compact (Android popup) |
| `--breakpoint-md` | 480px | 480 → 767px | Mobile large / small tablet |
| `--breakpoint-lg` | 768px | 768 → 1023px | Tablet / desktop sidepanel |
| `--breakpoint-xl` | 1024px | 1024 → 1279px | Desktop small |
| `--breakpoint-2xl` | 1280px | 1280px+ | Desktop large |

**Lý do:**
- 320px là min-width của popup trên Android ([project context](docs/context/project-context.md)).
- 768px là điểm tablet chuyển sang layout multi-pane.
- 1024px+ là desktop/options page.

### 2. Grid: 4-column on small, 12-column on large

| Breakpoint | Columns | Gutter | Margin |
|------------|---------|--------|--------|
| sm | 4 | 16px | 16px |
| md | 4 | 16px | 24px |
| lg | 12 | 24px | 24px |
| xl | 12 | 24px | 32px |
| 2xl | 12 | 24px | 48px |

**Lý do:**
- 4-column đủ cho màn hình nhỏ (button, card, list).
- 12-column cho desktop giống Carbon/Material, linh hoạt layout.
- Gutter 16-24px đủ rộng để phân tách, không quá lớn gây lãng phí.

### 3. Container tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--container-sm` | 100% | Popup, small panels |
| `--container-md` | 480px | Mobile large content |
| `--container-lg` | 720px | Tablet dialogs |
| `--container-xl` | 960px | Desktop small page |
| `--container-2xl` | 1120px | Desktop large page |

### 4. Responsive patterns

- **Dialog**: full-screen dưới 480px, max-width 448px trên 768px+.
- **Sidepanel**: 100% width, max-width 480px.
- **Options page**: max-width 1120px, centered.
- **Popup**: max-width 360px, min-width 320px.

## Consequences

**Positive:**
- Responsive rõ ràng theo thiết bị thực tế.
- 4/12 column phù hợp cả mobile và desktop.

**Negative:**
- Component cũ dùng hardcoded `@media (max-width: 768px)` cần chuẩn hóa lại.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| 8pt grid cho tất cả | Quá thô cho mobile. |
| Chỉ 1 breakpoint (mobile/desktop) | Không đủ cho tablet/sidepanel. |
| 16-column desktop | Quá phức tạp, không cần thiết cho extension. |

## References

- [Carbon 2x Grid](https://cds-pictograms.vercel.app/guidelines/layout)
- [Material 3 — Breakpoints](https://m3.material.io/foundations/layout/understanding-layout/overview)
- [Apple HIG — Adaptivity & Layout](https://developer.apple.com/design/human-interface-guidelines/foundations/adaptivity-and-layout/)
