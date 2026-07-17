# Spec: SVG Icon Library (Lucide Reference Catalog)

## Objective

Tạo một **kho tham chiếu icon SVG** cho hệ thống cell, giải quyết vấn đề: mỗi agent gặp function/giao diện mới lại tự thêm inline SVG ad-hoc → mất đồng bộ, lệch style, tốn thời gian chờ chỉnh sửa.

**Nguyên lý cốt lõi (Socratic conclusion):** Library là **kho tham chiếu**, KHÔNG phải dependency runtime. 1600+ icon sống trong `docs/design-system/icon/` như catalog. Agent browse → chọn icon cần → **chỉ copy icon đó** vào `src/` khi dùng. Bundle không bao giờ phình vì chỉ icon được dùng mới vào code.

**User impact:** Agent AI (và developer) có 1 nguồn duy nhất để tìm icon. Không còn đoán stroke-width, không còn vẽ SVG ad-hoc, không còn lệch style. Mỗi lần cần icon: `ls`/`grep` catalog → copy → import.

**Success criteria:**
- `docs/design-system/icon/svg/` chứa toàn bộ 1600+ icon SVG từ Lucide (stroke 2.0, 24×24, round caps, currentColor).
- `docs/design-system/icon/LICENSE` chứa bản copy ISC license từ Lucide (nghĩa vụ pháp lý duy nhất khi redistribute source).
- `docs/design-system/icon/catalog.md` chứa index phân loại tất cả icon (theo tag/category của Lucide), agent có thể `Ctrl+F` tìm theo keyword.
- `docs/design-system/icon/README.md` mô tả workflow: cách tìm icon, cách bring vào `src/`, cách import, convention đặt tên.
- `docs/mockups/icon-svg/` (16 file cũ) bị xóa — thay bằng library mới.
- `npm run typecheck` pass (không chạm `src/`, nên không ảnh hưởng).
- Không thay đổi gì trong `src/` — library là tài nguyên docs, hoàn toàn tách biệt.

## Tech Stack

