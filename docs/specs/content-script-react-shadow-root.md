# Spec: Content-script UI → React + shadow root (SSOT)

## Objective

Một codebase React component duy nhất cho mọi UI của Cell (popup, sidepanel, content-script, design-system-showcase). Sửa 1 chỗ, áp dụng everywhere.

### User story

- **Who:** Maintainer (Anh yêu) và future AI agents/code contributors.
- **Pain point:** Content-script UI hiện tại viết bằng vanilla DOM + CSS thuần, trong khi popup/sidepanel/options dùng React. Khi cần chuyển feature (ví dụ popup dictionary, card creator) sang UniversalPanel, phải viết lại giao diện, gây vỡ UI, duplicate code, mệt mỏi.
- **Why now:** Đã có `design-system-showcase`, `UniversalPanel` (React), `tokens.json`, và `mountUniversalPanel` pattern. Đủ nền tảng để thống nhất.
- **Success:** Cùng 1 component React dùng được ở cả popup/sidepanel và content-script (qua shadow root) và tự động xuất hiện trong design-system-showcase.

### Acceptance criteria

1. Mọi chrome UI container (subtitle block, nav cluster, orbital badge, popup dictionary shell, tokenize FAB/panel, card creator, settings dialog, universal panel) **cuối cùng** render bằng React component theo lộ trình phase.
2. Các container UI **ưu tiên** mount vào shadow root để CSS cách ly khỏi host page. Text-level decoration (token span, word highlight overlay) ở lại light DOM. Card creator / settings / universal panel chỉ chuyển sang shadow root nếu Phase 1b PoC chứng minh `position: fixed` overlay hoạt động đúng trong shadow; nếu không thì ở lại light DOM với class prefix `cell-` + local reset.
3. `tokens.json` có 3 lớp token rõ ràng (primitive → semantic → component) theo `src/shared/styles/STANDARD.md`.
4. 0 hardcoded color/spacing/z-index ngoài `tokens.json` + `SubtitlePreview`.
5. `design-system-showcase` tự động phát hiện + render mọi component mà không cần sửa tay.
6. Popup dictionary và `DictionaryTab` trong UniversalPanel dùng chung một nhóm component headless; chỉ khác shell + layout.

## Current state vs target state

Spec này là **roadmap**, không phải status quo. Phần lớn mã nguồn hiện tại vẫn là vanilla DOM. Các pha sẽ xây dựng dần.

### Đã có (không cần viết lại business logic)
- `src/shared/ui/` — 25+ React component sẵn sàng dùng lại.
- `tokens.json` — có 3 lớp (primitive/derived/component) nhưng component layer vẫn dùng tên token cũ (`color-foreground`, `color-card`, v.v.) và chưa có semantic tokens mới (`--color-text-disabled`, v.v.).
- `scripts/generate-tokens.js` — chưa hỗ trợ alias resolution và composite typography tokens.
- `src/shared/lib/themeTokens.ts` — inject token + sync theme cho light DOM.
- `src/stores/themeStore.ts` — Zustand theme store.
- Vanilla content-script UI:
  - Subtitle: `subtitleBlockDom.ts`, `navClusterButton.ts`, `subtitleManagerPanel.ts`, `subtitleOffsetPanel.ts`, `subtitleToast.ts`, `subtitleUI.ts`.
  - Dictionary: `createOrbitalBadge.ts`, `popupShell.ts`, `popupToolbar.ts`, `popupContent.ts`, `popupDictionaryController.ts`, `wordHighlight.ts`.
  - Tokenize: `tokenBadge.ts`, `tokenSpanRenderer.ts`, `tokenSpanCss.ts`.
- React content-script UI nhưng mount trong light DOM:
  - `mountUniversalPanel.ts`, `mountSettingsDialog.ts`, `mountCardCreatorDialog.ts` — các file này **cố tình không dùng shadow root** vì `position: fixed` overlay sợ bị "trap" trong stacking context của shadow host (comment trong `mountCardCreatorDialog.ts:9-13`). Đây là rủi ro cần PoC (xem §Phase 1b, task 7).

### Cần xây mới trong Phase 1
- `src/shared/lib/shadowRoot/mountReactShadow.ts`
- `src/shared/lib/shadowRoot/injectShadowCss.ts`
- `src/shared/lib/shadowRoot/ShadowThemeProvider.tsx`
- `src/shared/lib/shadowRoot/useShadowFocusTrap.ts`
- `src/stores/cuesStore.ts`

### Target state (sau Phase 9)
- Mọi chrome UI container render bằng React, phần lớn mount trong shadow root.
- Text-level decoration (token span, word highlight overlay) ở lại light DOM.
- Card creator / settings / universal panel **có thể** ở lại light DOM nếu PoC fixed overlay trong shadow root thất bại; khi đó dùng class prefix `cell-` + CSS reset cục bộ thay vì shadow root.

## Tech Stack

- **Framework:** React 19.2 + TypeScript
- **Build:** Vite 8 (với CRX plugin cho MV3)
- **State:** Zustand
- **CSS:** CSS Modules + CSS custom properties từ `tokens.json`
- **Extension:** Chrome Extension Manifest V3
- **Test:** Jest + Testing Library React (unit), Chrome DevTools MCP (visual/manual)
- **Browser targets:** Chrome, Edge, Brave — desktop + mobile responsive

## Commands

```bash
# Install
cd "C:\Users\The0cean\Programming\The0cean ecosystem\cell"
npm install

# Regenerate tokens after editing tokens.json
node scripts/generate-tokens.js

# Typecheck
npm run typecheck

# Unit tests
npm run test:unit

# Build extension + design-system-showcase
npm run build

# Dev server
npm run dev

# Serve design-system-showcase
npx http-server docs/design-system -p 8123

# Audit before commit (rg đã cài trên Windows, thay grep)
rg '#[0-9a-fA-F]{3,8}' src/ --type css -v tokens.css -v SubtitlePreview
rg 'color-accent' src/ --type css | rg hover
rg 'px' src/shared/ui/ --type css -v "var\(" -v "0px"
```

## Project Structure

```
src/
├── shared/
│   ├── styles/
│   │   ├── tokens.json              # Canonical design tokens (3 layers)
│   │   ├── tokens.css               # Generated from tokens.json
│   │   ├── STANDARD.md              # Design system standard (naming + when-to-use)
│   │   └── README.md                # Quick reference
│   ├── ui/                          # React component inventory (25+ components)
│   ├── icons/                       # ICON_CATALOG + Icon.tsx
│   └── lib/
│       ├── chrome-apis/             # Storage/runtime wrappers
│       └── shadowRoot/              # NEW — shadow root infrastructure
│           ├── mountReactShadow.ts
│           ├── injectShadowCss.ts
│           └── ShadowThemeProvider.tsx
├── features/
│   ├── subtitle/
│   │   └── ui/
│   │       ├── SubtitleBlock.tsx    # NEW — React
│   │       └── NavCluster.tsx       # NEW — React
│   ├── dictionaryPopup/
│   │   └── ui/
│   │       ├── PopupDictionary.tsx  # NEW — React
│   │       └── OrbitalBadge.tsx     # NEW — React
│   ├── tokenize/
│   │   └── ui/
│   │       └── TokenizeFab.tsx      # NEW — React
│   ├── cardCreator/
│   │   └── ui/                      # Already React, mount to shadow
│   ├── settings/
│   │   └── ui/                      # Already React, mount to shadow
│   └── universalPanel/              # Already React, mount to shadow
├── stores/                          # NEW/updated Zustand stores
│   └── cuesStore.ts
├── entrypoints/
│   ├── content/                   # Content scripts (IIFE)
│   ├── popup/
│   ├── sidepanel/
│   ├── options/
│   └── design-system-showcase/    # Auto-generated showcase
├── scripts/
│   └── generate-tokens.js         # Token generator
└── ...

docs/
├── intent/
│   └── content-script-react-shadow-root.md  # This intent
├── specs/
│   └── content-script-react-shadow-root.md  # This spec
└── design-system/
    ├── design-system-showcase.html
    └── assets/
```

