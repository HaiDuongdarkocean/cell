# Intent: Player Mode mobile layout (<600px) — subtitle-first redesign

> Slug: `player-mode-mobile-layout` · Mode: interactive · Source: user statement (2026-10-05, 3 screenshots: current overlay, current PM <600px, target mockup)
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Trên viewport <600px, Player Mode không dùng được để học: dock đáy nhồi ~14 nút (NavCluster 6 + ClusterRightToolbar 8) thành 3 cột, subtitle block bị clip còn ~1 dòng (`max-height: var(--space-10)`), cuelist còn quá ít chiều cao; đồng thời 3 surface nổi khác (ComprehensionPill fixed top-right, CueRecommendFab, OrbitalBadge) chồng lên nhau → người học không đọc được subtitle — thứ PM tồn tại để phục vụ. | `PlayerModeOverlay.tsx:530-576` (dock 3-region), `PlayerModeOverlay.module.css:140-238` (dock grid + subtitle clip), screenshot `brave_e99aSweggZ.png` | high |
| Change | <600px PM chuyển từ "desktop dock thu nhỏ" sang mobile pattern: video top → cuelist chiếm phần giữa → rail nút contextual cạnh phải → bottom bar tối giản (exit, prev, repeat, play/pause hero, next, ⋯). Desktop ≥600px giữ nguyên layout hiện tại. | mockup `Zalo_UvYRMFY5BC.png` (14 vị trí đánh số), user statement | high |
| Solution | Responsive variant của PlayerModeOverlay cho <600px: giữ cấu trúc videoStage/contentOther, thay dock bằng bottom bar + right-edge action rail + anchored pill/CC; nút thừa gom vào ⋯ menu (`shared/ui/Menu`); màu theo token system, contrast planned. | user statement (đánh số 1-14 + "orbital nổi"), `subtitlePanelsShared.module.css` | high |
| Value | Người học trên phone/tablet nhỏ đọc được subtitle và điều khiển cue bằng 1 tay — parity với mobile apps học qua video (Language-Reactor-style) mà user expect; gỡ pain "quá nhiều nút ở dưới". | user statement | high |
| Stakeholder | Người học trên màn hình <600px (persona 5–80, thiết bị touch, RAM ≥1GB) — primary; Anh (product owner) duyệt layout; future maintainers đọc PM code. | AGENTS.md persona, user statement | high |
| Context | PM hiện đã phân nhánh <600px = column (video top + panel bottom + dock). data-tihoka-id contract C5 (`subtitle-panels-atom-decomposition.md:46`) phải giữ — e2e + tests bám selectors. Split-view AC (`subtitle-split-view-ac.md`) AC-6.3/6.4 phải re-verify. Orbital badge là mount riêng (`orbitalBadgeSync.ts`) ngoài shadow PM. | `subtitleSplitView.ts`, AC doc, `orbitalBadgeSync.ts:85-122` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Devin agents + Anh review | Build được trong `src/features/subtitle/ui/` hiện có; không đụng files agent khác đang in-flight | PM overlay đã isolate trong 1 component + CSS module — blast radius nhỏ |
| Customer | Mobile learner (<600px, touch) | Đọc subtitle + prev/repeat/play/next 1 tay; nút phụ vẫn reachable nhưng không chiếm chỗ | Touch target ≥44px (`--touch-target-mobile`), safe-area insets |
| Supplier/Dependency | Shadow-DOM mounts ngoài PM: ComprehensionPill (`mountComprehensionPill.ts`), OrbitalBadge (`mountOrbitalBadge.ts`), CueRecommendFab (trong SubtitlePanel) | Phải position tương thích với layout mới — không tự ý đặt chỗ | Pill/fab mount độc lập → cần coordinate position hoặc PM-owned anchor |
| Organization | Repo maintainers | Layout <600px tách rõ khỏi desktop; selectors giữ contract C5 | Không phá `data-tihoka-id` hiện có |
| Regulator | Chrome Web Store policy | none — UI-only change, không permission mới | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Cuelist là reading surface chính trên mobile PM — chiếm vùng giữa, scroll được, current cue nổi bật như card | F | mockup vùng 2; `CueList.tsx` đã có `data-current` + card styling | high |
| N2 | Transport tối giản ở bottom bar: exit, prev cue, repeat, play/pause (hero), next cue + ⋯ overflow. **Adaptive**: khi chưa có subtitle load, prev/next cue đổi thành rewind/forward (seek ±) | F | mockup vùng 9-14; user gate answer (rewind/forward thay prev/next khi không có subtitle) | high |
| N3 | Contextual actions (quick-add, edit-card/send-to-creator, cue-filter, generate-native) float cạnh phải, không chiếm bottom | F | mockup vùng 3-6; `ClusterRightToolbar.tsx:63-117` | high |
| N4 | Comprehension pill + manager-toggle (CC) neo phía trên bottom bar — vẫn tồn tại, không đè cuelist | F | mockup vùng 7-8; `mountComprehensionPill.ts` (fixed top-right hiện tại) | high |
| N5 | Orbital badge vẫn nổi + dùng được trong PM mobile | F | user statement; `orbitalBadgeSync.ts` mount ngoài PM host | high |
| N6 | Mọi action hiện có của PM vẫn reachable qua ⋯ menu (OCR, tools, panel-toggle, study modes…) — không mất chức năng; rewind/forward KHÔNG vào menu — chúng chỉ là adaptive swap của prev/next khi video không có subtitle | U | mockup vùng 14 + user gate: "còn lại tất cả vào trong ... menu" | high |
| N6b | Dock SubtitleBlock (EN+VI running text) bỏ khỏi mobile PM — cuelist là reading surface duy nhất | U | user gate: "Bỏ khỏi dock, chỉ cuelist"; mockup không có on-video text | high |
| N6c | Cuelist có 2 chế độ hiển thị — full list | chỉ active cue — chọn trong Subtitle Manager (persist setting) | F | user gate: "cue list ... hai chế độ ... ở trong subtitle manager" | medium (điểm đặt toggle exact sẽ chốt ở design) |
| N7 | Layout bám mockup về kích thước/cỡ chữ; màu theo design tokens, contrast đủ trên nền video/surface | U | user rule "giống hoàn toàn cả kích thước, cỡ chữ"; tokens.css | high |
| N8 | Desktop ≥600px và non-PM UI không đổi; `t`/Esc/shortcuts behavior giữ nguyên | R | scope statement | high |
| N9 | data-tihoka-id selectors hiện có không đổi (e2e + unit tests bám); id mới cho surface mới | S | `subtitle-panels-atom-decomposition.md:46` C5 | high |
| N10 | Performance: không thêm reflow nặng; O(1)/O(n) theo convention; resize rAF hiện có reuse | P | AGENTS.md algorithm rule | medium |

