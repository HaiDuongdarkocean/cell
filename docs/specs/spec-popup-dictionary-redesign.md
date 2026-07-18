# Spec: Popup Dictionary Redesign — Active Entry + Collapsed Candidates

> **Phase**: G1 (spec, trước implement).
> **Spec gốc (không thay thế)**: `docs/specs/spec-popup-dictionary.md`.
> **Mockup (source of truth visual)**: `docs/mockups/popup-dictionary-redesign-wireframe.html`.
> **Variant candidates IA**: `docs/mockups/candidates-ia-variants.html` — đã chọn **Variant D (Hybrid chips + expand)**.
> **ADRs liên quan**: ADR-038 (popup dictionary shadow DOM + vanilla DOM).

Spec này **chỉ định những gì thay đổi** so với spec gốc. Mọi thứ không đề cập đến giữ nguyên theo spec gốc.

---

## 1. Objective

**Problem**: Popup dictionary hiện tại có 4 vấn đề UX (xác nhận qua mockup `docs/mockups/image/image.png` + user feedback):

1. **Header actions cạnh word** — Settings/Send/Quick Add/Close nằm cùng dòng với term, cạnh tranh attention với nội dung chính.
2. **Mỗi candidate có toolbar riêng** — `appendCandidateContent` tạo `.js-cell-toolbar-slot` cho mỗi candidate → nhiễu thị giác gấp đôi khi có nhiều candidate; mỗi candidate có audio/image/translate/links khác nhau nhưng UI cho thấy "bình đẳng".
3. **Definition bị che** — toolbar nằm giữa header và definitions; panel vật liệu (audio/image) có `max-height: 200px` ăn chỗ → definitions bị đẩy ra ngoài viewport khi popup nhỏ.
4. **Candidates bị mất khi popup nhỏ** — `.cell-candidate` là flex container, active entry `flex-shrink: 0` chiếm hết chỗ → candidates bị co về 0px (pattern `css-flex-min-width-zero-shrink`).

**Solution**: Active Entry + Collapsed Candidates model (Variant D):

- **1 active entry** hiển thị đầy đủ (header + definitions + toolbar).
- **Candidates = hybrid chips + expand**: chips ngang compact mặc định, nút ▾ (sticky bên phải) mở list chi tiết với def preview.
- **1 toolbar duy nhất** cho popup, context = active term (không per-candidate toolbar).
- **Toolbar nằm trên chips candidates** (không nằm trong active entry).
- **Toolbar body collapse khi expand list mở** → nhường chỗ cho list chi tiết.
- **Header 3-row layout**: word / IPA / status+frequency (IPA dài không kéo badge xuống lạc chỗ).

**User**: Người học ngôn ngữ qua video, thường đúng term đầu tiên (winner), thỉnh thoảng cần chọn candidate khác.

**Success (testable)**:
- Definition luôn visible tối thiểu 50% chiều cao popup ở mọi kích thước (Mobile 360×400 → Large 620×560).
- Candidates (chips) luôn visible ở mọi kích thước popup.
- Click chip → active entry đổi toàn bộ (header, definition, audio/image/translate/links, Quick Add prefill).
- Click ▾ → list chi tiết hiện, toolbar body collapse; click ▾ lại → list ẩn, toolbar body mở lại.
- 1 toolbar duy nhất cho popup, không phải per-candidate.
- Header: word 1 hàng, IPA 1 hàng, status+frequency 1 hàng (IPA dài không đẩy badge).
- Header actions chỉ còn Quick Add (primary) + More (3 dots menu: Settings, Send to Creator, Close).
- Responsive: Mobile bottom sheet, Tablet, Desktop, Large — cùng cấu trúc, chỉ khác kích thước.

---

## 2. Information Architecture

### 2.1 Reading flow (mới)