## Code Style

### Component structure

```tsx
// Named export, function component, props interface explicit
export interface SubtitleBlockProps {
  readonly mode: 'target' | 'native';
}

export function SubtitleBlock({ mode }: SubtitleBlockProps): React.JSX.Element {
  const cues = useCuesStore((s) => s[mode === 'target' ? 'targetCues' : 'nativeCues']);
  const activeIndex = useCuesStore((s) => s.activeIndex);

  return (
    <div className={styles.block}>
      {cues.map((cue, i) => (
        <span
          key={cue.id}
          className={i === activeIndex ? styles.active : styles.inactive}
          style={{ fontSize: `var(--subtitle-font-size-${mode})` }}
        >
          {cue.text}
        </span>
      ))}
    </div>
  );
}
```

### CSS conventions

```css
/* Use tokens only */
.block {
  position: absolute;
  bottom: var(--space-12);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-container);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-popover);
  pointer-events: auto;
}

.active {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

/* Hover */
.control:hover {
  background: var(--color-surface-hover);
}
```

### Shadow root mount pattern

```ts
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { SubtitleBlock } from '@/features/subtitle/ui/SubtitleBlock';

export function mountSubtitleShadow(videoElement: HTMLElement): () => void {
  const host = document.createElement('div');
  host.id = 'cell-subtitle-host';
  host.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  videoElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const rootEl = document.createElement('div');
  rootEl.style.cssText = 'width:100%;height:100%;';
  shadow.appendChild(rootEl);

  // injectShadowCss appends <style> with tokens.css + component CSS
  const cleanupCss = injectShadowCss(shadow);

  const root = createRoot(rootEl);
  root.render(
    createElement(ShadowThemeProvider, null,
      createElement(SubtitleBlock, { mode: 'target' }),
    ),
  );

  return () => {
    root.unmount();
    cleanupCss();
    host.remove();
  };
}
```

## Testing Strategy

### Unit tests (Jest)

- Shadow root helper tests in `src/shared/lib/shadowRoot/*.test.ts`.
- Store tests in `src/stores/cuesStore.test.ts`.
- Component tests in `src/features/{feature}/ui/*.test.tsx`.

### Manual/visual tests (Chrome DevTools MCP)

- Mount Button/SubtitleBlock/OrbitalBadge on test pages.
- Verify on: YouTube video, Netflix video, GeeksforGeeks page.
- Check light/dark mode toggle.
- Check CSS isolation (host page CSS cannot override Cell components).

### Integration tests

- Build extension and load in Chrome.
- Play a YouTube video with subtitles, verify subtitle block + nav cluster render and respond.
- Open popup dictionary via orbital badge, verify lookup and styling.
- Open design-system-showcase and scroll through all components.

### Test migration

- Chuyển đổi là **rewrite UI layer**, không phải port 1:1. Các test vanilla cũ (`createOrbitalBadge.test.ts`, `tokenBadge.test.ts`, `popupShell.test.ts`, v.v.) tham chiếu DOM structure cũ, sẽ bị xóa theo code cũ.
- Mỗi phase phải viết test mới cho React component/hook tương đương **trước khi** xóa test cũ. Không để coverage hở.
- Với feature parity popup dictionary, viết test so sánh behavior giữa bản vanilla và bản React trước khi xóa vanilla.

## Performance & bundle budget

This work is high-risk for performance because it mounts multiple React roots in content-script and rewrites the UI layer of existing features. ADR-038 previously rejected React in content-script due to bundle size; we revisit now that reuse benefits outweigh costs, but we must measure.

**Budgets per phase:**

Đo baseline trước Phase 1a (hoặc ở cuối Phase 0c) trên bản build hiện tại. Budget viết theo delta so với baseline:

| Phase | Budget | How to measure |
|---|---|---|
| Phase 0c baseline | Ghi nhận bundle `content/` + `docs/design-system` + RAM idle YouTube 10 min | `vite-bundle-visualizer`, DevTools Memory |
| Phase 1a | PoC ≤ baseline + 300KB JS | bundle analyzer so sánh với baseline |
| Phase 1b | Single shadow root CSS ≤ 50KB; tổng content-script ≤ baseline + 10% | bundle analyzer + `tokens.css` size |
| Phase 2-8 | No >2× increase in content-script bundle size so với baseline | `dist/` before/after each phase |
| All | YouTube 10 min RAM ≤ baseline + 50% hoặc hard ceiling 250MB (máy yếu) | DevTools Performance Memory |

**Optimizations to apply:**

1. **Single shadow host per feature group** — subtitle, nav cluster, tokenize badges share one shadow root (one `tokens.css` injection). Orbital, popup, panel each have their own.
2. **Constructable StyleSheets** — if PoC proves viable, share one `CSSStyleSheet` for `tokens.css` across all shadow roots (`adoptedStyleSheets`).
3. **Lazy-load feature components** — dynamic `import()` cho popup dictionary và card creator chỉ khi user trigger.
4. **`React.memo` + Zustand selectors** — subtitle cues update on `timeupdate`; only active cue highlight nên re-render.

## Accessibility

1. **Focus management in shadow root:**
   - `useShadowFocusTrap` queries `panel.getRootNode().activeElement`.
   - `Dialog` focus trap works inside shadow.
2. **ARIA on content-script components:**
   - OrbitalBadge: `role="button"`, `aria-label="Open Cell panel"`, `aria-expanded`.
   - NavCluster buttons: `aria-label` per action.
   - Subtitle block: `aria-live="polite"` on active cue change.
3. **Reduced motion:** `prefers-reduced-motion` media query hoạt động qua shadow boundary, đặt trong `tokens.css` hoặc module CSS. Xem ADR-071.
4. ** axe-core** run on showcase + 1 content-script test page before each phase merge.

## Rollback plan

Deleting old vanilla DOM code is non-reversible. For each phase that replaces a working UI:

1. Keep old code behind a feature flag (`USE_LEGACY_*`) until the new UI passes:
   - `npm run typecheck`
   - `npm run build`
   - Unit tests
   - Manual test on YouTube, Netflix, GeeksforGeeks
2. Commit the new UI and feature flag in the same commit.
3. Only delete old code in a follow-up commit after the new UI is verified for at least one full development cycle.
4. Tag the commit before deletion so we can `git checkout` if needed.

Example flags:
- `USE_LEGACY_SUBTITLE`
- `USE_LEGACY_ORBITAL`
- `USE_LEGACY_POPUP_DICTIONARY`
- `USE_LEGACY_CARD_CREATOR`

## Boundaries

### Always do

- Read `src/shared/styles/STANDARD.md` before writing/sửa UI code.
- Use `tokens.json` tokens for colors, spacing, radius, shadow, motion, z-index.
- Run `npm run typecheck` + `npm run build` + `npx vite build --mode development` after each phase.
- Verify with Chrome DevTools MCP on at least one real page per phase.
- Commit each phase separately with clear message.
- Keep old code behind feature flag until new UI is verified.
- Measure bundle size and RAM after each phase.

### Ask first

- Adding new dependencies.
- Changing `manifest.json`.
- Modifying `scripts/generate-tokens.js` beyond alias/semantic additions.
- Restructuring `src/shared/ui/` inventory.
- Changing public API of `chrome.storage` or messaging contracts.
- Removing old vanilla DOM code (after feature flag period).

