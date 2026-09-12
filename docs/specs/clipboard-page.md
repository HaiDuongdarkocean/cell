# Spec: Cell Clipboard Page

> Source of truth cho tính năng Clipboard Page trong Cell MV3.
> Tổng hợp từ `docs/intent/clipboard-page.md` (15 rounds feedback) + prototype trong `design-system-showcase`.
> **Revised after Round 16** — standalone page + orbital + token SSOT + dark/light.

## 0. Day-1 Shipable Scope

- **Standalone extension page** (như Reader) — `chrome.tabs.create({ url: chrome.runtime.getURL('src/entrypoints/clipboard/index.html') })`.
- **Orbital entry point** — OrbitalBadge floating trên host page, click → mở universal panel → user click button Clipboard trên thanh dọc → clipboard page.
- **System clipboard read** — `navigator.clipboard.readText()` trên `visibilitychange` + `focus` event (event-based, không poll). Manual button + auto-update toggle.
- **Multi-item history** với CRUD (add/rename/delete/pin) + tự đặt tên. Tối đa 30 items — vượt quá tự xóa item lâu nhất (pinned được bảo vệ).
- **Height-based pagination** — cả 2 chế độ (tách câu ON + OFF), content overflow container thì phân trang.
- **Pagination control** — `‹‹ ‹ 1 2 3 ... 98 99 100 › ››` + ellipsis popup + direct page input.
- **Edit mode** — nút edit riêng (không click text trực tiếp, tránh conflict dictionary lookup).
- **Search** — filter clipboard history theo name + text.
- **Responsive mobile-first** 320→desktop — mobile: content hiện trước, sidebar slide-in.
- **Dark/light** — token SSOT từ `tokens.json`, theme system lo (không toggle).
- **Token SSOT** — tất cả CSS dùng `var(--color-*)`, `var(--space-*)`, `var(--radius-*)` từ `tokens.css`. KHÔNG dùng `var(--md-sys-color-*)`.
- **Component SSOT** — tất cả UI dùng `src/shared/ui/*` (Button, Card, IconButton, Toggle, SliderRow, Select, CopyButton). KHÔNG tự tạo.

**Out of scope:**
- Toggle tokenize (universal panel đã có)
- Dark/light toggle (theme system lo)
- 2-way bridge (Cell → native)
- Clipboard write back to system
- Sync across devices

---

## 1. Objective

Cell Clipboard Page cho phép người học ngoại ngữ (5–80 tuổi, persona chính 10–25) đọc system clipboard text trong một standalone page đầy đủ chức năng: history multi-item, CRUD, search, pin, pagination, inline edit, tách câu, font controls — tất cả reuse tokenize + dictionary popup từ universal panel.

**Flow mở clipboard page:**
1. User dùng native app (game, app ngoài browser) → copy text
2. OrbitalBadge floating trên host page → click → mở universal panel
3. User click button Clipboard trên thanh dọc universal panel
4. Clipboard standalone page mở trong tab mới
5. User đọc, tra từ (click text → dictionary popup), edit, copy cue sentences

**Thành công khi:**
- User mở clipboard page từ orbital → universal panel → clipboard button
- History hiển thị pinned + recents, CRUD hoạt động, search filter
- Pagination height-based hoạt động cả 2 chế độ (tách câu ON + OFF)
- Edit mode qua nút edit, không conflict dictionary lookup
- Dark/light tự hoạt động qua token system
- Build pass, typecheck 0 lỗi, tests pass, browser verify pass

---

## 2. Tech Stack

