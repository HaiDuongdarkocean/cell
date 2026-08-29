# Spec: Sidebar & Navigation Decoupling

> Intent: `docs/intent/sidebar-navigation-decoupling.md`  
> Status: Draft for approval  
> Confirmed: 2026-08-29

## Objective

Tách biệt trách nhiệm giữa **`Sidebar`** (layout template shell) và **`Navigation`** (organism điều hướng tự quản).
- `Sidebar` chỉ đóng vai trò container layout `container > header + body`, co giãn tự nhiên theo kích thước nội dung con (`fit-content`), quản lý trạng thái thu gọn/mở rộng `collapsible` và toggle button.
- `Navigation` sở hữu toàn bộ logic điều hướng (active state, floating bg water-flow rAF animation, scroll-spy, scroll-to-active, event delegation cho `NavItem`), hỗ trợ 2 chế độ hiển thị linh hoạt: **Dọc (`vertical`)** và **Ngang (`horizontal`)**.

### User Stories

1. **As a** developer, **I want** to use `Sidebar` as a generic collapsible shell container with any custom body content (forms, cards, filters) without inheriting navigation-specific logic.
2. **As a** developer, **I want** a standalone `Navigation` organism that handles floating pill rAF animation, scroll-spy, and event delegation in both vertical and horizontal layouts so I can place navigation in sidebars, headers, or drawers.
3. **As a** user, **I want** smooth 60fps water-flow animation and auto-scroll behavior when navigating sections in settings or panels on mobile, tablet, and desktop.

---

## Design Contract & Atomic Architecture

### Atomic Classification

```
1. ATOMS:
   - Icon (src/shared/icons/Icon.tsx)
   - IconButton (src/shared/ui/IconButton.tsx)
   - Tokens (src/shared/styles/tokens.json)

2. MOLECULES:
   - NavItem (src/shared/ui/NavItem.tsx) - Icon + Label + button wrapper + dynamic label collapse

3. ORGANISMS:
   - Navigation (src/shared/ui/Navigation.tsx) - activeId state, rAF floating pill water-flow, scroll-spy, event delegation, orientation="vertical" | "horizontal"

4. TEMPLATES:
   - Sidebar (src/shared/ui/Sidebar.tsx) - container > header + body, collapsible container, dynamic fit-content

5. PAGES / FEATURES:
   - SettingsDialogContent (src/features/settings/ui/SettingsDialogContent.tsx)
```

---

## API Contract

### 1. `Sidebar` (Template Shell)

```tsx
export interface SidebarProps {
  /** Slot header (optional title, actions) */
  header?: ReactNode;
  /** Whether sidebar can be collapsed to icon/compact width (desktop) */
  collapsible?: boolean;
  /** Controlled collapsed state */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Accessible label for the aside landmark */
  ariaLabel?: string;
  /** Custom class name */
  className?: string;
  /** Children content rendered inside body slot */
  children: ReactNode;
}

export function Sidebar(props: SidebarProps): React.JSX.Element;
```

**Structure HTML:**
```html
<aside class="sidebar" data-collapsed="..." aria-expanded="...">
  <div class="header">
    <div class="headerContent">{header}</div>
    <IconButton class="toggleBtn" ... />
  </div>
  <div class="body">
    {children}
  </div>
</aside>
```

### 2. `Navigation` (Organism)

```tsx
export type NavigationOrientation = 'vertical' | 'horizontal';

export interface NavigationProps {
  /** Items (typically NavItem elements with data-section-id) */
  children: ReactNode;
  /** Layout orientation. Default: 'vertical' */
  orientation?: NavigationOrientation;
  /** Controlled active section id */
  activeId?: string;
  /** Callback when active section changes (click or scroll-spy) */
  onActiveChange?: (id: string) => void;
  /** Content scroll container ref — for scroll-spy + click-to-scroll */
  contentRef?: React.Ref<HTMLElement>;
  /** Section refs map — consumer provides refs to content sections */
  sectionRefs?: React.MutableRefObject<Record<string, HTMLElement | null>>;
  /** Accessible label for <nav> */
  ariaLabel?: string;
  /** Custom class name */
  className?: string;
}

export function Navigation(props: NavigationProps): React.JSX.Element;
```

**Features in `Navigation`:**
- **Floating pill rAF animation:**
  - In `vertical` mode: transforms `translateY(var(--active-y))` + height `var(--active-h)`.
  - In `horizontal` mode: transforms `translateX(var(--active-x))` + width `var(--active-w)`.
  - Uses cubic-bezier ease-in-out curve for smooth fluid motion.
- **Scroll-spy:** Watches `contentRef` scroll event and calculates closest section in `sectionRefs`.
- **Event delegation:** Captures clicks on `<nav>`, finds closest `[data-section-id]`, performs smooth animated scroll + indicator move.
- **Auto-scroll:** Keeps active item in viewport (`scrollIntoView` or `scrollTo` inside `<nav>`).

---

## Tech Stack & Dependencies

- React 19 (Hooks, pure components, named exports)
- TypeScript (Strict mode, `no-explicit-any`)
- CSS Modules (`Sidebar.module.css`, `Navigation.module.css`)
- Tokens from `src/shared/styles/tokens.css` (SSOT)
- Jest + Testing Library for unit tests

---

## Project Structure

```text
src/shared/ui/
  ├── NavItem.tsx                     # Molecule (existing)
  ├── NavItem.module.css
  ├── Navigation.tsx                  # Organism [NEW]
  ├── Navigation.module.css           # Organism styles [NEW]
  ├── Navigation.test.tsx             # Unit tests [NEW]
  ├── Navigation.showcase.tsx         # Showcase gallery [NEW]
  ├── Sidebar.tsx                     # Template refactored to container > header + body [MODIFY]
  ├── Sidebar.module.css              # Template styles [MODIFY]
  ├── Sidebar.test.tsx                # Unit tests [MODIFY]
  ├── Sidebar.showcase.tsx            # Showcase gallery [MODIFY]
  └── index.ts                        # Re-export Navigation & Sidebar [MODIFY]

src/features/settings/ui/
  └── SettingsDialogContent.tsx       # Assembly: <Sidebar><Navigation>...</Navigation></Sidebar> [MODIFY]
```

---

## Testing Strategy

### 1. `Sidebar.test.tsx`
- Renders `header` and `children` in separate slots.
- Renders collapse button when `collapsible=true`.
- Calls `onCollapsedChange` when toggle button is clicked.
- Does NOT require or manipulate `data-section-id` or `contentRef`.

### 2. `Navigation.test.tsx`
- Renders `orientation="vertical"` and `orientation="horizontal"`.
- Event delegation: clicking a `NavItem` fires `onActiveChange` with target `data-section-id`.
- Floating pill properties `--active-y`/`--active-x` updated upon active item change.
- Scroll-spy updates `activeId` on container scroll.

### 3. Integration & Build Verification
- `SettingsDialogContent` renders correctly with Sidebar + Navigation.
- `npx tsc --noEmit` passes with 0 errors.
- `npm run test:unit` passes.
- `npm run build` succeeds without bundle regressions.

---

## Boundaries & Principles

- **Always do:**
  - Reuse tokens from `tokens.css` (no hardcoded px/hex).
  - Use named exports.
  - Preserve 60fps rAF performance (<3s response).
- **Never do:**
  - Do not use `any`.
  - Do not import Navigation inside Sidebar (keep Sidebar purely generic).
  - Do not inline SVGs (use `Icon` component).