### Never do

- Commit secrets, keys, or hardcoded credentials.
- Inline SVG in components (use `ICON_CATALOG`).
- Hardcode colors/spacing/z-index outside `tokens.json`.
- Skip deleting old vanilla DOM code after migration.
- Modify repository security policies to bypass build failures.
- Add `PortalContainerContext` before an actual `createPortal` use case exists (YAGNI).

## Content-script UI inventory

Spec cần phủ hết các màn hình đang chạy production. Danh sách dưới đây bổ sung các màn hình/cấu trúc chưa được Phase 2–8 liệt kê rõ.

| Tên | Hiện tại | File chính | Shadow? | Phase phụ trách |
|---|---|---|---|---|
| Subtitle overlay block | vanilla DOM | `subtitleBlockDom.ts` | no | 2 |
| Nav cluster | vanilla DOM | `navClusterButton.ts` / `navClusterCss.ts` | no | 2 |
| Subtitle manager panel | vanilla DOM | `subtitleManagerPanel.ts` | no | 2 |
| Subtitle offset panel | vanilla DOM | `subtitleOffsetPanel.ts` / `offsetController.ts` | no | 2 |
| Subtitle toast / drag hint | vanilla DOM | `subtitleToast.ts` / `subtitleUI.ts` | no | 2 |
| Tokenize word badges | vanilla DOM light DOM | `tokenSpanRenderer.ts` / `tokenSpanCss.ts` | **no** | 5 |
| Tokenize FAB + panel | vanilla + shadow | `tokenBadge.ts` | yes | 5 |
| Orbital badge | vanilla + shadow | `createOrbitalBadge.ts` / `orbitalBadgeCss.ts` | yes | 3 |
| Popup dictionary shell + toolbar | vanilla + shadow | `popupShell.ts` / `popupToolbar.ts` / `popupContent.ts` | yes | 4 |
| Word highlight overlay | vanilla DOM light DOM | `wordHighlight.ts` | **no** | 4 |
| Settings dialog | React, light DOM | `mountSettingsDialog.ts` | no | 7 |
| Card creator dialog | React, light DOM | `mountCardCreatorDialog.ts` | no | 6c |
| UniversalPanel | React, light DOM | `mountUniversalPanel.ts` | no | 8 |

Ghi chú: shadow root đã có ở `popupShell.ts`, `createOrbitalBadge.ts`, `tokenBadge.ts`. Công việc là chuyển **từ shadow+vanilla sang shadow+React**, không phải tạo shadow mới. Các màn hình React hiện tại (`mountUniversalPanel`, `mountSettingsDialog`, `mountCardCreatorDialog`) dùng `injectThemeTokens`/`syncElementTheme` — cần thay bằng `mountReactShadow` + `ShadowThemeProvider`.

## Phase Plan (10 phases + sub-phases)

### Phase dependency graph

```
                            Phase 0a ──→ Phase 0b ──→ Phase 0c
                                              │
                                              ▼
                                       Phase 1a ──→ Phase 1b ──→ Phase 1c
                                              │
                                              ▼
Phase 2 ──────────────→ Phase 5a ──→ Phase 5b ──→ Phase 5c
    │                       │
    ▼                       ▼
Phase 3a ──→ Phase 3b ──→ Phase 3c
    │
    ▼
Phase 4a ──→ Phase 4b ──→ Phase 4c ──→ Phase 4d
    │
    ▼
Phase 6a ──→ Phase 6b ──→ Phase 6c ──→ Phase 7 ──→ Phase 8
                                                   │
                                                   ▼
                                                Phase 9
```

- Phase 0a/0b/0c phải xong trước Phase 1b vì `tokens.css`/`tokens.ts` mới là đầu vào của shadow CSS.
- Phase 1 (shadow infra) blocks all content-script UI phases (2-8).
- Phase 2 (subtitle) blocks Phase 5 (tokenize badges, which are composed into subtitle).
- Phase 3 (orbital) blocks Phase 4 (popup dictionary positions from orbital pointer).
- Phase 4 blocks Phase 8 (UniversalPanel tab `Dictionary` dùng cùng dictionary core).
- Phase 5 blocks Phase 8 (tokenize toggle trong header của UniversalPanel).
- Phase 6 / 7 block Phase 8 (card creator / settings là tab trong UniversalPanel).
- Phase 9 (showcase auto-discovery) depends on all reusable components being available.

### Phase 0 — Design system standard + tokens migration

**Size: XL — split into 3 sub-phases.**

**Prerequisites (gates) trước khi bắt đầu:**
1. `src/shared/styles/STANDARD.md` đã tồn tại và được team review.
2. Baseline bundle/RAM chưa cần ở Phase 0a, nhưng phải có trước Phase 1a.
3. Hiểu rõ `generate-tokens.js` hiện chưa hỗ trợ alias + composite typography — Phase 0a phải mở rộng script trước khi regenerate.

#### Phase 0a — Add semantic tokens + aliases (no caller migration)

**Tasks:**
1. ✅ Write `src/shared/styles/STANDARD.md` (done).
2. ✅ Update `src/shared/styles/README.md` to point to STANDARD.md (done).
3. Add new semantic tokens to `tokens.json` while keeping old names as aliases:
   - Rename + alias backwards:
     - `--color-foreground` → `--color-text-primary` (alias `--color-foreground` = `var(--color-text-primary)`)
     - `--color-text-muted` → `--color-text-secondary` (alias `--color-text-muted` = `var(--color-text-secondary)`)
     - `--color-card` → `--color-surface-card` (alias `--color-card` = `var(--color-surface-card)`)
     - `--color-popover` → `--color-surface-popover` (alias `--color-popover` = `var(--color-surface-popover)`)
   - Add semantic tokens:
     - Text: `--color-text-disabled`
     - Icon: `--color-icon-primary`, `--color-icon-secondary`, `--color-icon-disabled`
     - On-color: `--color-on-success`, `--color-on-warning`, `--color-on-error`
     - Overlay: `--color-overlay`, `--color-overlay-hover`, `--color-overlay-pressed`
     - Border: `--color-border-emphasized`
     - Skeleton: `--color-skeleton`
   - Add semantic radius:
     - `--radius-inner` (8px), `--radius-element` (18px), `--radius-container` (10px), `--radius-page` (24px)
   - Add semantic typography (composite tokens):
     - `--text-body`, `--text-label`, `--text-heading-1`, `--text-heading-2`, `--text-heading-3`, `--text-supporting`
4. Update `scripts/generate-tokens.js` to:
   - Support alias resolution (alias key → value points to another token).
   - Support composite typography tokens (token = combination of size/weight/leading/tracking).
5. Update `src/shared/lib/tokens.ts` (`deriveColorTokens`, `getColorTokens`) to read derived token definitions from `tokens.json` instead of hardcoding.
6. Replace raw hex / raw rgb in `tokens.json` with semantic tokens:
   - `dialog.overlay-bg` → use `var(--color-overlay)`
   - `subtitle.drag-hint` → add `--color-info` or semantic accent
   - `overlay.*` → use `var(--color-overlay)` / `var(--color-text-inverse)`
7. Move all hardcoded CSS strings từ CSS-in-TS files vào `tokens.json` component tokens hoặc `*.module.css`:
   - `NAV_CLUSTER_CSS`
   - `subtitleBlockCss.ts` (`subtitleUI.ts`)
   - `navClusterCss.ts`
   - `orbitalBadgeCss.ts`
   - `tokenBadgeCss.ts`
   - `tokenSpanCss.ts` (giữ dùng cho light DOM token spans)
   - `popupDictionary.css` (của vanilla popup shell)
