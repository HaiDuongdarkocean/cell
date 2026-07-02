# Intent: Subtitle Navigation Control Cluster (floating prev/repeat/next + seek + drag)

> **Giai đoạn**: G0 Discovery (output interview-me)
> **Status**: Confirmed — sẵn sàng vào G1 Spec
> **Date**: 2026-07-02
> **Related**: ADR-013 (subtitle-appearance-manager — 2 overlay layer + drag), ADR-015 (subtitle drag integrated — drag trực tiếp overlay background), `subtitleOverlay.ts` (sync logic + `findCurrentLine` binary search), `contentScriptController.ts` (orchestrator)

## Problem Statement

> **How Might We**: Làm thế nào để người dùng (mouse desktop + touch tablet/phone) tua ngược/tua tới theo câu subtitle, lặp lại câu hiện tại, tua 5s/10s — mà không phải dùng keyboard, không che subtitle overlay, và có thể di chuyển cluster đến vị trí thuận tiện nhất trong phạm vi video player?

## Background (ground truth từ codebase + research)

### Codebase hiện tại
- `SubtitleOverlayController` (`src/features/subtitle/ui/subtitleOverlay.ts:36`) quản lý 2 overlay layer (target + native), sync qua `video.timeupdate` → `findCurrentLine` (binary search, `subtitleSync.ts`).
- `findCurrentLine(cues, currentTimeMs)` trả index cue hiện tại → đã có logic định vị câu. **Reuse** cho prev/next sentence (index ± 1).
- ADR-015: drag trực tiếp overlay background qua Pointer Events + `setPointerCapture`. **Pattern drag đã verify** — reuse cho cluster drag handle.
- `subtitleDragPosition.ts` `calcYOffsetPercent` (pure) + persist debounced vào `chrome.storage`. **Pattern persist position đã có**.
- Chưa có bất kỳ control cluster nào (prev/repeat/next/seek) — feature mới, không thay thế component nào.