| Layer | Lựa chọn | Lý do |
|---|---|---|
| Framework | React 19 + Vite + TypeScript | Cùng stack với toàn bộ Cell. |
| Entry point | Vite multi-page — thêm `clipboard` vào `rollupOptions.input` | Như Reader pattern. |
| State | Zustand (`clipboardStore`) | Local page state, consistent với Reader. |
| Storage | `chrome.storage.local` cho clipboard history | Text nhỏ, <5MB, đủ cho MV3. |
| Clipboard API | `navigator.clipboard.readText()` | Native, cần document focused + user gesture. |
| Tokenize | `tokenizeTextBlock` từ `src/features/tokenize/` | Reuse, không build lại. |
| Dictionary | `DictionaryPanelView` + `useDictionaryLookup` | Reuse từ universal panel. |
| Orbital | `OrbitalBadge` từ `src/features/dictionaryPopup/ui/OrbitalBadge.tsx` | Floating badge, draggable, click → popup. |
| UI components | `src/shared/ui/*` (Button, Card, IconButton, Toggle, SliderRow, Select, CopyButton) | SSOT, không tự tạo. |
| Tokens | `tokens.json` → `tokens.css` (`var(--color-*)`, `var(--space-*)`, `var(--radius-*)`) | SSOT, dark/light tự hoạt động. |

---

## 3. Commands

```bash
# Dev
cd "<repo-root>" && npm run dev

# Typecheck
npm run typecheck

# Unit tests
npm run test:unit

# Build (cần chạy sau mỗi lần sửa src)
npm run build

# Regenerate tokens (nếu sửa tokens.json)
node scripts/generate-tokens.js

# Mock pages (nếu cần test dictionary/tokenize)
npm run mock
```

---

## 4. Project Structure

```
src/
├── entrypoints/
│   ├── clipboard/
│   │   ├── index.html              # Clipboard standalone page
│   │   ├── main.tsx                # React root + tokens.css import
│   │   ├── App.tsx                 # Layout: sidebar + detail panel
│   │   └── styles/
│   │       └── global.css          # Page-level (import tokens.css)
│   └── background/handlers/
│       └── clipboard.ts            # Open clipboard page handler
├── features/
│   └── clipboard/
│       ├── components/
│       │   ├── ClipboardSidebar.tsx       # Sidebar: header + search + collapse + sections
│       │   ├── ClipboardItemCard.tsx      # Item card: name · time · kebab menu
│       │   ├── ClipboardDetailPanel.tsx   # Detail: header + content + pagination
│       │   ├── ClipboardContent.tsx       # Text display: read-only / edit mode
│       │   ├── ClipboardPagination.tsx    # Pagination control: ‹‹ ‹ 1 2 3 ... › ››
│       │   └── ClipboardSettings.tsx      # Settings popover: auto-update, tách câu, font
│       ├── logic/
│       │   ├── pagination.ts             # Height-based page break computation
│       │   └── clipboardReader.ts         # System clipboard read logic
│       ├── store/
│       │   └── clipboardStore.ts          # Zustand store: items, selectedId, search, pinned
│       └── types.ts                       # ClipboardItem, ClipboardStore
├── shared/
│   ├── ui/                          # Reuse: Button, Card, IconButton, Toggle, SliderRow, Select, CopyButton
│   └── styles/
│       ├── tokens.json              # SSOT — sửa ở đây
│       └── tokens.css               # Generated — KHÔNG sửa trực tiếp
└── features/
    ├── dictionaryPopup/
    │   └── ui/OrbitalBadge.tsx      # Reuse: orbital entry point
    └── universalPanel/
        └── UniversalPanel.tsx       # Thêm button Clipboard trên thanh dọc
```

---

## 5. Code Style

```tsx
// Named export, function component, no `any`
import { useState, useCallback } from 'react';
import { Button, Card, IconButton } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import type { ClipboardItem } from '@/features/clipboard/types';
import styles from './ClipboardSidebar.module.css';

export function ClipboardSidebar({ items, onSelect }: ClipboardSidebarProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  // ...
  return (
    <aside className={styles.sidebar}>
      <Card variant="interactive" className={styles.itemCard} onClick={onSelect}>
        <span className={styles.itemName}>{item.name}</span>
      </Card>
    </aside>
  );
}

// CSS: dùng token SSOT, KHÔNG dùng md-sys-color
.sidebar {
  width: 280px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: var(--space-2);
}
```