8. Regenerate `tokens.css` and `tokens.ts`.
9. Run `npm run typecheck` and `npm run build`.

**Acceptance:**
- `tokens.json` contains primitive, derived (semantic), and component layers.
- All new tokens follow naming convention in `STANDARD.md`.
- `scripts/generate-tokens.js` supports alias resolution and composite typography tokens.
- `tokens.css` and `tokens.ts` generate without errors; aliases và composite tokens xuất hiện đúng.
- Build passes.
- Existing UI still renders correctly because aliases are preserved.

**Files touched:**
- `src/shared/styles/tokens.json`
- `scripts/generate-tokens.js`
- `src/shared/lib/tokens.ts`
- `src/shared/lib/themeTokens.ts`
- `src/shared/styles/tokens.css` (generated)
- `src/shared/styles/tokens.ts` (generated)

---

#### Phase 0b — Migrate token callers

**Tasks:**
1. Run `rg "var\(--color-foreground\)" src/ --type css --type ts --type tsx` and replace with `var(--color-text-primary)`.
2. Run `rg "var\(--color-text-muted\)" src/ --type css --type ts --type tsx` and replace with `var(--color-text-secondary)`.
3. Run `rg "var\(--color-card\)" src/ --type css --type ts --type tsx` and replace with `var(--color-surface-card)`.
4. Run `rg "var\(--color-popover\)" src/ --type css --type ts --type tsx` and replace with `var(--color-surface-popover)`.
5. Replace old `--space-*` and `--radius-*` raw uses with new semantic names where applicable.
6. Run audit commands:
   ```bash
   rg '#[0-9a-fA-F]{3,8}' src/ --type css -v tokens.css -v SubtitlePreview
   rg 'color-accent' src/ --type css | rg hover
   rg 'px' src/shared/ui/ --type css -v "var\(" -v "0px"
   ```
7. Run `npm run typecheck` and `npm run build`.
8. Verify design-system-showcase renders correctly.

**Acceptance:**
- 0 `var(--color-foreground)`, `var(--color-text-muted)`, `var(--color-card)`, `var(--color-popover)` in source.
- 0 new hardcoded colors/spacing outside `tokens.json`.
- Build passes.
- Showcase renders correctly in light and dark mode.

**Files touched:**
- `src/**/*.module.css`
- `src/**/*.tsx` (if any inline style uses old token)
- `docs/design-system/design-system-showcase.html` (regenerated)

---

#### Phase 0c — Remove aliases + baseline audit

**Tasks:**
1. Confirm 0 occurrence của old token names in `src/` (trừ `tokens.json` và `tokens.css` generated):
   ```
   rg "--color-foreground|--color-text-muted|--color-card|--color-popover" src/ --type css --type ts --type tsx -v tokens.json -v tokens.css
   ```
2. Tag commit trước khi xóa: `git tag pre-token-alias-removal`.
3. Remove aliases from `tokens.json`.
4. Remove alias-generation logic from `scripts/generate-tokens.js`.
5. Regenerate `tokens.css`.
6. Run full audit checklist (see §Audit).
7. Run `npm run build` and `npx vite build --mode development`.
8. Capture baseline performance: bundle `content/`, design-system, YouTube 10 min RAM. Ghi vào `docs/adr/075-shadow-root-react.md`.
9. Verify showcase + popup + sidepanel + options.
10. Nếu có lỗi, revert về tag và quay lại Phase 0b.

**Acceptance:**
- `tokens.json` has no old token names.
- `tokens.css` has no aliases.
- Build passes.
- All entry points render correctly.

**Files touched:**
- `src/shared/styles/tokens.json`
- `scripts/generate-tokens.js`
- `src/shared/styles/tokens.css` (generated)

---

### Phase 1 — Infra: shadow root + React mount helper

**Size: XL — split into 3 sub-phases.**

#### Phase 1a — PoC: CSS Module in shadow root

**Goal:** Prove a React component using `*.module.css` can be mounted into shadow root with full CSS isolation.

**Result:** Vite `import buttonCss from './Button.module.css?inline'` returns the processed CSS string with hashed class names matching the React component. Combined with `tokens.css?raw` (replace `:root` → `:host`) and `components.css?raw`, the Button renders with Cell styling and is not overridden by host page `button { all: unset !important; }`.

**Tasks:**
1. Create a throwaway `ShadowPoC.tsx` page in `src/entrypoints/design-system-showcase/ShadowPoC.tsx`.
2. Use `mountReactShadow` to attach a `<Button variant="primary">` into a shadow root.
3. On the host page, inject a hostile stylesheet: `button { all: unset !important; }`.
4. Verify: Button keeps Cell styling (color, radius, padding, hover) despite hostile host page.
5. Sửa `jest.config.ts` moduleNameMapper để support `?inline`:
   - Thêm `'\\?inline$': '<rootDir>/tests/rawMock.ts'` đặt trước `^@/(.*)$`.
   - Verify `npm run test:unit` vượt qua với component dùng `?inline`.
6. Document the chosen mechanism in `docs/adr/075-shadow-root-react.md` and update this spec.

**Acceptance:**
- PoC page renders Button in shadow root with correct styles.
- Host page CSS cannot override the shadow Button.
- Decision on CSS injection mechanism is recorded in ADR.

**Files touched:**
- `src/entrypoints/design-system-showcase/ShadowPoC.tsx`
- `src/shared/lib/shadowRoot/mountReactShadow.ts` (prototype)
- `src/shared/lib/shadowRoot/injectShadowCss.ts` (prototype)
- `docs/adr/075-shadow-root-react.md`

---

#### Phase 1b — Shadow root mount helper + theme + event model

**Tasks:**
1. Create `src/shared/lib/shadowRoot/mountReactShadow.ts` — generic helper:
   - Accept a host element and a React element.
   - Create shadow root, inject CSS, createRoot, render.
   - Return `unmount()`.
2. Create `src/shared/lib/shadowRoot/injectShadowCss.ts`:
   - Import `tokens.css?raw` and `components.css?raw`.
   - For React components, import `Component.module.css?inline` from the component file and append it to the shadow `<style>`.
   - Keep separate: `tokens.css` = variables, `components.css` = legacy global utility classes.
   - `components.css` xóa chỉ khi không còn caller (vanilla popup dict, React `DictionaryPanelView.tsx`, v.v.).
   - Build `<style>` element with `:host` selector instead of `:root`.
   - Append to shadow root.
   - Return cleanup function.
3. Refactor `themeManager.ts`:
   - `applyTheme(mode, config, target = document.documentElement)` — set CSS vars and `data-theme` on the target element.
4. Refactor `ThemeProvider.tsx`:
   - Add optional `container?: HTMLElement` prop (defaults to `document.documentElement`).
   - `ShadowThemeProvider` wraps `ThemeProvider` with `container={shadowHost}`.
   - In content-script, do **not** boot a separate `themeStore`; reuse `themeTokens.ts` injection and only sync `data-theme` attribute on shadow host.
5. Xác định **theme mechanism retirement plan**:
   - `injectThemeTokens` + `syncElementTheme` tồn tại vì 3 mount React hiện tại dùng light DOM.
   - Sau Phase 6c, 7, 8, các mount này chuyển sang `mountReactShadow` + `ShadowThemeProvider`.
   - Chỉ xóa `injectThemeTokens`/`syncElementTheme` khi không còn caller nào trong `src/`.
5. Document shadow DOM event/focus model:
   - `useShadowFocusTrap` — use `panel.getRootNode().activeElement` instead of `document.activeElement`.
   - Click-outside use `event.composedPath()`.
   - `e.target` may retarget to shadow host; use `composedPath()[0]` for actual target.