```
1. Word (largest, bold)           ← primary
2. Pronunciation (IPA/pinyin)     ← secondary, muted
3. Status + Frequency badges      ← metadata, cùng hàng
4. Definitions                    ← primary content
5. Learning toolbar (Audio/Image/Translate/Links)  ← secondary, context active term
6. Candidates chips               ← tertiary, compact
7. Quick Add (primary action)     ← header right
8. More menu (Settings/Send/Close) ← header right, secondary
```

### 2.2 DOM structure (mới)

```
.cell-popup
└── .cell-popup__content (flex column, overflow hidden)
    ├── .cell-active-entry (flex:1 1 auto, min-height:0, overflow-y:auto)
    │   ├── .cell-header (sticky top, 3-row)
    │   │   ├── .cell-header__row (word + actions)
    │   │   │   ├── .cell-header__main (word + IPA + badges, stacked)
    │   │   │   │   ├── .cell-header__word
    │   │   │   │   ├── .cell-header__ipa
    │   │   │   │   └── .cell-header__badges (status + frequency)
    │   │   │   └── .cell-header__actions (Quick Add + More)
    │   │   └── (removed: row3 — gộp vào .cell-header__badges)
    │   └── .cell-def (definitions, flex:1)
    ├── .cell-materials (flex:0 0 auto, border-top)
    │   ├── .cell-materials__bar (tabs: Audio/Image/Translate/Links)
    │   └── .cell-materials__body (panel content, collapse khi expand list mở)
    ├── .cell-candidates (flex:0 0 auto, border-top)
    │   ├── .cell-candidates__chips (flex row, không scroll)
    │   │   ├── .cell-candidates__chips-scroll (flex:1, scroll-x)
    │   │   │   └── .cell-chip (per candidate, active highlighted)
    │   │   └── .cell-chip__expand (flex-shrink:0, sticky right, ▾ button)
    │   └── .cell-candidates__list (max-height 40%, hidden mặc định)
    │       └── .cell-candidate-item (word + meta, click to select)
    └── .cell-footer (status badge + Send to Creator + Settings)
```

### 2.3 State changes (mới)

| State field | Type | Mô tả |
|---|---|---|
| `activeCandidateIndex` | `number` | Index của candidate đang active (0 = winner). Mặc định 0. |
| `candidatesExpanded` | `boolean` | List chi tiết đang mở hay đóng. Mặc định `false`. |
| `perCandidateState` | `Map<number, CandidateState>` | Per-candidate: status, definitionSelection, audioSelection, imageSelection, audioItems, imageItems, translation, translationSelected. |

**Removed state** (không còn per-candidate toolbar):
- `additionalResults` giữ nhưng chỉ render chips + list, không render full candidate.
- Per-candidate `candidateTab`, `candidateAudioItems`, etc. → gộp vào `perCandidateState`.

---

## 3. Acceptance Criteria

### AC-1: Header 3-row layout
- [ ] `.cell-header__word` ở hàng 1, font-size-2xl, bold, ellipsis khi dài.
- [ ] `.cell-header__ipa` ở hàng 2, font-size-sm, muted, `word-break: break-word` (IPA dài wrap).
- [ ] `.cell-header__badges` ở hàng 3, flex row, chứa status + frequency badges.
- [ ] IPA dài không đẩy status/frequency xuống hàng thứ 4.
- [ ] Header actions chỉ có Quick Add (primary, `.icon-btn--filled`) + More (3 dots, `.icon-btn`).
- [ ] Settings/Send to Creator/Close chuyển vào More menu (dropdown hoặc popover).

### AC-2: Active entry scroll riêng
- [ ] `.cell-active-entry` có `flex: 1 1 auto; min-height: 0; overflow-y: auto`.
- [ ] Khi popup nhỏ, active entry tự scroll, không co về 0.
- [ ] Header sticky top trong active entry scroll.

### AC-3: Definitions luôn visible
- [ ] `.cell-def` nằm trong active entry, `flex: 1`.
- [ ] Definitions chiếm tối thiểu 50% chiều cao active entry.
- [ ] Toolbar không che definitions (toolbar nằm ngoài active entry).

