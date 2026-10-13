# Settings tab — interaction-level audit (post-redesign)

> Audit động trên SettingsDialogContent thật (design-system showcase mount production component), viewport 600/320, light/dark. Mọi finding có evidence: DOM role/aria, computed style, rect, element screenshot. Scripts: `tmp/settings-tab-redesign/audit{,2,3,4,5}.mjs` → `tmp/settings-tab-redesign/audit/`.

## Design Read

Settings tab sau redesign dùng grammar Section→Group→Row phẳng — hình thái đúng hướng (YouTube/Spotify-like bands). Audit tương tác lộ **một P0 toàn cục ở atom Toggle** (không phải lỗi redesign — regression từ commit khác) cộng các P1/P2 về overflow hẹp, a11y naming, và nhất quán menu chrome.

## Verified tốt (không phải finding)

| Behavior | Evidence |
|---|---|
| Select → menu mở, `aria-expanded=true`, listbox/option roles | report.json selects ×8 |
| Selected option có `aria-selected` + check icon + `primary-subtle` bg | `select-*.png`, computed `rgba(94,165,233,0.12)` |
| Keyboard nav qua `aria-activedescendant`, ArrowDown đổi option, Esc đóng | report.json `keynav`/`esc` |
| Menu không tràn ở 320 | `narrow320.rect.right=228 < vw=261` |
| Focus-visible ring 2px primary, cả dark (`rgb(106,178,245)`) | report2 `darkFocus`, `focus-tab.png` |
| MultiSelect: chips, `+` affordance/option, exclusive "All languages", menu giữ mở cho multi-pick | `p3-multiselect.png`, `msAfterSelect` |
| `labelFor`/`id` resolve tới control focusable (set-parallel → BUTTON) | report5 `labelClick.focused=true` |
| ShortcutInput: click→focus→gõ `J` capture được, có listening visual | report5 `shortcut.captured=true` |
| Profile radio cards: selected = primary-subtle + border + dot | `segmented-languageProfile.png` |
| Kebab menu: `role=menu`, menuitems Edit/Move up/down/Delete | report5 `kebabMenu` |
| HintIcon: tooltip `role=tooltip`, radius 12px + shadow token | report2 `hint_audio-mode-hint` |
| Nav `aria-current="true"` trên General; fade mask khi overflow | report.json `nav`, `navBtns.scrollable` |
| Dark menu: surface đậm + hairline + selected `primary-subtle` | report2 `darkMenu` |

## Findings

### P0 — Toggle track vô hình: mọi toggle render thành "chấm tròn trôi"

- **Question**: control có truyền đạt được trạng thái on/off không?
- **Aspect**: Components & States (function-blocking visual).
- **Evidence**: element screenshot `p4-switch-0-general.png` = chấm tròn đặc, không có pill track. Computed: `label._toggle_xs` 36×20; `input` `height:100%` + `box-sizing:border-box` + `border-block: (40−20)/2 = 10px` → `background-clip:padding-box` = **0px painted** → track `var(--toggle-default|active)` không bao giờ hiện. Chỉ `.thumb` (svg dot, `fill: var(--toggle-dot)`) render.
- **Root cause**: commit `c15604c4` "drop the touch-target min-size floor" gỡ `min-height: var(--touch-target)` khỏi `.toggle` → label co về `--toggle-h` (20px xs / 32px sm) → invariant "border insets track" vỡ. Trước đó label ≥40 → padding-box = 20px → track paint đúng (ảnh `before-direct-600-light-general.png` vẫn thấy pill xanh).
- **Blast radius**: `Toggle` default `size='xs'` và gần như mọi call site không truyền size → Settings (9+), `SrsStudySettings` ×6, `ResourceCard`, `SourceDetailPanel`, `AnkiStatusSyncPanel`, `StudyModesTab`, `CleanupRulesSection`, `TtsLanguagePanel`, popup `VideoCard`/`SubtitleCard`/`DownloadCard`… `sm` cũng bị degrade (track 24px thay vì 32px).
- **Fix (SSOT, 1 file `Toggle.module.css`)**: cho `.input` `box-sizing: content-box; width: var(--toggle-w); height: var(--toggle-h)` — border-transparent mở rộng hit-area ra **ngoài** thay vì ăn vào trong; track luôn paint đủ `toggle-h`. `.toggle` giữ `align-items:center` để input overflow đối xứng. md (pad=0) không đổi. Verify: element-shot toggle checked hiện pill xanh 36×20 + ring 40×40 hit area.