## Scope

- **In:** PlayerModeOverlay layout branch <600px — bottom bar (adaptive prev/next ↔ rewind/forward), right rail, anchored pill/CC, ⋯ menu gom mọi action còn lại, cuelist visual (card/radius/typography match mockup) + 2 chế độ (full | active-only, setting trong Subtitle Manager), bỏ dock SubtitleBlock, orbital coexistence, i18n labels mới, a11y (aria/roles/focus), safe-area.
- **Out:** ≥600px PM layout; normal overlay mode; split-view `t` panel; ComprehensionPill/OrbitalBadge internal logic (chỉ reposition/anchor nếu cần); desktop dock.
- **Non-goals:** thay đổi hành vi PM enter/exit, fullscreen flow, iframe bridge; redesign CueList logic (chỉ visual); đổi contract `data-tihoka-id`.

## Workflow

Người học mở video trên phone (viewport <600px) → bấm `g` hoặc player-mode-btn → PM chiếm viewport: video top theo aspect, cuelist cuộn ở giữa (current cue auto-follow + sync pill khi desync như hiện tại), rail phải cho quick actions, pill điểm comprehension + nút CC neo trên bottom bar, bottom bar 6 vùng cho transport + exit + ⋯. Chạm cue → seek; chạm ⋯ → menu các action còn lại; Esc/X → thoát PM. Orbital badge tiếp tục nổi ở mép màn hình cho lookup.

## Journey

### AS-IS
1. User trên phone mở video có subtitle, nhấn `g` → PM vào: video top, panel dưới, dock đáy.
2. Dock <600px nhồi NavCluster (6 nút 2 cột) + subtitle block (clip ~1 dòng) + toolbar phải (8 nút 2 cột) → subtitle không đọc được, nút chen nhau.
3. ComprehensionPill nằm top-right đè video; CueRecommendFab đè góc cuelist; Orbital badge đè mép — tổng ≥3 surface nổi rời không coordination.
4. User muốn đọc cue trước/sau phải cuộn trong không gian hẹp giữa action bar và dock; vùng chạm nút nhỏ, dễ bấm nhầm.
5. User thoát PM vì UI quá tải — tính năng học trên mobile thực tế không dùng được.