**Conventions:**
- Named export, function component + hooks
- `var(--color-*)`, `var(--space-*)`, `var(--radius-*)` — KHÔNG `var(--md-sys-color-*)`
- `import { Button, Card } from '@/shared/ui'` — KHÔNG tự tạo
- Icon: đọc `src/shared/icons/index.ts` catalog trước → reuse hoặc tạo mới + thêm vào catalog
- CSS module per component
- `ponytail:` comment cho deliberate simplifications

---

## 6. Data Model

```ts
interface ClipboardItem {
  readonly id: number;
  readonly name: string;
  readonly text: string;
  readonly updatedAt: string;  // ISO timestamp hoặc relative ("now", "14:32")
  readonly pinned: boolean;
}

interface ClipboardStore {
  readonly items: ClipboardItem[];
  readonly selectedItemId: number;
  readonly searchQuery: string;
  readonly sidebarCollapsed: boolean;
  readonly mobileSidebarOpen: boolean;
  readonly settingsOpen: boolean;
  readonly isEditing: boolean;
  readonly contentPage: number;
  // settings
  readonly autoUpdate: boolean;
  readonly splitSentences: boolean;
  readonly fontSize: number;
  readonly fontFamily: 'system' | 'serif' | 'mono' | 'sans';
  // actions
  readonly addItem: () => void;
  readonly pruneOldItems: () => void;  // auto-delete oldest if >30 items (pinned protected)
  readonly renameItem: (id: number, name: string) => void;
  readonly deleteItem: (id: number) => void;
  readonly togglePin: (id: number) => void;
  readonly selectItem: (id: number) => void;
  readonly setSearchQuery: (q: string) => void;
  readonly setSidebarCollapsed: (v: boolean) => void;
  readonly setMobileSidebarOpen: (v: boolean) => void;
  readonly setSettingsOpen: (v: boolean) => void;
  readonly setEditing: (v: boolean) => void;
  readonly setContentPage: (p: number) => void;
  readonly setAutoUpdate: (v: boolean) => void;
  readonly setSplitSentences: (v: boolean) => void;
  readonly setFontSize: (n: number) => void;
  readonly setFontFamily: (f: string) => void;
  readonly readClipboard: () => Promise<void>;
}
```

---

## 7. UI Specification

### 7.1 Layout

```
Desktop (≥600px):
┌─────────────┬──────────────────────────────────┐
│  Sidebar    │  Detail Panel                    │
│  280px      │  flex: 1                         │
│  fixed      │                                  │
│             │                                  │
│  Header     │  Header: [name] [Copy][Edit][⚙]  │
│  Search     │                                  │
│  + New      │  Content (overflow → pagination) │
│  Pinned     │                                  │
│  Recents    │  Pagination: ‹‹ ‹ 1 2 3 › › ››   │
└─────────────┴──────────────────────────────────┘

Mobile (<600px):
┌──────────────────────────────────┐
│  Detail Panel (hiện trước)       │
│  Header: [≡][name]        [⋮]    │
│                                  │
│  Content                         │
│                                  │
│  Pagination                      │
└──────────────────────────────────┘
  Sidebar slide-in từ trái (85% width, max 320px)
  Click item → tự đóng sidebar
```

### 7.2 Sidebar

- **Header**: "Clipboard" title + search IconButton + collapse IconButton (chevronLeft/Right)
- **Search bar**: toggle hiện/ẩn, input filter theo name + text
- **New clipboard button**: outline Button với plus icon
- **Pinned section**: label "PINNED" + items có `pinned: true`
- **Recents section**: label "RECENTS" + items có `pinned: false`
- **Item card**: 1 dòng flex — `[pin icon] name (đậm, ellipsis) · time (nhạt) [kebab]`
  - Name: `font-weight: 500`, `text-overflow: ellipsis`, `white-space: nowrap`, `flex: 1`
  - Time: `opacity: 0.6`, `flex-shrink: 0`
  - Kebab: `opacity: 0.5`, hover → `opacity: 1`
  - Kebab menu: Rename, Pin/Unpin, Delete