### P1 — ResourcesPanel band-input rows tràn ở ≤320px

- **Question**: layout hierarchy có sống sót ở độ rộng mobile tối thiểu không?
- **Aspect**: Layout & Responsive.
- **Evidence**: `report2.overflow320` — `[class*=bandInputWrap]` w=156 `flex:0 0 auto` trong `.bandRow` w=197 → `right=264–272 > vw=261` (~10–70px tràn); `_root/_wrapper/_input` theo sau. Ảnh 320 có horizontal scrollbar.
- **Fix**: `.bandInputWrap`/`bandInput` += `min-width:0` + `flex:1 1 auto` (hoặc `flex-shrink:1`) trong `ResourcesPanel.module.css`; input bên trong `width:100%`. Verify pixel: không element nào `right > vw` ở 320.

### P1 — `[role="listbox"]` của Select thiếu accessible name

- **Question**: screen reader đọc menu là "list của cái gì"?
- **Aspect**: Accessibility.
- **Evidence**: `lbInfo.lbLabel=null, lbLabelledBy=null` trên mọi select đã đo (8/8). Trigger có `aria-haspopup` nhưng popup không thừa hưởng label.
- **Fix (SSOT `Select.tsx`)**: `aria-labelledby={triggerId}` (id trigger) hoặc `aria-label` mirror label của control — một chỗ sửa phủ toàn app.

### P2 — Menu chrome không nhất quán giữa Select và Menu

- **Question**: hai loại floating menu trong cùng tab có cùng "shape language" không?
- **Aspect**: Visual System / SSOT.
- **Evidence**: Select menu surface `radius=12px`, `shadow 0 4px 6px -1px 6%`, bg `color(srgb 0.856 0.873 0.89)` (field-gray — gần trùng bg trigger → menu "chảy" liền trigger thay vì nổi); Menu (kebab LPP) `radius=6px`, bg gần-trắng `0.976`. Cùng là popup-menu mà 2 radius + 2 surface + cùng 1 shadow yếu.
- **Proposal**: converge cả hai lên **một** menu-surface recipe: `--color-surface` (elevated, không phải field) + `--radius-lg` + `--shadow-menu`/menu-level shadow. Select listbox hiện dùng surface riêng — đổi token một chỗ trong `Select.module.css`/Menu.

### P2 — Subnav affordance ở 320 chỉ còn fade, không còn chevron

- **Question**: user 5–80 tuổi có nhận ra còn section ẩn sau mép phải không?
- **Aspect**: Information Architecture / discoverability.
- **Evidence**: `navBtns.btns=[]` — không có `data-tihoka-id` scroll button nào trong DOM ở 320 (nav `sw=1183 > cw=213`, có `_fadeEnd_`). Commit `70a5d597` từng thêm chevron Buttons (`up-settings-subnav`), hiện code chỉ còn fade — chevron mất lúc nào đó trong rebuild.
- **Proposal**: fade-only là YouTube-acceptable nhưng yếu hơn spec trước; hoặc khôi phục bound-aware chevron (đã từng có), hoặc chấp nhận fade + cập nhật spec `up-settings-subnav` cho khớp reality. Quyết định cần Anh yêu.

### P3 — Row-level hover absent là cố ý; note để không "fix" nhầm

- SettingsRow không đổi bg khi hover (report5 `rowHover.changes=false`) — đúng grammar band tĩnh (chỉ control tương tác). Giữ.

## Mock limitations (không verify được trong showcase)

- Resources enable-toggles không flip: `onToggleComponent`/`setResourceEnabled` đi async IDB — showcase không có backend → im lặng. Cần spot-check trên extension thật.
- `resources`/`sync` panels render mock rỗng — cấu trúc row kiểm được nhưng data-state (progress bars, error alerts) không đầy.

## Verify commands

```bash
npm run typecheck && npm run lint && npm run test:unit && npm run build
node tmp/settings-tab-redesign/audit4.mjs   # element-shot toggle sau fix — phải thấy pill
```

---

## Round 2 — deep-interaction pass (2026-10-11)

Sau commit `3c908876`, pass thứ hai phủ các interaction chưa thao tác: dependent toggles, segmented groups, sliders, toggle keyboard, kebab→edit flow, New-profile flow, hint dismiss, menu flip, Tab order, contrast, reduced-motion.

### Verified đúng (DOM + computed + pixel)