6. Define **z-index & shadow host ordering contract**:
   - Mỗi shadow host append vào `document.body` theo thứ tự: subtitle/nav host dưới cùng, orbital, popup dict, token badge, panel/settings/card creator trên cùng.
   - Đọc ADR-031 (Netflix z-index fix), ADR-024 (portable theme boundary), ADR-061 (orbital settings), ADR-065 (universal panel) trước khi quyết định thứ tự DOM.
   - `mountReactShadow` nhận `zIndex` hoặc `layer` prop để set `z-index` và `position: fixed/absolute` một cách nhất quán.
7. **PoC fixed overlay trong shadow root** (rủi ro từ `mountCardCreatorDialog.ts:9-13`):
   - Mount 1 `Dialog`/`CardCreatorDialog` React component vào shadow root với host `position: fixed; inset: 0;`.
   - Test trên YouTube fullscreen: dialog vẫn full viewport, không bị "trap" trong shadow host.
   - Nếu thất bại, ghi nhận: card creator / settings / universal panel **không** chuyển sang shadow root; dùng light DOM + class prefix `cell-` + local reset.
   - Cập nhật ADR-075/ADR-022 với kết luận.
8. Create `src/shared/lib/shadowRoot/PortalContainerContext.tsx` **only if needed** (YAGNI: current code has 0 `createPortal`). If a component later needs portal, create `PortalContainerProvider` + `usePortalContainer` + `Portal` then.
9. Create `src/stores/cuesStore.ts` (Zustand):
   - `targetCues`, `nativeCues`, `activeIndex`, `setCues`, `setActiveIndex`.

**Acceptance:**
- `mountReactShadow` is reusable and returns an unmount function.
- React Button/Card/Input render inside shadow root with correct Cell styles.
- Host page CSS cannot override the shadow components.
- Theme toggle (light/dark) works inside shadow root.
- Focus trap and click-outside work correctly in shadow DOM (unit test + manual test).
- Z-index contract được ghi rõ, stack order khi nhiều shadow host cùng tồn tại ổn định.
- Kết luận PoC fixed overlay trong shadow root rõ ràng: GO nếu `position: fixed` vẫn full viewport, NO-GO nếu ở lại light DOM.
- Build passes and no new TypeScript errors.

**Files touched:**
- `src/shared/lib/shadowRoot/mountReactShadow.ts`
- `src/shared/lib/shadowRoot/injectShadowCss.ts`
- `src/shared/lib/shadowRoot/ShadowThemeProvider.tsx`
- `src/features/theme/ui/ThemeProvider.tsx`
- `src/features/theme/logic/themeManager.ts`
- `src/shared/lib/themeTokens.ts`
- `src/stores/cuesStore.ts`
- `src/shared/lib/shadowRoot/useShadowFocusTrap.ts` (new)
- Test files: `*.test.ts`, `*.test.tsx`

---

#### Phase 1c — Verify on real pages

**Tasks:**
1. Mount a PoC component (Button + Card) into shadow root on test pages.
2. Verify on YouTube video page, Netflix video page, GeeksforGeeks article.
3. Test light/dark mode, focus, hover, click-outside.
4. Re-measure bundle size + RAM after Phase 1a/1b changes, so sánh với baseline ghi ở Phase 0c.

**Acceptance:**
- CSS isolation works on all 3 sites.
- No FOUC, no style leak.
- Bundle/RAM delta so với baseline ≤ ngưỡng §Performance.

---

### Phase 2 — Subtitle block + nav cluster + subtitle panels

**Size: XL — split into 2 sub-phases.**

Bên cạnh `SubtitleBlock` và `NavCluster`, còn các màn hình subtitle khác đang chạy vanilla: `subtitleManagerPanel.ts`, `subtitleOffsetPanel.ts`, `subtitleToast.ts`, drag hint trong `subtitleUI.ts`.

#### Phase 2a — Subtitle block + nav cluster

**Data flow contract:**

```
Content-script cue detector
    │
    ▼
Dispatch CustomEvent('cell:cues:updated', { detail: { target, native, activeIndex } })
    │
    ▼
cuesStore.setCues() / setActiveIndex()
    │
    ▼
SubtitleBlock + NavCluster re-render
```

**Tasks:**
1. Define `SUBTITLE_CUES_UPDATED` event type in `src/features/subtitle/events.ts`.
2. Create `src/features/subtitle/ui/SubtitleBlock.tsx`:
   - Render target and/or native cues from `cuesStore`.
   - Apply `OverlayStyleConfig` (fontSize, textColor, backgroundColor, opacity, textShadow, fontFamily, fontWeight).
   - Position and auto-scale according to ADR-025 (unified subtitle block).
3. Create `src/features/subtitle/ui/NavCluster.tsx`:
   - Render prev/next/replay/repeat/toggle buttons.
   - Collapse to edge, drag/slide behavior preserved.
   - Connect to keyboard shortcuts and cue navigation controller.
4. Refactor `contentScriptController.ts`:
   - When cues update or active index changes, dispatch `cell:cues:updated` event.
   - Remove direct DOM manipulation for subtitle overlay.
5. Mount `SubtitleBlock` and `NavCluster` into a shared shadow root inside the video player element (single shadow host for subtitle + nav + tokenize to avoid duplicate CSS injection).
6. Apply `OverlayStyleConfig` (target + native) from settings via React props.
7. Add `SubtitleBlock` + `NavCluster` to `design-system-showcase` with mock cues.
8. Verify on YouTube and Netflix: cues appear, update, style correctly, nav cluster clickable.

**Acceptance:**
- Subtitle block renders in shadow root, isolated from host page CSS.
- Cues update in real time as video plays.
- Nav cluster controls (prev/next/replay/repeat) work.
- Same components render in design-system-showcase with mock data.
- No regression in subtitle drag/position/scale.
- Reduced-motion transitions respect `prefers-reduced-motion`.

**Files touched:**
- `src/features/subtitle/events.ts`
- `src/features/subtitle/ui/SubtitleBlock.tsx`
- `src/features/subtitle/ui/NavCluster.tsx`
- `src/features/subtitle/ui/SubtitleBlock.module.css`
- `src/features/subtitle/ui/NavCluster.module.css`
- `src/stores/cuesStore.ts`
- `src/entrypoints/content/subtitle/*` (refactor to dispatch events)
- `src/entrypoints/design-system-showcase/App.tsx` (add previews)

---

#### Phase 2b — Subtitle manager, offset, toast, drag hint

**Tasks:**
1. Create `SubtitleManagerPanel.tsx` từ `subtitleManagerPanel.ts`:
   - Chọn/nạp phụ đề, import, offset, naming.
2. Create `SubtitleOffsetPanel.tsx` từ `subtitleOffsetPanel.ts`:
   - Slider offset thời gian, preview.
3. Create `SubtitleToast.tsx` và `SubtitleHint.tsx` từ `subtitleToast.ts` và `subtitleUI.ts`:
   - Toast message, drag hint, error hint.
4. Mount tất cả vào cùng shadow root với Phase 2a.
5. Keep old code behind `USE_LEGACY_SUBTITLE` (default false). Xóa chỉ sau khi 2a + 2b pass trên 3 trang + build + unit test.
6. Add previews vào design-system-showcase với mock data.

**Acceptance:**
- Manager panel mở/đóng, load/import phụ đề.
- Offset panel chỉnh thời gian, preview cập nhật.
- Toast/hint hiện đúng context, không bị host page override.
- Build passes.