- **Collapse**: width 280px → 44px (icon-only), chevron toggle
- **Mobile**: ẩn mặc định, slide-in từ trái, click item → đóng

### 7.3 Detail Panel

- **Header**: `detailNameGroup` (toggle mobile + name) + `detailActions`
  - `detailNameGroup`: flex, align-items center, justify-content flex-start, gap 8px
  - `detailName`: `white-space: nowrap`, `text-overflow: ellipsis` — clip ngay, không tách dòng
  - `detailActions` (trái→phải): Copy all | Edit | Settings
  - Mobile (<600px): 3 nút thu gọn thành kebab 3 chấm → dropdown Settings/Edit/Copy all
- **Settings popover**: auto-update Toggle, tách câu Toggle, font size SliderRow, font family Select
- **Content**: 
  - Read-only mặc định (`cursor: default`)
  - Edit mode khi click Edit button (`contentEditable`, `cursor: text`, background highlight)
  - Click Edit lại (check icon) → save → updatedAt update
  - Click text = dictionary lookup (không edit)
  - Split ON: mỗi sentence có CopyButton riêng
  - Split OFF: 1 CopyButton "Copy all" trong detailActions
- **Pagination** (cả 2 chế độ):
  - Height-based: đo content height vs container height, split thành pages
  - Split ON: paginate sentences
  - Split OFF: paginate word chunks (accumulate words cho đến khi height overflow)
  - Control: `‹‹ ‹ 1 2 3 ... 98 99 100 › ››` + [Go: __] input
  - Ellipsis (...) click → popup page list (mobile-friendly)
  - Desktop: input số trang + Enter → jump
  - Pagination `flex-shrink: 0` — không che content
  - Background `var(--color-surface-hover)`, border-radius `var(--radius-card)`

### 7.4 Orbital Entry Point

- OrbitalBadge floating trên host page (draggable, snap to edge)
- Click orbital → mở universal panel
- Universal panel thêm button Clipboard trên thanh dọc
- Click button Clipboard → `chrome.tabs.create({ url: clipboard page })`

### 7.5 Dark/Light Mode

- Token SSOT: `tokens.json` → `tokens.css` defines `:root` (light) + `[data-theme="dark"]` (dark)
- Tất cả CSS dùng `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`
- Theme system lo dark/light — không có toggle trong clipboard page
- `tokens.css` import trong `main.tsx`: `import '@/shared/styles/tokens.css'`

---

## 8. Pagination Algorithm

```
computePageBreaks(containerHeight, units, measureEl):
  breaks = [0]
  currentHeight = 0
  
  if splitSentences:
    for each sentence:
      measure sentence height
      if currentHeight + sentenceHeight > containerHeight:
        breaks.push(sentenceIndex)
        currentHeight = sentenceHeight
      else:
        currentHeight += sentenceHeight
  else:
    currentLine = ""
    for each word:
      testLine = currentLine + " " + word
      measure testLine height
      if testHeight > containerHeight:
        breaks.push(wordIndex)
        currentHeight = 0
        currentLine = word
      else:
        currentHeight = testHeight
        currentLine = testLine
  
  return breaks
```

**Complexity:** O(n) where n = sentences or words. Ponytail: measure per-unit is O(n) DOM reads — acceptable for clipboard text (<10k words). If text >50k words, upgrade to binary search on cumulative heights.

**ResizeObserver**: recompute on container resize.

---

## 9. Testing Strategy

| Level | What | Framework |
|---|---|---|
| Unit | pagination logic, clipboardStore actions, clipboardReader | Vitest + jsdom |
| Unit | ClipboardItemCard render, kebab menu, CRUD | Vitest + @testing-library/react |
| Unit | ClipboardPagination render, ellipsis popup, page jump | Vitest + @testing-library/react |
| Integration | ClipboardSidebar + DetailPanel interaction | Vitest + @testing-library/react |
| E2E | Open clipboard page from orbital → universal panel | Manual / browser verify |
| Visual | Dark/light mode, responsive 320→desktop | Browser verify via MCP |