| Interaction | Kết quả |
|---|---|
| Dependent toggles (`block`) | Parent `subtitleOverlayAutoLoad` off → children `disabled` + `opacity 0.5` (`--opacity-disabled`) ✓ |
| SegmentedControl ×3 | `aria-checked` exclusive (đúng 1 checked mỗi group), selected `primary-subtle` bg ✓ |
| Slider ×2 (wordBadge) | `role`/`aria-valuenow`/`min`/`max`, ArrowRight đổi value (36→37, 0.25→0.3) ✓ |
| Toggle keyboard | `:focus-visible` ring 2px primary + Space toggle ✓ |
| Hint dismiss | Esc + outside-click đều đóng tooltip ✓ |
| Menu flip ở mép dưới | Select cuối trang flip lên (`menuBottom 671 < triggerTop 676`), không clip ✓ |
| SearchableSelect | search input auto-focus, filter 184→1 option ✓ |
| Reduced-motion | transitions `1e-05s` — `prefers-reduced-motion` tôn trọng ✓ |
| Contrast | secondary text `rgb(90,106,122)`/surface `247,250,252` ≈ 5.2:1 AA ✓ |
| Form validation | "Add profile" disabled khi chưa chọn target ✓ |
| DictLinks dialogs | shared `Dialog` lo focus/trap ✓ |

### Findings round 2 — đã fix

| Sev | Finding | Fix | Verify |
|---|---|---|---|
| P1 | `ProfileForm` (add + edit) mở ra nhưng focus ở `BODY` — keyboard/SR user mất dấu form vừa mở | `ProfileForm.tsx`: `rootRef` + `useEffect` focus control đầu tiên (`input/[aria-haspopup]/select`) | `focusInsideForm: true`, `activeDesc: BUTTON.listbox` cả 2 mode |
| P1 | `SearchableSelect` listbox không accessible name (`aria-labelledby: null`) — cùng lỗi `Select` | `SearchableSelect.tsx`: `useId` triggerId + `aria-labelledby={triggerId}` trên `<ul role=listbox>` | `aria-labelledby="_r_1c_"` → resolve "Select target language" |
| P2 | Select + SearchableSelect popover `dialog-radius` vs canonical `Popover variant="menu"` `radius-md` — hai radius cho cùng surface-class "list of choices" | Converge `radius-md` ở cả `Select.module.css` + `SearchableSelect.module.css` | computed radius khớp Menu |

### Decision — giữ nguyên (keep, không fix)

- **Subnav 320px fade-only**: chevron từ `up-settings-subnav` không còn sau rebuild; fade-edge là grammar YouTube/Spotify trên mobile tab-bar và đúng chủ đích của implementation hiện tại (`showFadeStart/End` + CSS fade). Accept fade-only; nếu muốn chevron trở lại thì đó là design change riêng, không phải defect.
- **Add-form render trên group header, Edit-form render inline trong list**: khác vị trí nhưng đúng semantics — add-form gắn với action "New profile" phía trên danh sách, edit-form thay đúng card đang sửa. Giữ.

### Gates round 2

typecheck sạch · lint 0 err (4 warning cũ) · 2613 tests pass · build xanh (design-system-css 0 violations).

---

## Round 3 — minimalism pass + scored checklist (2026-10-11)

Request: per-section minimalism audit, cut non-essential copy, plus a grading checklist a fresh subagent can score.

### Scored checklist

`docs/audits/settings-ui-checklist.md` — 40 criteria across A–J with evidence pointers. Independent grader (`subagent_explore`, fresh context) scored **76/88 ≈ 86%** — verdict "minor polish list". All scorable findings below were applied; runtime-only items (contrast, dark shots) were already covered by earlier rounds.

### Simplification decisions (applied)

- **Section descriptions removed** where they restated content — General, Subtitles, Local player, Downloads, Shortcuts, Theme, Sync (7). Kept where they teach purpose/jargon: Language profiles, Resources, Media, Dictionary popup, Word badge, Audio. Dead `*.desc` keys deleted from en+vi.
- **Shortcut rows compacted**: `stacked` full-width inputs → label + compact key pill on one row (removed `flex:1` stretch). Section ~50% shorter, macOS-style.
- **Long row hints tightened** (en+vi): `showReadings`, `showWordTranslations`, `autoLoadAsr`, `autoTranslate`, `download.parallel`, `ankiSync.enabled`, `ankiSync.writeBack`, `ankiSync.addon.fallback` — all ≤ ~90 chars, one idea.
- **Nav ↔ title aligned**: `settings.shortcuts.title` "Keyboard Shortcuts"→"Shortcuts"; `dictionaryPopup.title` "Dictionary Popup"→"Dictionary popup" (en) / "Từ điển nổi"→"Tra từ nổi" (vi). General toggle renamed "Show dictionary popup" (was ambiguous with the section).