- **Icon source:** Lucide (`lucide-static` npm package — chỉ chứa raw `.svg` files, 0 JS runtime)
- **License:** ISC (OSI-approved, SPDX-listed, permissive như MIT — confirmed từ https://spdx.org/licenses/ISC.html + https://www.isc.org/licenses/ + https://github.com/lucide-icons/lucide/blob/main/LICENSE)
- **Build:** Không liên quan — library nằm trong `docs/`, không được build/bundle
- **Consumption:** Vite `?raw` import khi agent copy icon vào `src/shared/icons/svg/`

## Commands

```bash
# Cài lucide-static (dev-only, nguồn SVG)
npm install -D lucide-static

# Sync icon (sau khi cài hoặc update lucide-static)
node scripts/sync-icons.mjs

# Typecheck (verify không phá src/)
npm run typecheck

# Unit test (verify không phá test)
npm run test:unit
```

## Project Structure

```
docs/design-system/icon/
├── README.md              ← Workflow: cách tìm icon, cách bring vào src/, convention
├── LICENSE                ← Copy ISC license từ Lucide (nghĩa vụ pháp lý)
├── catalog.md             ← Index phân loại 1600+ icon (auto-generate từ Lucide tags)
└── svg/                   ← 1600+ file .svg (copy từ lucide-static)
    ├── play.svg
    ├── pause.svg
    ├── book-open.svg
    ├── graduation-cap.svg
    └── ... (1600+ files)

scripts/
└── sync-icons.mjs         ← Script: copy SVG từ lucide-static → docs/design-system/icon/svg/ + generate catalog.md

src/shared/icons/          ← KHÔNG tạo trong spec này. Tạo organically khi agent cần icon.
├── svg/                   ←   (chỉ icon dùng thật, copy từ docs/design-system/icon/svg/)
└── index.ts               ←   (re-export: `export { default as play } from './svg/play.svg?raw'`)
```

## Code Style

### SVG convention (Lucide gốc, không modify)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
     stroke-linejoin="round">
  <path d="..." />
</svg>
```

- `viewBox="0 0 24 24"` — bắt buộc
- `fill="none"` — icon stroke-based, không fill
- `stroke="currentColor"` — inherit color từ parent (theme-aware)
- `stroke-width="2"` — chuẩn Lucide (chấm dứt lệch 1.5 vs 2 hiện tại)
- `stroke-linecap="round"` + `stroke-linejoin="round"` — round caps
- **Không modify SVG** từ Lucide — giữ nguyên để đồng bộ và update được

### Naming convention

- File name: kebab-case, đúng tên Lucide (vd: `book-open.svg`, `graduation-cap.svg`, `fast-forward.svg`)
- Import name: camelCase (vd: `import bookOpen from '@/shared/icons/svg/book-open.svg?raw'`)

### Consumption pattern (documented trong README, chưa implement)

```typescript
// 1. Copy SVG cần dùng từ docs/design-system/icon/svg/ → src/shared/icons/svg/
// 2. Import với ?raw (Vite native)
import play from '@/shared/icons/svg/play.svg?raw';

// 3. Dùng trong component
<button dangerouslySetInnerHTML={{ __html: play }} aria-label="Play" />
```

## Testing Strategy

Library nằm trong `docs/` — không có logic code để test. Verification thay thế:

- **File count:** `ls docs/design-system/icon/svg/*.svg | wc -l` ≥ 1600
- **Style consistency:** random sample 10 SVG → tất cả phải có `stroke-width="2"` + `currentColor` + `viewBox="0 0 24 24"`
- **License present:** `docs/design-system/icon/LICENSE` tồn tại và chứa ISC text
- **Catalog generated:** `docs/design-system/icon/catalog.md` tồn tại và có entry cho mọi SVG
- **No src/ impact:** `npm run typecheck` pass, `npm run test:unit` pass
- **Script self-check:** `node scripts/sync-icons.mjs` chạy xong → exit 0, output báo số icon synced

## Boundaries

- **Always:**
  - Giữ nguyên SVG Lucide gốc — không modify stroke, không recolor, không resize
  - Giữ file `LICENSE` trong `docs/design-system/icon/` (nghĩa vụ pháp lý ISC)
  - Generate `catalog.md` bằng script, không hand-write
  - Update `docs/0-wiki.md` và `docs/2-architechture-system.md` sau khi tạo/xóa file (per AGENTS.md protocol)

- **Ask first:**
  - Thêm dependency mới ngoài `lucide-static`
  - Modify SVG Lucide (chỉ khi cần custom icon không có trong Lucide)
  - Tạo `src/shared/icons/` infrastructure (ngoài scope spec này — spec sau riêng)

- **Never:**
  - Touch `src/` trong spec này (library là docs-only)
  - Xóa `docs/mockups/icon-svg/` mà không verify không có reference nào trong code
  - Bundle toàn bộ 1600+ icon vào extension (chỉ icon dùng thật mới vào `src/`)

## Success Criteria

1. `docs/design-system/icon/svg/` chứa ≥ 1600 file `.svg` từ Lucide
2. Mọi SVG có `stroke-width="2"`, `stroke="currentColor"`, `viewBox="0 0 24 24"`, `fill="none"`, round caps
3. `docs/design-system/icon/LICENSE` chứa ISC license text đầy đủ
4. `docs/design-system/icon/catalog.md` phân loại toàn bộ icon theo tag, searchable
5. `docs/design-system/icon/README.md` mô tả workflow đầy đủ (find → copy → import → use)
6. `scripts/sync-icons.mjs` re-runnable: cài/update lucide-static → chạy script → catalog + SVG sync
7. `docs/mockups/icon-svg/` bị xóa (16 file cũ)
8. `npm run typecheck` + `npm run test:unit` pass (không phá code hiện có)
9. `docs/0-wiki.md` update mục lục (thêm icon library + xóa mockups/icon-svg reference nếu có)
10. `docs/2-architechture-system.md` update tree (thêm `docs/design-system/icon/`)

## Open Questions

Không còn — toàn bộ quyết định đã resolve qua Socratic:
- ✅ Format: raw .svg + index
- ✅ Source: Lucide (ISC, an toàn)
- ✅ Stroke: 2.0
- ✅ Scope: toàn bộ 1600+
- ✅ Location: docs/design-system/icon/ (kho tham chiếu, không runtime)
- ✅ Consumption: copy từng icon vào src/ khi cần, import `?raw`
- ✅ Migration: không chạm src/ hiện tại
- ✅ Icon cũ: xóa docs/mockups/icon-svg/

## Implementation Plan

### Task 1: Cài lucide-static + verify nguồn
- `npm install -D lucide-static`
- Verify: `ls node_modules/lucide-static/icons/*.svg` → ≥ 1600 file
- Verify: random sample có `stroke-width="2"`

### Task 2: Viết sync script
- `scripts/sync-icons.mjs`: copy `node_modules/lucide-static/icons/*.svg` → `docs/design-system/icon/svg/`
- Parse `node_modules/lucide-static/lucide.json` (metadata: tags, categories) → generate `catalog.md`
- Copy `node_modules/lucide-static/LICENSE` → `docs/design-system/icon/LICENSE`
- Self-check: báo số icon synced, exit 0

### Task 3: Chạy sync + verify output
- `node scripts/sync-icons.mjs`
- Verify file count ≥ 1600
- Verify catalog.md có entry cho mọi SVG
- Verify LICENSE tồn tại

### Task 4: Viết README.md (workflow)
- Cách tìm icon: `grep` catalog, `ls` svg folder
- Cách bring vào src/: copy file → `src/shared/icons/svg/`
- Cách import: `import x from '@/shared/icons/svg/x.svg?raw'`
- Convention: kebab-case file, camelCase import, không modify SVG
- License note: ISC, giữ LICENSE file

### Task 5: Xóa docs/mockups/icon-svg/ + verify không có reference
- `grep` trong src/ cho `icon-svg` → confirm không có import/reference
- Xóa `docs/mockups/icon-svg/` (16 file)

### Task 6: Update docs (wiki + architecture)
- Update `docs/0-wiki.md`: thêm icon library entry, xóa mockups/icon-svg entry nếu có
- Update `docs/2-architechture-system.md`: thêm `docs/design-system/icon/` vào tree

### Task 7: Final verification
- `npm run typecheck` pass
- `npm run test:unit` pass
- File count check
- Random sample 10 SVG → style check