### AC-4: Toolbar 1 duy nhất, context active term
- [ ] Chỉ 1 `.cell-toolbar` cho toàn bộ popup.
- [ ] Toolbar nằm giữa active entry và candidates (không nằm trong active entry).
- [ ] Click chip đổi active candidate → toolbar re-render với audio/image/translate/links của candidate mới.
- [ ] Không còn `.js-cell-toolbar-slot` per-candidate.

### AC-5: Candidates chips + expand (Variant D)
- [ ] `.cell-candidates__chips` luôn visible, `flex: 0 0 auto`.
- [ ] Chips scroll-x trong `.cell-candidates__chips-scroll`, expand button sticky bên phải.
- [ ] Expand button không bị che khi nhiều candidate (flex-shrink:0, ngoài scroll container).
- [ ] Click chip → active candidate đổi, chip active highlight (`.cell-chip--active`).
- [ ] Click ▾ → `.cell-candidates__list` hiện (max-height 40%), ▾ rotate 180deg.
- [ ] Click ▾ lại → list ẩn, ▾ rotate về 0.
- [ ] List item: word + 1 dòng def preview, click để chọn candidate.

### AC-6: Toolbar collapse khi expand list mở
- [ ] Khi `candidatesExpanded = true`, `.cell-materials--collapsed` thêm vào toolbar.
- [ ] `.cell-materials--collapsed .cell-materials__body { display: none }` — panel ẩn, chỉ còn tab bar.
- [ ] Khi `candidatesExpanded = false`, toolbar body mở lại.
- [ ] Tab bar luôn visible (user vẫn switch tab được khi list mở).

### AC-7: Per-term materials khác nhau
- [ ] Mỗi candidate có `audioItems`, `imageItems`, `translation` riêng (lưu trong `perCandidateState`).
- [ ] Click chip → toolbar re-fetch/reuse cache cho candidate mới.
- [ ] Quick Add prefill dùng `perCandidateState[activeCandidateIndex]`.

### AC-8: Responsive mọi kích thước
- [ ] Mobile (360×400): bottom sheet, active entry scroll, chips visible, toolbar visible.
- [ ] Small (440×480): active entry scroll, chips visible, list expand max-height 40%.
- [ ] Desktop (480×520): active entry full, chips visible, list expand max-height 40%.
- [ ] Large (620×560): active entry full, chips visible, list expand max-height 40%.
- [ ] Candidates không bao giờ bị co về 0 (flex:0 0 auto, min-height của chips row ~44px).

### AC-9: Footer giữ nguyên
- [ ] Footer: status badge (cycle) + Send to Creator + Settings.
- [ ] Status cycle vẫn hoạt động (unknown → tracking → known → ignore).
- [ ] Send to Creator mở Card Creator prefill từ active candidate.

### AC-10: Backward compatibility
- [ ] `showPopup`, `appendCandidate`, `hidePopup`, `destroyPopup` API giữ nguyên signature.
- [ ] `LookupResult`, `DefinitionEntry`, `AudioItem`, `ImageItem` types không đổi.
- [ ] `TabPanelCache` per-term cache giữ nguyên.
- [ ] Quick Add payload structure không đổi.

---

## 4. Files to Change