### Grader findings fixed

- B3 nav/title mismatch → aligned (above).
- C2 long descriptions → tightened (above).
- F3 literal `opacity: 0.5` → `var(--opacity-disabled)` in `Select.module.css` (trigger + option); `aria-disabled` added to disabled options (`Select.tsx`).
- F5 focus rings: `ShortcutInput` `:focus`→`:focus-visible` + `shadow-focus-primary`; `.surfaceTab` got `:focus-visible` ring.
- G1 non-token easings → `var(--ease-in-out)` (`Toggle` ×2, `MultiSelect`); dead `left` transition removed from Toggle thumb.
- D2 menu border converged: Select/SearchableSelect `color-border-emphasized` → `color-border` (matches canonical `Popover variant="menu"`).
- `role="list"` children got `role="listitem"` (`DictLinksManager`, `ResourcesPanel`).
- Dict-popup surface tabs: full tablist pattern — roving tabindex, Arrow/Home/End nav, `aria-controls` + `role="tabpanel"`/`aria-labelledby`.
- Heading skip fixed: `headingLevel={4}` → `{3}` (13 sections; dialog title is h2).
- `data-testid` → `data-tihoka-id` in `LanguageProfilePanel` (test infra reads `data-tihoka-id` via `tests/setup.ts`).
- **Profile delete now confirms**: new `Dialog` in `LanguageProfilePanel` (was instant delete while dict-link delete confirmed) + 4 i18n keys + tests updated.

### Rejected/deferred

- C4 (move hints to ⓘ): rejected — inline row descriptions are the deliberate redesign grammar; `HintIcon` stays for edge-case docs.
- H5 (32px icon buttons < 40px touch target): deferred — shared sizing decision, `data-compact-hit` marker has no consumer; needs design-system-level choice.
- J2 (menu surface recipe ×3): partial — border token converged; full extraction of a shared surface class deferred (small duplication, no drift left).

### Gates round 3

typecheck sạch · 2444 tests pass (settings+shared/ui+dictionary) · build xanh · screenshots regenerated 320/600.

---

## Round 4 — state coverage audit + cross-grade fixes (2026-10-11)

Method: enumerate every interactive control per section → drive default/hover/focus/active/selected/disabled → diff computed styles + pixel evidence (`tmp/settings-tab-redesign/audit-states/`). Then an independent fresh-context grader scored against `settings-ui-checklist.md`: **69/84 ≈ 82%** → all actionable findings fixed below.

### State-audit findings fixed (mine)

- Select option hover used `--color-field-hover-solid` (dark) vs canonical list-item hover `--color-surface-hover` — converged; measured identical to Menu item hover.
- `nameButton` (DictLinksManager + ResourceCard) had zero hover feedback — added `surface-hover`.
- False positives verified: slider/shortcutPill/nameButton focus rings work under real focus (programmatic-focus heuristic quirk).

### Cross-grade findings fixed (subagent)