### TO-BE
1. User nhấn `g` trên viewport <600px → PM mobile layout: video top (aspect preserved), cuelist chiếm toàn bộ phần giữa.
2. Cuelist render card-style: current cue highlighted, timestamp + actions từng cue; scroll mượt, sync pill khi desync — reading surface chính.
3. Rail phải giữ quick-add / edit-card / cue-filter / generate-native luôn reachable 1 chạm; comprehension pill + CC neo ngay trên bottom bar; orbital badge nổi như cũ.
4. Bottom bar: X exit | prev | repeat | play/pause lớn | next | ⋯ — đủ touch target, 1 tay thao tác; khi chưa load subtitle, prev/next tự đổi thành rewind/forward; ⋯ mở Menu chứa mọi action còn lại.
5. Cuelist tôn trọng display mode user chọn trong Subtitle Manager (full list | chỉ active cue).
6. User học uninterrupted: đọc → repeat cue → quick-add từ → tiếp tục; Esc/X thoát PM về trạng thái cũ không lỗi (AC-6.3 giữ).

## Stories

- S1: As a mobile learner, I want PM <600px to give the cue list the middle of the screen so that I can read along without controls crowding it — done when cue list fills between video and bottom bar and current cue stays visible.
- S2: As a mobile learner, I want transport + exit in one bottom row so that I can steer playback with my thumb — done when prev/repeat/play/next/exit/⋯ all ≥44px and reachable.
- S3: As a mobile learner, I want quick-add/edit-card/filter/generate on the right edge so that study actions stay one tap away — done when all four render in the rail and fire their existing handlers.
- S4: As a mobile learner, I want remaining PM actions inside the ⋯ menu so that nothing is lost — done when every action available in today's PM mobile dock is reachable in the new layout.
- S4b: As a mobile learner without loaded subtitles, I want prev/next to become rewind/forward so that transport vẫn có nghĩa — done when bottom bar swaps the pair khi `cues.length === 0`.
- S4c: As a mobile learner, I want to pick full-list vs active-cue-only từ Subtitle Manager so that cuelist phù hợp thói quen đọc — done when setting persist và PM mobile render đúng mode.
- S5: As a maintainer, I want all existing `data-tihoka-id` selectors preserved so that tests/e2e keep passing — done when C5 list unchanged.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Reposition ComprehensionPill/OrbitalBadge (mounts ngoài PM shadow) gây overlap hoặc z-fight | internal | medium | position qua host style + z-token hiện có; verify bằng screenshot gate |
| ⋯ menu trong shadow PM — Escape/outside-click phải đi qua `pushEscapeLayer`/`composedPath` | internal | medium | đã có Menu component + shadow-boundary rules trong AGENTS |
| Phá AC-6.3/6.4 (PM↔split-view lifecycle) khi đổi markup | internal | high | re-verify `subtitle-split-view-ac.md` bắt buộc theo rule |
| Landscape phone (<600px height nhưng >600px width) không được cover → vẫn desktop layout chật | hidden | low-medium | scope statement ghi rõ; quyết ở design nếu cần thêm media query |
| "Giống hoàn toàn mockup" vs token system conflict (mockup dùng gradient cam/tím không có trong DS) | human | medium | user rule: layout exact, màu theo DS + contrast plan → map accent → `--color-primary`/gradient token |
| Cuelist card redesign đụng `CueList.tsx` dùng chung với split-view → leak style | internal | medium | variant-scoped class/CSS module, không sửa shared default |

## Decision

go — pain rõ trên screenshot, scope chặt (<600px PM), reuse tối đa (component + handlers hiện có), contract selectors giữ nguyên → risk thấp, value cao cho mobile persona.

## Draft Acceptance Criteria

- [ ] <600px PM render: video top → cuelist middle → right rail (4 actions) → pill/CC row → bottom bar (X, prev, repeat, play, next, ⋯) đúng thứ tự mockup; không có subtitle → prev/next = rewind/forward; cuelist tôn trọng display-mode setting (full | active-only)
- [ ] ≥600px PM pixel-identical hiện tại; normal overlay/split-view không đổi
- [ ] Mọi PM action hiện có reachable (⋯ menu hoặc rail) — không mất handler
- [ ] `data-tihoka-id` C5 list intact; e2e selectors không đổi
- [ ] AC-6.3/6.4 re-verify pass; Esc/`t` behavior giữ
- [ ] Orbital badge hiển thị + interactive trong PM mobile
- [ ] Contrast AA trên surface/overlay backgrounds; touch targets ≥44px; safe-area insets