| File | Change | LOC estimate |
|---|---|---|
| `src/features/dictionaryPopup/ui/popupContent.ts` | Refactor `renderHeader` (3-row), `renderCandidate` → `renderActiveEntry`, thêm `renderCandidateChips`, `renderCandidateList`. Bỏ `appendCandidateContent` full-render, thay bằng chips. | ~150 dòng đổi |
| `src/features/dictionaryPopup/ui/popupToolbar.ts` | Giữ `renderToolbar`, `renderAudioPanel`, etc. Bỏ per-candidate toolbar slot concept. | ~20 dòng đổi |
| `src/features/dictionaryPopup/ui/popupDictionary.css` | Thêm `.cell-active-entry`, `.cell-candidates`, `.cell-chip`, `.cell-chip__expand`, `.cell-candidates__list`, `.cell-candidate-item`, `.cell-materials--collapsed`. Sửa `.cell-header` 3-row. Bỏ `.cell-candidate` block style. | ~200 dòng đổi |
| `src/features/dictionaryPopup/ui/popupDictionaryController.ts` | Thêm `activeCandidateIndex`, `candidatesExpanded`, `perCandidateState`. Refactor `appendCandidate` → `addCandidate` (chỉ thêm vào chips + list). Refactor `rerender` → re-render active entry + chips. Thêm `setActiveCandidate`, `toggleCandidatesExpanded`. | ~200 dòng đổi |
| `src/features/dictionaryPopup/ui/popupContent.test.ts` | Update tests cho renderHeader 3-row, renderCandidateChips, renderCandidateList. | ~80 dòng đổi |
| `src/features/dictionaryPopup/ui/popupToolbar.test.ts` | Giữ mostly, update nếu signature đổi. | ~20 dòng đổi |
| `src/features/dictionaryPopup/ui/popupDictionaryController.test.ts` | Update tests cho activeCandidateIndex, candidatesExpanded, setActiveCandidate. | ~100 dòng đổi |

**Total**: ~770 dòng đổi, 7 files.

---

## 5. Out of Scope

- Đổi lookup logic, plugin, worker.
- Đổi Card Creator integration (chỉ đổi prefill source từ winner sang active candidate).
- Đổi popup shell (position, resize, shadow DOM).
- Đổi settings structure (chỉ thêm `defaultActiveTabPerLang` nếu chưa có — đã có theo spec gốc).
- Mobile native app (vẫn là web responsive).
- Animation/transition phức tạp (chỉ CSS transition cơ bản).

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Per-candidate state phức tạp, dễ leak | `perCandidateState: Map<number, CandidateState>` — mỗi candidate có state riêng, cleanup khi popup hide. |
| Rerender active entry mất chip scroll position | Chips scroll container riêng, rerender chỉ đổi `.cell-chip--active` class, không rebuild chips. |
| Toolbar collapse gây layout jump | CSS transition `max-height` trên `.cell-materials__body`. |
| Backward compat `appendCandidate` API | Giữ export `appendCandidate` nhưng internal chuyển sang `addCandidate` (chips + list). |
| Test coverage giảm | Update test song song với implement (TDD). |

---

## 7. Verification

```bash
# Unit tests (fast, ~3s)
npm run test:unit

# Typecheck
npx tsc --noEmit

# Build
npm run build

# Lint
npm run lint
```

**Manual verification** (qua Chrome DevTools MCP hoặc load extension):
1. Load extension, mở popup trên subtitle token.
2. Verify header 3-row layout đúng.
3. Verify definitions visible, toolbar nằm dưới definitions.
4. Verify chips candidates ở dưới toolbar.
5. Click chip → active entry đổi.
6. Click ▾ → list hiện, toolbar body collapse.
7. Resize popup nhỏ → active entry scroll, chips vẫn visible.
8. Mobile preset → bottom sheet, cùng cấu trúc.

---

## 8. Open Questions

Không có — tất cả đã confirm qua mockup review (Variant D, header 3-row, toolbar trên chips, expand sticky phải, toolbar collapse联动).

---

## 9. Implementation Order

1. **CSS first** — thêm classes mới, không xóa classes cũ (backward compat).
2. **popupContent.ts** — refactor renderHeader 3-row, thêm renderCandidateChips, renderCandidateList.
3. **popupDictionaryController.ts** — thêm state mới, refactor appendCandidate → addCandidate, thêm setActiveCandidate, toggleCandidatesExpanded.
4. **popupToolbar.ts** — bỏ per-candidate slot concept nếu cần.
5. **Tests** — update song song.
6. **Verify** — test:unit + tsc + build.
7. **Review** — subagent code-review-and-quality.
8. **Docs** — update 0-wiki.md, 2-architechture-system.md, ADR nếu cần.
9. **ACCUMULATE** — rút kinh nghiệm nếu có pattern mới.