- **P1 keyboard trap**: `ShortcutInput` captured `Tab`/`Shift+Tab` as shortcut bindings — the whole Shortcuts section was a keyboard dead-end. Tab now escapes.
- `SearchableSelect` close didn't restore focus to trigger (focus fell to `<body>`) — `triggerRef` + focus on close/select/Esc; dead `handleOptionKeyDown` removed.
- Two hand-rolled `radiogroup`s (profile cards, ProfileForm start-from) had all radios `tabIndex=0`, no arrows — new shared `radioGroupKeyNav` (roving tabindex + Arrow/Home/End, select-follows-focus).
- `MultiSelect` field focus was a 1px border change only — added `--shadow-focus` ring + `combobox`/`aria-expanded`/`aria-controls` wiring.
- Shortcut conflict dot invisible to AT — `role="img"` + `aria-invalid`/`aria-describedby` on the pill.
- Missing hovers: `.shortcutPill`, `.disclosure`, `.choice`.
- Dead hint "Quick Add sends new cards here" pointed at a phantom row — removed + 4 dead i18n keys dropped (en+vi).
- "Change" banner unmounted focused button without moving focus — banner ref now focuses the revealed select trigger.
- `HintIcon` tooltip unlinked + outside-click scoped to shadow root — `id`/`aria-describedby` + `ownerDocument` listener with `composedPath()`.
- Dict-popup `tabpanel` now `tabIndex={0}` (keyboard-reachable scroll region).
- Token cleanups: `opacity:0.5`→`--opacity-disabled` (Slider/Input/NavItem/ResourceCard), `0.7`→`--opacity-70` (HintIcon), `1px`→`--border-width-hairline`, `ease`/`ease-in-out` keywords→`--ease-in-out` (MultiSelect/NavItem/ResourceCard), dead CSS var fallbacks removed, redundant `opacity` in `.triggerDisabled` + `role="button"` on `<button>` + dead `styles.menuWrap` removed.
- Copy: `uiLanguage.hint` section-name mismatch, `advancedHint` capitalization, `Search...`→`Search…` (en+vi); `surfaceTabActive` color → `text-accent-strong`.
- Tests updated: MultiSelect searchbox→combobox role queries, Select `Search…` placeholder, shortcuts heading level 3.

### Deferred (noted for design-system backlog)

- Focus-ring recipe fragmentation (5 implementations render similarly; needs a shared `.focusRing`/token decision).
- `.slot`/`.nameButton` CSS duplicated across DictLinksManager/ResourcesPanel/ResourceCard — extract shared stylesheet later.
- Select vs SearchableSelect option surface recipes (radius, selected-text color) still differ; SearchableSelect menu is in-flow vs overlay.
- `ResourceCard` `min-width: 280px` literal — no matching size token.
- `sync.privacy` 267-char inline paragraph — move to HintIcon/learn-more row (SyncPanel scope).
- 32px icon buttons < 40px touch target — shared sizing decision.
- No way to clear a bound shortcut — feature gap, needs design.

### Gates round 4

typecheck sạch · lint 0 err (4 warning cũ) · **8628/8628 tests** · build xanh (design-system-css 0 violations) · live verify: Tab escape, arrow radio nav, banner focus, hover convergence — all pass.

## Round 5 — WCAG conformance audit + environment sweep (2026-10-11)

Method: `axe-core` (wcag2a/2aa/21a/21aa) on the settings showcase in light + dark, Chrome accessibility-tree dump (CDP), and an environment sweep — forced-colors, 200%-zoom reflow, RTL, reduced-motion (`tmp/settings-tab-redesign/audit-deep.mjs`).

### Axe findings fixed