**Coverage:** pagination logic 100%, store actions 100%, component render >90%.

---

## 10. Boundaries

- **Always:**
  - Dùng token SSOT (`var(--color-*)`), KHÔNG `var(--md-sys-color-*)`
  - Dùng component SSOT (`src/shared/ui/*`), KHÔNG tự tạo
  - Icon: đọc catalog trước, reuse hoặc thêm vào catalog
  - Run `npm run build` sau mỗi sửa src
  - Named export, function component, no `any`
  - Responsive mobile-first 320→desktop
- **Ask first:**
  - Thêm dependency mới
  - Sửa `tokens.json`
  - Sửa `manifest.json`
  - Thay đổi universal panel structure (thêm button Clipboard)
- **Never:**
  - Commit secrets
  - Inline SVG trong component (import từ catalog)
  - Hardcoded color/spacing (dùng token)
  - Default export
  - Class component

---

## 11. Success Criteria

- [ ] Clipboard page mở được từ orbital → universal panel → clipboard button
- [ ] Sidebar: search, collapse, pinned/recents sections, kebab menu (rename/pin/delete)
- [ ] Item card: 1 dòng (name · time · kebab), name ellipsis khi dài
- [ ] Detail: Copy all | Edit | Settings, mobile kebab collapse
- [ ] Edit mode: click Edit → contentEditable, click check → save
- [ ] Pagination height-based cả 2 chế độ (split ON: sentences, OFF: word chunks)
- [ ] Pagination control: ‹‹ ‹ 1 2 3 ... 98 99 100 › ›› + ellipsis popup + Go input
- [ ] Pagination không che content (flex-shrink: 0)
- [ ] Mobile: content hiện trước, sidebar slide-in, click item → đóng sidebar
- [ ] Dark/light tự hoạt động qua token system
- [ ] Tất cả CSS dùng `var(--color-*)`, KHÔNG `var(--md-sys-color-*)`
- [ ] Tất cả UI dùng `src/shared/ui/*`, KHÔNG tự tạo
- [ ] Tối đa 30 items — vượt quá tự xóa item lâu nhất (pinned bảo vệ)
- [ ] Auto-update: event-based (visibilitychange + focus), không poll, 0 CPU khi tab hidden
- [ ] Button Clipboard cùng level Dictionary/Settings trên thanh dọc universal panel
- [ ] Build pass, typecheck 0 lỗi, tests pass

---

## 12. Open Questions

1. ~~**Universal panel button Clipboard** — button này nằm ở đâu trên thanh dọc?~~ → **Resolved**: cùng level với Dictionary/Settings trên thanh dọc universal panel.
2. ~~**Clipboard storage limit** — tối đa bao nhiêu items?~~ → **Resolved**: tối đa 30 items. Khi thêm item mới vượt 30 → tự động xóa item lâu nhất (updatedAt cũ nhất, pinned items được bảo vệ — không xóa).
3. ~~**Auto-update interval** — khi auto-update ON, poll interval bao nhiêu?~~ → **Resolved**: cập nhật nhanh nhất có thể nhưng đảm bảo performance. Strategy: `navigator.clipboard.readText()` trên `visibilitychange` + `focus` event (không poll interval). Khi tab visible hoặc focus → read 1 lần. Nếu text thay đổi vs last read → add new item. Không poll liên tục → 0 CPU khi tab hidden.
4. ~~**Clipboard read permission** — `navigator.clipboard.readText()` cần permission prompt. UX như thế nào?~~ → **Resolved**: native browser prompt — gọi thẳng `navigator.clipboard.readText()`, browser tự handle permission dialog. Không custom, không overengineer.