**Files touched:**
- `src/features/subtitle/ui/SubtitleManagerPanel.tsx`
- `src/features/subtitle/ui/SubtitleOffsetPanel.tsx`
- `src/features/subtitle/ui/SubtitleToast.tsx`
- `src/features/subtitle/ui/SubtitleHint.tsx`
- `src/features/subtitle/ui/*.module.css`
- `src/features/subtitle/ui/subtitleManagerPanel.ts` (delete after pass)
- `src/features/subtitle/ui/subtitleOffsetPanel.ts` (delete after pass)
- `src/features/subtitle/ui/subtitleToast.ts` (delete after pass)
- `src/features/subtitle/ui/subtitleUI.ts` (giảm scope hoặc delete nếu chỉ còn hint/toast)

---

### Phase 3 — Orbital badge

**Size: XL — split into 3 sub-phases.**

#### Phase 3a — Gesture hook + pointer/position logic

**Tasks:**
1. Refactor pointer position math from `pointerPosition.ts` into a pure hook `useOrbitalPointer(preset, badgeSize, pointerScale)`.
2. Refactor edge-snap + collapse from `badgeCollapse.ts` into `useOrbitalSnap(badgeCenter, badgeSize)`.
3. Refactor drag/expand threshold logic from `gestureDetector.ts` into `useOrbitalGesture`.
4. Write unit tests for all hooks.

**Acceptance:**
- Hooks return same values as current `createOrbitalBadge` for same inputs.
- Unit tests pass.

**Files touched:**
- `src/features/dictionaryPopup/badgePointer/useOrbitalPointer.ts`
- `src/features/dictionaryPopup/badgePointer/useOrbitalSnap.ts`
- `src/features/dictionaryPopup/badgePointer/useOrbitalGesture.ts`
- `src/features/dictionaryPopup/badgePointer/*.test.ts`

---

#### Phase 3b — React shell + persistence

**Tasks:**
1. Create `src/features/dictionaryPopup/ui/OrbitalBadge.tsx`:
   - Render half-moon/circle badge using shared `Icon` + `IconButton`.
   - Apply hooks from 3a.
2. Create `src/features/dictionaryPopup/ui/OrbitalBadge.module.css`.
3. Persist position via chrome storage (reuse existing logic).
4. Add `aria-label`, `aria-expanded`, `role="button"`.
5. Add OrbitalBadge to `design-system-showcase` with mock controls.

**Acceptance:**
- OrbitalBadge is a React component.
- Click/expand/collapse/edge-snap work.
- Position persists across reloads.
- CSS isolated from host page.
- Showcase preview works.

**Files touched:**
- `src/features/dictionaryPopup/ui/OrbitalBadge.tsx`
- `src/features/dictionaryPopup/ui/OrbitalBadge.module.css`
- `src/stores/orbitalBadgeStore.ts` (position persistence)
- `src/entrypoints/design-system-showcase/App.tsx`

---

#### Phase 3c — Mount + fullscreen + cleanup

**Tasks:**
1. Mount OrbitalBadge into shadow root on `document.body` via `mountReactShadow`.
2. Re-implement fullscreen re-parenting if needed (xem ADR-024, ADR-061, ADR-065 cho pattern hiện tại).
3. Click-outside uses `composedPath()` to detect clicks outside badge and hosts.
4. Delete `createOrbitalBadge.ts` + `orbitalBadgeCss.ts` + helper files **after** 3a+3b pass.
5. Verify on YouTube/Netflix/GeeksforGeeks: drag, expand, collapse, edge-snap, single-click opens UniversalPanel.

**Acceptance:**
- OrbitalBadge mounted in shadow root, CSS isolated.
- Fullscreen re-parenting works.
- Click-outside closes badge as expected.
- Old code deleted.

**Files touched:**
- `src/features/dictionaryPopup/ui/mountOrbitalBadge.ts`
- `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts` (delete after migration)
- `src/features/dictionaryPopup/badgePointer/orbitalBadgeCss.ts` (delete after migration)
- `src/entrypoints/content/*` (update mount calls)

---

### Phase 4 — Popup dictionary

**Size: XL — split into 4 sub-phases.**

Popup dictionary hiện tại là bản **vanilla shadow DOM feature-complete** (`popupShell.ts` 1080 + `popupToolbar.ts` 556 + `popupContent.ts` 393 + `popupDictionaryController.ts` 1503 LOC). Bản React (`DictionaryPanelView.tsx` + `CandidateView.tsx`) thiếu toolbar 4 tab (audio/image/translate/links), anchor positioning, resize handle, sheet handle. Đây là nguồn SSOT; cần port toàn bộ feature parity sang React, sau đó `DictionaryTab` trong UniversalPanel cũng dùng lại core.

**Feature parity matrix (popup dict ↔ DictionaryTab):**

| Feature | Popup dict | DictionaryTab | Hướng |
|---|---|---|---|
| Search + candidate list | CÓ | CÓ | share `DictionaryCore` |
| 4 tab toolbar (audio/image/translate/links) | CÓ | KHÔNG | port từ popup, dùng chung |
| Resize / drag handle | CÓ | KHÔNG | chỉ ở popup shell |
| Anchor positioning từ orbital pointer | CÓ | KHÔNG | chỉ ở popup shell |
| Search history | KHÔNG | CÓ | port vào core |
| 2-pane dictionary + card creator | KHÔNG | CÓ | dùng `DictionaryTab` layout |
| Quick Add → card creator | CÓ | CÓ | share |

#### Phase 4a — Headless dictionary core

**Tasks:**
1. Tạo `src/features/dictionaryPopup/logic/useDictionaryLookup.ts` từ `popupDictionaryController.ts` (hoặc tái cấu trúc `lookupOrchestrator.ts` cho UI).
2. Tạo `src/features/dictionaryPopup/logic/useDictionaryToolbar.ts` quản lý 4 tab (audio/image/translate/links) và selection counts.
3. Refactor `CandidateView.tsx` + `DictionaryPanelView.tsx` để chỉ còn presentation, state bên ngoài.
4. Viết unit tests cho hooks.

**Acceptance:**
- `useDictionaryLookup`, `useDictionaryToolbar` không phụ thuộc DOM.
- Unit tests pass.