- **color-contrast** (4 nodes, light theme): active subnav label/icon (`NavItem`), `Button` link variant, audio pipeline selected step (`AudioPipeline`), and `Alert` description (`opacity: 0.9` diluted `--alert-error-fg` to 4.44:1) — all moved to `--color-text-accent-strong` / `opacity: 1`. `color-text-accent` was an alias of `color-primary` (#5EA5E9 ≈ 2.4:1 on light surfaces — fails AA for all text usage).
- **heading-order**: `SourceDetailPanel` title `h5` under an `h3` section → `h4`.
- **Showcase shell**: preview iframe document lacked `lang`, `title`, a `main` landmark and any h1/h2 — `ViewportFrame` now sets `doc.lang`/`doc.title` and wraps preview content in `<main>` with visually-hidden h1+h2.
- **Zoom-200 clipped label** ("Choose package folder…", `sw=167 cw=86`): root cause — `SettingsRow` wraps at ≤480px but children kept `min-width: 0`, so both label and control shrank-and-clipped instead of wrapping. Narrow-width children now get `min-width: auto` → the pair reflows to two lines (verified pixel: full label + full button at 320px).
- Audit harness note: CSS `zoom: 2` does not affect media queries — zoom emulation now halves the iframe's CSS width (equivalent to real page zoom).

### Cross-grade (fresh-context subagent): 76/80 ≈ 95%

- **P2 missed twins** (same defect class): `SearchableSelect` `.optionSelected`/`.optionLabel`/`.checkMark` and `Menu` `.item[aria-checked]` still used `color-primary` on `primary-subtle` → `text-accent-strong`.
- `LocalPronunciationSettingsPanel`: status line now `role="status"` (was silent); raw `err.message` no longer leaks English browser errors — localized fallback.
- `SettingsRow`/`SettingsSection` hint icon: `aria-label` falls back to the hint text instead of `''` (empty-name icon button).
- `Sidebar` transition `ease-in-out` keyword → `--ease-in-out` token; `BrowserVoicePanel` `.saved` → `text-accent-strong`.
- Copy echo: `autoLoadAsr.hint` restated its title → description + key removed (en+vi).

### Deferred (design-system backlog)

- `--color-primary` itself fails AA as *text* color everywhere (≈2.4:1); ~20 `color: var(--color-primary)` text usages remain in other features — needs a token-level decision (darken primary vs migrate text usages), not a per-component sweep.
- `SearchableSelect` dual `testId`/`dataTestId` props resolve confusingly — API redesign needed.
- `MultiSelect` combobox lacks `aria-activedescendant` + arrow-key into suggestions (suggestions are Tab-reachable).
- `BrowserVoicePanel` nested `<button>` inside `role="button"` row.
- Menu surface recipe duplicated in Select/SearchableSelect/Popover (3 copies).
- `sync.privacy` ~230-char inline paragraph.

### Gates round 5

typecheck sạch · lint 0 err (4 warning cũ) · **8628/8628 tests** · build xanh (design-system-css 0 violations) · **axe 0 violations / 37 passes (light + dark)** · axtree 207 nodes, 0 unnamed interactive · forced-colors/RTL/reduced-motion clean · zoom-reflow verified by pixel at 320px.

## Round 6 — IA + shape redesign v2 (card-per-section, dict-popup grammar)

Driver: user design crit — "cấu trúc lộn xộng, không khoảng thở" + IA misfits + component-level shape/contrast bugs. Plan: `docs/intent/settings-tab-v2-redesign-plan.md` (runtime inventory → dict-popup design language → 11-point plan).

### IA merge — 13 → 11 sections

- `general` dissolved: UI language → `theme` (retitled **Appearance**, en+vi); "Show dictionary popup" → `dictionaryPopup` section.
- `localPlayer` (2 toggles) → `media` as a `SettingsGroup` ("Local player").
- `settings.general.showDictPopup*` keys renamed → `settings.dictionaryPopup.enabled*`; stale `useState('general')` init → `'languageProfile'`; `settings.media.desc` broadened.

### Component fixes (root cause, shared atoms)

- `SettingsSection` → card surface (`card-background`/`border`/`radius` + `space-4` padding); `SettingsDialog` mainCol flex column `gap: space-4`.
- `Select`/`SearchableSelect` triggers: `--input-radius` (pill) → `--radius-md` — same shape language as the menu they open.
- `Chip` sm/md own their height (`min-height` 24/32, `height:auto`) — previously `Button`'s 40px height made component chips oversized.
- `Toggle` thumb: inset 2px→4px, hairline `stroke: var(--color-border)`, `toggle.dot` token `primary-foreground`→`text-inverse` — Dawn's `primary-foreground` is navy (#1F2D3D) which painted the thumb dark on both tracks.
- Profile cards: selection surface moved from `.item` (painted card+kebab) to the card itself; resting card bg `color-field`; hover `color-field-hover`; meta text `color-text` (secondary failed AA on field: 4.28:1).
- `SettingsGroup` label optional — ResourcesPanel dropped its duplicate "Resources" title+subtitle (section above already says it); action-only header right-aligns via `:only-child:not(.lead)`.
- `sync.privacy` 230-char paragraph ×2 → `HintIcon` on the Sync section heading (with proper `hintAriaLabel`).
- Zoom-200 re-regression: `min-width:auto` resolves to 0 on `overflow:hidden` controls (button label clipped at cw=110) — interactive `SettingsRow` children now `flex-shrink:0` at ≤480px.
- Tests: ResourcesPanel mount marker `getByText('Resources')` → `'Add resource'` ×18 + dropped subtitle assertion.

### Cross-grade (fresh-context subagent): 85/88 ≈ 96.6% — APPROVE

All majors verified fixed; remaining P3s deferred: `testId`/`dataTestId` dual API, MultiSelect `aria-activedescendant`, menu-surface recipe ×3, master-toggle convention for dictionaryPopup, raw font-size in feature CSS, literal px hairlines.

### Gates round 6

typecheck sạch · lint 0 err (4 warning cũ) · **8628/8628 tests** · build xanh (0 CSS violations) · axe 0/37 light+dark · axtree 207 nodes 0 unnamed · forced-colors/RTL/reduced-motion/zoom-200 clean · screenshots 320/600/840 light+dark verified.