### Research hành vi người dùng (web search 2026-07-02)
- **Progressive disclosure**: ẩn controls khi idle, hiện khi tương tác (vidzflow, SitePoint). Cell áp dụng: cluster visible mặc định, collapse mode khi user muốn dọn màn.
- **Touch target ≥44px** (WCAG 2.5.5), thumb zone đáy (NN/g, 72technologies, Fitts' law). Cell: nút 44px desktop / 56px touch, size customizable trong settings.
- **Prev/next sentence** = mũi tên trái/phải; **repeat** = R hoặc mũi tên xuống (easysubs, Trancy, asbplayer). Industry standard cho language-learning player.
- **5s rewind / 10s forward** = pattern YouTube native (double-tap trái/phải edge). Cell tách nút riêng (không long-press trên prev/next) — rõ ràng hơn cho touch.
- **Mobile**: simpler, controls bottom thumb-reachable (mobbin, wendyzhou). Cell: 1 responsive component, breakpoint đổi size (không 2 layout riêng).

## Recommended Direction

**Floating control cluster — 2 cột: cột chính (⋯/◀/🔁/▶) + cột phụ nhô bên phải (⏪/⏩), drag handle ⋯ trên cùng, drag-to-move trong phạm vi video, persist position, collapse mode (half-circle edge-stuck), gesture-based (không click-count).**

### Layout (2-column: main focus + secondary seek)

```
                                ┌─────┐
                                │ ⋯  │  ← drag handle (nhấn giữ + kéo = move; double-click = reset default; kéo ra mép gần nhất = collapse)
                                ├─────┤
            prev sentence (cue) │ ◀   ┌─────┐
                                ├─────┤ ⏪  │  ← rewind 5s (secondary, ít dùng)
    repeat (hold ≥500ms         │ 🔁  ├─────┤
    = loop, release = stop)     ├─────┤ ⏩  │  ← forward 10s (secondary, ít dùng)
            next sentence (cue) │ ▶   └─────┘
                                └─────┘
```

**Rationale 2-cột**: 3 nút chính (prev/repeat/next) = focus chính, user dùng thường xuyên khi học. 2 nút seek (⏪5s/⏩10s) ít dùng nhưng không thể thiếu → nhô sang cột phụ bên phải, tách khỏi focus chính. Cột phụ offset xuống 1 row để không che ⋯ (drag handle) và ▶ (next) — giữ cột chính gọn 4 nút.

### Drag handle ⋯ semantics (gesture-based, confirmed interview)
- **Press + drag**: cluster follow pointer trong phạm vi video player bounds. Release = drop tại vị trí đó. Icon ⋯ là anchor (xuất phát từ vị trí vừa dừng → vị trí mới).
- **Double-click**: reset về default position (x=0% left edge, y=75% height — thumb zone đáy trái).
- **Drag ra mép gần nhất** (kéo ⋯ đến vùng mép video <threshold): cluster collapse thành 1 icon half-circle (bán nguyệt) dính sát mép gần nhất (trái hoặc phải). Tap half-circle = expand lại cluster tại vị trí trước collapse.
- **Off**: qua settings toggle (không click-count) + confirm dialog giữa overlay ("Đóng control cluster? Yes/No").

### Prev/Next sentence semantics
- **Prev (◀)**: nhảy đến cue trước (index - 1). Fallback 5s rewind khi gap giữa 2 cue > 5s (giống easysubs — tránh nhảy long-hop gây disorientation).
- **Next (▶)**: nhảy đến cue sau (index + 1). Fallback 10s forward khi gap > 5s.
- Reuse `findCurrentLine` để định vị index hiện tại → ± 1 → seek `video.currentTime = cues[index].startMs / 1000`.

### Repeat semantics (hold to loop, confirmed interview)
- **Hold ≥500ms**: loop câu hiện tại (seek về cue start, khi đến cue end → seek lại start). Visual: icon đổi màu/badge khi looping.
- **Release**: stop loop, tiếp tục playback bình thường.
- Touch: hold = press giữ nút. Mouse: press giữ nút. Cùng 1 Pointer Events handler.

### Seek 5s/10s semantics
- **⏪ rewind 5s**: `video.currentTime -= 5`.
- **⏩ forward 10s**: `video.currentTime += 10`.
- Độc lập với sentence navigation (nút riêng, không long-press).

### Position persistence (confirmed interview)
- Persist last position vào `chrome.storage` (giống `subtitleOverlayTargetStyle.yOffsetPercent` ADR-013). Restore lần sau khi video load.
- Default position (khi chưa persist hoặc double-click reset): x=0% left edge, y=75% height.

### Responsive + customizable size (confirmed interview)
- 1 component responsive — desktop 44px/nút, touch 56px/nút + spacing rộng. Breakpoint đổi size (không 2 layout riêng).
- Size customizable trong settings (slider hoặc preset small/medium/large) — persist vào `chrome.storage`.

### Visual styling (confirmed interview)
- **Background opacity control**: setting riêng (slider 0-100%).
- **Button opacity**: setting riêng (slider 0-100%), độc lập background.
- **Color**: follow dark/light mode (detect `prefers-color-scheme` hoặc theo theme video player).

### Keyboard shortcuts (parallel, confirmed interview)
- ◀ = prev sentence, ▶ = next sentence.
- R (hold) hoặc Space (hold) = repeat loop.
- ⏪ = Ctrl+← hoặc J, ⏩ = Ctrl+→ hoặc L (TBD ở G1).
- Double-tap ⋯ = reset (không có kbd shortcut — gesture only).

## Scope v1 (confirmed)

**In:**
- Floating cluster 2 cột (main ⋯/◀/🔁/▶ + secondary ⏪/⏩ nhô bên phải) inject vào video player container (cùng container với subtitle overlay ADR-013).
- Drag handle ⋯: press+drag move, double-click reset, drag-to-edge collapse.
- Collapse mode: half-circle icon edge-stuck (trái/phải), tap expand.
- Prev/Next sentence: reuse `findCurrentLine`, fallback 5s/10s khi gap >5s.
- Repeat: hold ≥500ms loop, release stop.
- Seek 5s/10s: nút riêng.
- Position persist vào `chrome.storage`, restore on load.
- Responsive 1 component (44px desktop / 56px touch), size customizable trong settings.
- Background opacity + button opacity settings riêng.
- Dark/light mode color.
- Keyboard shortcuts parallel (◀▶ R hold + seek TBD).
- Off toggle trong settings + confirm dialog.

**Out of scope (v1):**
- CC1/CC2 toggle (subtitle target/native toggle) — chưa phát triển (anh yêu explicit).
- 2 layout riêng desktop/mobile (dùng 1 responsive component).
- Click-count semantics (2/3/4 lần) — rejected, dùng gesture-based + settings toggle.
- Long-press trên prev/next cho time seek — rejected, tách nút 5s/10s riêng.
- Auto-hide theo idle timer — rejected, dùng collapse mode thay thế (user chủ động).

## Feasibility go/no-go (nhẹ)

- **Build-vs-buy**: N/A — Pointer Events native + reuse `findCurrentLine` + reuse drag pattern ADR-015. Không cần third-party drag lib.
- **Risk thô**:
  - **Reuse `findCurrentLine` cho prev/next**: function đã verify (binary search, half-open interval ADR-knowledge). **Low risk** — chỉ thêm index ± 1 logic.
  - **Drag cluster trong phạm vi video bounds**: cần clamp position trong `videoWrapper.getBoundingClientRect()`. Pattern mới (ADR-015 drag chỉ Y-axis, cluster drag X+Y). **Medium risk** — math 2-axis + edge clamp + persist.
  - **Collapse mode (half-circle edge-stuck)**: UI state mới (expanded ↔ collapsed), persist state. **Medium risk** — thêm state machine + visual transition.
  - **Touch + mouse cùng Pointer Events**: Pointer Events đã cover cả 2 (ADR-015 verify). **Low risk**.
  - **Conflict drag ⋯ vs subtitle overlay drag (ADR-015)**: cluster là element riêng, không overlap subtitle overlay drag area. **Low risk** — separate element, separate handler.
  - **Settings UI mới (size, opacity bg/btn, off toggle)**: thêm vào `SettingsDialog` + `settingsStore`. **Low risk** — pattern đã có (subtitle style settings).
  - **Keyboard shortcuts conflict với web player native** (lordflix/kisskh): cần check host page không capture ◀▶ R. **Medium risk** — có thể cần `stopPropagation` hoặc chọn key khác.
- **Recommendation**: **GO** — reuse lớn (findCurrentLine, drag pattern, settings pattern), risk chủ yếu ở drag 2-axis + collapse state machine (manageable). Lợi ích UX rõ (touch + mouse navigation cho language-learning).

## Open questions (resolve ở G1 Spec)

- **Keyboard shortcuts key binding**: ◀▶ R hold rõ, nhưng seek 5s/10s dùng Ctrl+←/→ hay J/L? Conflict với host page hotkeys (lordflix/kisskh có hotkeys riêng không)? Cần audit ở G1.
- **Collapse threshold**: kéo ⋯ đến khoảng cách bao nhiêu px từ mép video = trigger collapse? (suggest 20px hoặc 5% width).
- **Half-circle icon visual**: bán nguyệt lồi hướng vào trong video (trái = lồi phải, phải = lồi trái)? Size bao nhiêu? (suggest 32px diameter, tap target 44px).
- **Repeat loop boundary**: loop theo cue start/end (ms) hay theo thời điểm press (current time → +cue duration)? Cue start/end chính xác hơn nhưng cần cue đã load. Nếu chưa load subtitle → repeat disabled?
- **Prev/Next khi chưa load subtitle**: disable nút hay fallback 5s/10s? (suggest disable + visual dim).
- **Settings schema**: thêm fields nào vào `settingsStore`? (navClusterPosition {x,y}, navClusterSize, navClusterBgOpacity, navClusterBtnOpacity, navClusterEnabled, navClusterCollapsed). Cần define ở G1.
- **Z-index vs subtitle overlay**: cluster z-index bao nhiêu để không che subtitle overlay (target 999999, native 999998)? (suggest 1000000 — trên cùng, nhưng pointer-events chỉ trên cluster element).
- **Fullscreen behavior**: cluster có follow vào fullscreen container không? (ADR-013 subtitle overlay đã handle fullscreen — reuse pattern).
- **Multiple video elements**: 1 page có nhiều `<video>` (rare) — cluster bind vào video nào? (suggest active video — cùng logic `contentScriptController`).
- **Cột phụ hướng**: khi cluster ở mép trái → cột phụ ⏪⏩ nhô bên phải (default). Khi cluster ở mép phải → cột phụ nhô bên trái (mirror) để không bị cắt khỏi video bounds? Hay luôn bên phải + clamp? Cần decide ở G1.