**Files touched:**
- `src/features/dictionaryPopup/logic/useDictionaryLookup.ts`
- `src/features/dictionaryPopup/logic/useDictionaryToolbar.ts`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/CandidateView.tsx`
- `src/features/dictionaryPopup/ui/*.test.tsx`

---

#### Phase 4b — Port 4 lazy tab panels sang React

**Tasks:**
1. Convert `popupToolbar.ts` → React:
   - `AudioPanel.tsx`
   - `ImagePanel.tsx`
   - `TranslatePanel.tsx`
   - `LinksPanel.tsx`
2. Mỗi panel nhận `selection: LookupSelection` và callbacks (TTS, image pick, link open).
3. Gắn `DictionaryToolbar` vào `DictionaryPanelView` trước trong context an toàn (popup/sidepanel), chưa mount shadow.
4. Verify `DictionaryTab` ở UniversalPanel vẫn hoạt động, không mất tab.

**Acceptance:**
- 4 tab render bằng React.
- Audio/image/translate/links data binding đúng.
- `DictionaryTab` trong UniversalPanel có toolbar đầy đủ.

**Files touched:**
- `src/features/dictionaryPopup/ui/AudioPanel.tsx`
- `src/features/dictionaryPopup/ui/ImagePanel.tsx`
- `src/features/dictionaryPopup/ui/TranslatePanel.tsx`
- `src/features/dictionaryPopup/ui/LinksPanel.tsx`
- `src/features/dictionaryPopup/ui/DictionaryToolbar.tsx`
- `src/features/universalPanel/tabs/DictionaryTab.tsx`

---

#### Phase 4c — Popup shell + positioning

**Tasks:**
1. Tạo `PopupDictionary.tsx` = `DictionaryCore` + `PopupShell` layout.
2. Tái dùng `computePopupPosition` từ `popupShell.ts` (giữ hàm thuần, không viết lại).
3. Tái dùng resize handle, sheet handle, clamp logic.
4. Refactor `wordHighlight.ts` overlay nếu cần ăn khớp với React state.
5. Mount `PopupDictionary` vào shadow root dưới orbital badge pointer tip.
6. Feature flag `USE_LEGACY_POPUP_DICTIONARY`.

**Acceptance:**
- Popup render trong shadow root.
- Position tự động tránh tràn viewport.
- Resize/drag/sheet handle hoạt động.
- Word highlight overlay vẫn ở light DOM (vì neo vào host text).

**Files touched:**
- `src/features/dictionaryPopup/ui/PopupDictionary.tsx`
- `src/features/dictionaryPopup/ui/PopupDictionary.module.css`
- `src/features/dictionaryPopup/ui/mountPopupDictionary.ts`
- `src/features/dictionaryPopup/ui/popupShell.ts` (delete after pass)
- `src/features/dictionaryPopup/ui/popupToolbar.ts` (delete after pass)
- `src/features/dictionaryPopup/ui/popupContent.ts` (delete after pass)
- `src/features/dictionaryPopup/ui/popupDictionary.css` (delete sau khi style chuyển hết)

---

#### Phase 4d — Unified DictionaryTab + cleanup

**Tasks:**
1. `DictionaryTab.tsx` dùng chính `DictionaryCore` + `DictionaryToolbar` (port từ 4b).
2. `DictionaryTab` giữ 2-pane layout (dictionary trái, card creator phải).
3. Kiểm tra `onQuickAdd` / `onSendToCard` flow ở cả popup và tab.
4. Xóa `popupShell.ts`, `popupToolbar.ts`, `popupContent.ts` sau khi verify trên 3 trang.

**Acceptance:**
- Popup dictionary và `DictionaryTab` dùng chung core, không duplicate logic.
- Feature parity đạt theo matrix.
- Build passes, showcase preview hoạt động.

---

### Phase 5 — Tokenize (word badges + FAB)

**Size: M (chia 2 surfaces khác biệt).**

Chú ý: có hai thành phần tokenize:
- **Token spans** (`tokenSpanRenderer.ts` + `tokenSpanCss.ts`): span bọc từng từ trong light DOM host page. Không thể cho vào shadow root vì mất anchor. Giữ nguyên vanilla, style qua `injectTokenSpanStyle`.
- **Tokenize FAB + panel** (`tokenBadge.ts`): nút nổi + panel toggle ở shadow root. Chuyển sang React.

**Tasks:**
1. Tạo `src/features/tokenize/ui/TokenizeFab.tsx` (React) thay thế `tokenBadge.ts`:
   - Toggle enabled/status/frequency.
   - Position theo edge + tránh overlap orbital badge.
   - Shadow root mount.
2. Refactor tokenize logic thành `useTokenize` hook.
3. Giữ `tokenSpanRenderer.ts` + `tokenSpanCss.ts` ở light DOM, chỉ dọn dẹp token hardcoded, chuyển màu tần suất/status sang `tokens.css` var.
4. Mount `TokenizeFab` vào shadow root trên `document.body`.
5. Delete `tokenBadge.ts` + `tokenBadgeCss.ts` sau verify.
6. Add `TokenizeFab` + mock token spans vào design-system-showcase.

**Acceptance:**
- Tokenize FAB render trong shadow root, CSS isolated.
- Token spans vẫn wrap text trên subtitle, màu frequency/status đúng token.
- No line jump / layout shift.
- Showcase preview hoạt động.

**Files touched:**
- `src/features/tokenize/ui/TokenizeFab.tsx`
- `src/features/tokenize/ui/TokenizeFab.module.css`
- `src/features/tokenize/ui/useTokenize.ts`
- `src/features/tokenize/ui/tokenSpanCss.ts` (dọn token)
- `src/features/subtitle/ui/SubtitleBlock.tsx` (nếu FAB cần biết trạng thái subtitle)
- `src/features/tokenize/ui/tokenBadge.ts` (delete sau migration)
- `src/features/tokenize/ui/tokenBadgeCss.ts` (delete sau migration)
- `src/entrypoints/design-system-showcase/App.tsx`

---

### Phase 6 — Card Creator

**Size: XL — split into 3 sub-phases.**

#### Phase 6a — Extract reusable React components

**Tasks:**
1. Refactor `CardCreatorDialog`, `CardCreatorBottomSheet`, `QueueSidebar`, `MediaList` to be pure, reusable, mount-agnostic.
2. Centralize state in `src/stores/cardCreatorStore.ts` (Zustand).
3. Add `aria-*` attributes and keyboard navigation to queue/list.

**Acceptance:**
- Components work in popup + sidepanel without change.
- Unit tests pass.

**Files touched:**
- `src/features/cardCreator/ui/*`
- `src/stores/cardCreatorStore.ts`

---

#### Phase 6b — Design-system-showcase preview

**Tasks:**
1. Add Card Creator preview to showcase with mock queue and media.
2. Verify dialog open/close, queue add/edit/reorder, media list, field edit, preview without real AnkiConnect.

**Acceptance:**
- Showcase preview works with mock data.
- No direct `chrome.runtime` call when in showcase.

**Files touched:**
- `src/entrypoints/design-system-showcase/App.tsx`
- `src/entrypoints/design-system-showcase/mockProviders.tsx`

---

#### Phase 6c — Mount

**Tasks:**
1. Mount Card Creator dialog/bottom sheet — **nếu Phase 1b fixed overlay PoC GO thì dùng `mountReactShadow`; nếu NO-GO thì giữ light DOM với `cell-` class prefix + local reset.**
2. Delete any remaining vanilla DOM card creator code.
3. Verify: queue, media list, field edit, preview, export to AnkiConnect.

**Acceptance:**
- Card Creator render đúng, không bị CSS trang chủ phá vỡ.
- Export/save to AnkiConnect works.
- CSS isolation đạt theo cơ chế đã chọn (shadow hoặc light DOM + reset).

**Files touched:**
- `src/features/cardCreator/ui/mountCardCreator.ts`
- `src/entrypoints/content/*` (mount calls)

---

### Phase 7 — Settings Dialog (content-script mount)

**Tasks:**
1. Reuse existing `SettingsDialog` React component.
2. Update `mountSettingsDialog` — **nếu Phase 1b fixed overlay PoC GO thì dùng `mountReactShadow`; nếu NO-GO thì giữ light DOM với `cell-` class prefix + local reset.**
3. Ensure `SettingsDialogContent` (with all settings sections) renders correctly.
4. Verify save/load settings, theme toggle, and all settings sections.

**Acceptance:**
- Settings Dialog mounts đúng cơ chế đã chọn.
- All sections render and update settings.
- Theme toggle works.
- CSS isolated from host page.

**Files touched:**
- `src/features/settings/ui/mountSettingsDialog.ts`
- `src/shared/lib/shadowRoot/*`
- `src/entrypoints/content/*` (if mount is triggered from content script)

---

### Phase 8 — UniversalPanel mount

**Size: L** (depends on Phases 1, 5, 6, 7).

**Tasks:**
1. Update `mountUniversalPanel`:
   - **Nếu Phase 1b fixed overlay PoC GO thì dùng `mountReactShadow`; nếu NO-GO thì giữ light DOM với `cell-` class prefix + local reset.**
   - Keep fixed full-viewport host + `pointer-events: none`.
   - Keep fullscreen re-parenting of host + style into fullscreen element (xem ADR-024, ADR-031, ADR-065).
2. Update `getHosts()` để click-outside logic dùng `composedPath()` (nếu shadow) hoặc `event.target` (nếu light).
3. Thay `injectThemeTokens` / `syncElementTheme` bằng `ShadowThemeProvider` + `injectShadowCss` (nếu shadow) hoặc giữ cơ chế theme hiện tại (nếu light).
4. Keep `tokenizeUnsubscribe` at mount level; pass `panel` prop to React tree.
5. Do **not** add `PortalContainerContext` unless Dialog/Drawer/Tooltip actually use `createPortal`.
6. Verify:
   - Tab switching: dictionary, settings, card creator.
   - Tokenize toggle in header re-renders panel.
   - Dialog/Drawer/Tooltip render and are clickable.
   - Fullscreen video: panel stays visible.
   - Light/dark mode.

**Acceptance:**
- UniversalPanel mounts đúng cơ chế đã chọn.
- All tabs work.
- Theme and tokens propagate correctly.
- CSS isolated from host page.
- Fullscreen re-parenting still works.

**Files touched:**
- `src/features/universalPanel/mountUniversalPanel.ts`
- `src/features/universalPanel/UniversalPanel.tsx`
- `src/shared/lib/shadowRoot/*`

---

### Phase 9 — Design-system-showcase auto-discovery

**Convention for discoverable components:**

Each component that wants to appear in showcase exports a companion file `<Name>.showcase.tsx`:

```
src/shared/ui/
  Button.tsx
  Button.module.css
  Button.showcase.tsx   # export default preview component + metadata
```

`Button.showcase.tsx`:

```tsx
import { Button } from './Button';

export const ButtonShowcase = () => (
  <div>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="outline">Outline</Button>
  </div>
);

export const showcaseMeta = {
  title: 'Button',
  group: 'Action',
  description: 'Primary, secondary, outline, ghost, destructive buttons.',
};
```

For compound components (Accordion, Tabs, Dialog, Select, SearchableSelect) the `.showcase.tsx` provides composed examples. Components needing mock data (cues, dictionary, card creator) use `MockProviders`.

**Tasks:**
1. Use **runtime dynamic import** with Vite `import.meta.glob`:
   - Scan `src/shared/ui/*.showcase.tsx` and `src/features/*/ui/*.showcase.tsx` at build time via glob.
   - Vite resolves the glob during build and bundles all discovered showcase modules.
   - Render all discovered showcase modules in grouped sections.
2. For `src/shared/ui/*.tsx` without `.showcase.tsx`, generate a minimal default preview from prop types.
3. Scan `ICON_CATALOG` to render icon grid automatically.
4. Scan `tokens.json` to render token swatches automatically.
5. Create `MockProviders` for components needing data (cues, dictionary, card creator).
6. Keep manual `App.tsx` as fallback for components without `.showcase.tsx` until Phase 9 done.
7. Verify: showcase updates automatically when a new `.showcase.tsx` is added.

**Acceptance:**
- Showcase auto-discovers and renders new components without manual `App.tsx` edits.
- Icon grid and token swatches auto-update.
- Compound components have composed `.showcase.tsx` examples.
- Mock data providers cover data-dependent components.
- Build passes and showcase renders correctly.

**Files touched:**
- `src/entrypoints/design-system-showcase/App.tsx`
- `src/entrypoints/design-system-showcase/autoDiscovery.ts`
- `src/entrypoints/design-system-showcase/mockProviders.tsx`
- `src/shared/ui/*.showcase.tsx` (new, one per component)
- `src/features/*/ui/*.showcase.tsx` (new, one per feature UI)

## Success Criteria (overall)

1. All chrome UI containers listed in phases 2–8 render as React components. Ưu tiên mount trong shadow root; card creator / settings / universal panel có thể ở lại light DOM nếu Phase 1b fixed overlay PoC NO-GO. Text-level decoration (token span, word highlight) ở lại light DOM với lý do đã ghi ở AC.
2. CSS from host pages cannot override Cell UI; Cell CSS cannot leak out. Với light DOM (card creator / settings / universal panel fallback), dùng class prefix `cell-` + local reset để đạt isolation thực tế.
3. The same React component used in content-script also works in popup/sidepanel/options and design-system-showcase.
4. `tokens.json` follows 3-layer token model and naming convention in `STANDARD.md`.
5. `design-system-showcase` auto-discovers and renders components.
6. Popup dictionary và `DictionaryTab` trong UniversalPanel dùng chung `DictionaryCore`, không duplicate logic, đạt feature parity đã khai báo.
7. Z-index + shadow host ordering contract được áp dụng, không regression trên Netflix/YouTube fullscreen.
8. All builds pass (`npm run typecheck`, `npm run build`, `npx vite build --mode development`) after each phase.
9. Manual tests pass on YouTube, Netflix, and GeeksforGeeks.
10. Bundle/RAM so với baseline ≤ ngưỡng §Performance.

## Decisions (confirmed)

1. `tokens.ts` / `themeTokens.ts` cần update để phản ánh semantic tokens + aliases mới.
2. Alias token cũ được giữ tạm, migrate callers dần rồi xóa alias (Phase 0a → 0b → 0c).
3. Shadow root CSS injection (PoC validated): `tokens.css?raw` + `components.css?raw` tạm; per component `*.module.css?inline`. `components.css` xóa chỉ khi không còn caller nào (cả vanilla lẫn React `DictionaryPanelView.tsx` hiện import `components.css?raw`).
4. `?inline` là cơ chế duy nhất cho CSS module trong shadow root. **Chú ý:** `?inline` không phải CSS Modules runtime trong shadow; nó xuất chuỗi CSS đã được Vite xử lý (class name hashed khớp với React component) để inject thủ công vào `<style>` của shadow root. Điều này vẫn đảm bảo CSS isolation vì shadow boundary.
5. Showcase auto-discovery dùng Vite `import.meta.glob` + `<Name>.showcase.tsx` convention.
6. `ShadowThemeProvider` wrap `ThemeProvider` với `container` prop (hybrid).
7. React portals trong shadow root cần custom portal container **khi có thực sự `createPortal`**. Hiện tại 0 `createPortal` nên defer (YAGNI).
8. `useShadowFocusTrap` dùng `getRootNode().activeElement`; click-outside dùng `composedPath()`.
9. Mỗi phase có feature flag rollback.
10. Theme mechanism cũ (`injectThemeTokens`/`syncElementTheme`) được khai tử dần khi các mount React chuyển sang shadow root (hoặc giữ nếu mount ở lại light DOM).
11. Popup dictionary vanilla là SSOT về feature; React `DictionaryTab` sẽ dùng chung core, không dùng `DictionaryPanelView` hiện tại làm popup.
12. Card creator / settings / universal panel ưu tiên shadow root, nhưng nếu Phase 1b fixed overlay PoC thất bại thì ở lại light DOM với class prefix `cell-` + local reset.

## Open Questions

(None — all confirmed above.)

## References

- Intent: `docs/intent/content-script-react-shadow-root.md`
- ADR: `docs/adr/075-shadow-root-react.md` (supersedes ADR-038)
- ADR-024: portable theme boundary / fullscreen
- ADR-025: unified subtitle block
- ADR-031: Netflix z-index fix
- ADR-038: popup dictionary shadow DOM vanilla (superseded by ADR-075)
- ADR-061: orbital settings dialog mount
- ADR-065: universal orbital panel
- ADR-071: reduced motion
- Design system standard: `src/shared/styles/STANDARD.md`
- Reference: `docs/design-system/daft.md`
- Token source: `src/shared/styles/tokens.json`
- Token generator: `scripts/generate-tokens.js`
- Current showcase: `docs/design-system/design-system-showcase.html`
- Showcase entrypoint: `src/entrypoints/design-system-showcase/`
