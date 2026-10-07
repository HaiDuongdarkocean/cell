# Design Brief — word-translation

## Design Read

Một lớp chú thích thứ hai dưới chữ — gloss ngôn ngữ mẹ đẻ ngồi yên dưới từng từ, đối xứng với cap IPA đang ở trên: đọc phụ đề mà không cần dừng phim để mở popup.

## Context quote

Intent: *"đọc sub gặp từ lạ → giờ phải pause + mở popup từng từ → đứt mạch. Gloss 1-dòng ngay dưới chữ = lớp liếc nhanh, popup vẫn là lớp tra sâu."* — `docs/intent/word-translation.md`

## Primary job

**Liếc xuống biết nghĩa từ đang xem, mà không rời mắt khỏi dòng phụ đề.** Mọi function khác (toggle, invalidation, loading) phục vụ job này hoặc không làm phiền nó.

## Function audit

| Function | Class | Why |
|---|---|---|
| Gloss dưới mỗi word token (overlay block) | must-have | Job chính — REQ-2/REQ-3 |
| Chung trục dọc với IPA cap (IPA trên, chữ giữa, gloss dưới) | must-have | Anh chốt hiển thị đồng thời — spec |
| Batched `TRANSLATE_TERMS` + cache + dedupe | must-have | REQ-1 — không UI nhưng quyết loading state |
| Setting `showWordTranslations` cạnh "Show readings" | must-have | REQ-4 — toggle persist, live-update |
| Headroom dưới chữ (không đè dòng dưới khi wrap) | must-have | REQ-3 — bài học wrap-fix của IPA |
| Gloss không vào selection/clipboard | must-have | REQ-3 — copy sạch |
| Invalidation khi đổi native language | must-have | REQ-5 — gloss cũ sai ngôn ngữ là tệ hơn không có |
| Loading state (gloss chưa về) | must-have | REQ-1 non-fatal — từ chưa có gloss thì trống, không skeleton |
| Gloss trên cue list / card preview | remove (v1) | Anh chốt scope = overlay block only |
| Chọn format/ngôn ngữ gloss riêng | remove | Đích = `subtitleOverlayNativeLanguage`, đã có setting đó |
| Quick toggle trên overlay toolbar | nice-to-have | Đề xuất từ IPA analysis — defer, không chặn ship |

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Enable | Bật "Show word translations" trong Settings → Subtitle Block | Setting persist; tokens đang hiển thị re-style ngay | Settings dialog |
| 2 | Watch | Xem phim, cue mới hiện | Terms batch → TRANSLATE_TERMS → gloss hydrate dưới từng từ | Overlay block |
| 3 | Read | Mắt liếc xuống dưới từ lạ | Gloss 1 dòng, ellipsis nếu dài hơn chỗ trống | `data-gloss` ::after |
| 4 | Deep lookup (edge) | Click từ cần nghĩa đầy đủ | Popup dictionary mở như cũ — gloss không chặn | Token word span |
| 5 | Distract-free (edge) | Tắt gloss (hoặc chưa set native lang) | Layer dưới biến mất, headroom giải phóng | `gloss-off` class |
| 6 | Switch language (risk) | Đổi `subtitleOverlayNativeLanguage` | Cache clear, re-resolve; lỗi thì giữ gloss cũ | Preloader |
| 7 | Failure (edge) | Provider down/offline | Không gloss, không error UI — token/reading vẫn nguyên | — |

Moment of uncertainty: bước 6 — user đổi ngôn ngữ mẹ đẻ giữa chừng; gloss cũ phải không flicker (giữ gloss cũ nếu re-resolve fail).

## Inspiration anchor

- **Feeling:** đọc sách song ngữ — dòng nghĩa nhỏ nằm im dưới từ, như viên sỏi dưới đáy hồ: không nổi lên, nhưng đúng chỗ.
- **Non-digital reference:** interlinear Bible / sách học ngữ in gloss nhỏ dưới mỗi từ.
- **Visual reference:** Language Reactor / Migaku per-word gloss.

## Dials

Baseline: `DESIGN_VARIANCE: 3` (mirror IPA cap — vốn đã là grammar của hệ), `MOTION_INTENSITY: 1` (chú thích trên video đang chạy → không motion), `VISUAL_DENSITY: 6` (lớp chữ thứ ba trong cùng một cụm token).

| Concept | VAR | MOT | DEN | Push |
|---|---|---|---|---|
| A — Interlinear | 3 | 1 | 8 | DEN lên: mọi từ đều có gloss luôn |
| B — Gloss strip | 5 | 1 | 5 | IA đổi: từ-level → line-level track |
| C — Glimpse | 6 | 4 | 3 | DEN xuống thấp nhất + MOT lên: on-demand |

## Concepts

### Concept A — Interlinear

- **IA mental model:** "mỗi từ là một ô hai tầng — chữ trên, nghĩa dưới" (sách song ngữ)
- **Visual archetype:** solid editorial annotation
- **Non-digital reference:** interlinear Bible
- **Material / surface:** không surface — gloss là text thuần trên video, như IPA cap
- **Typography treatment:** gloss `0.62em` medium weight, `var(--color-overlay-text)` opacity 0.85, centered, nowrap + ellipsis
- **Motion signature:** không có — gloss xuất hiện cùng cue
- **UX flow:** journey 1→3 thẳng: bật → thấy → đọc
- **UI structure:** `data-gloss` trên `.js-cell-token-word`, `::after` top:100%, bottom headroom `margin-bottom` trên token
- **3 dials:** DESIGN_VARIANCE: 3, MOTION_INTENSITY: 1, VISUAL_DENSITY: 8
- **States:** loaded / loading (từ trống, không placeholder) / missing (không gloss → không ::after) / gloss-off (headroom released) / wrapped (headroom giữ khoảng cách dòng)
- **Why it fits:** đúng spec đã approve (`data-gloss` ::after, pseudo-element, copy-sạch miễn phí); mirror IPA → user học 1 grammar đọc 2 lớp
- **Risk:** gloss dài hơn từ → ellipsis ("khô…" cho "không" dưới "no"). Chấp nhận: gloss là hint, popup là full nghĩa. Bleed ±0.4em vào gap giữa từ đã giảm clipping.
- **Audit findings:** (none pending — subtitle block đã qua wrap/overflow fixes)

### Concept B — Gloss strip

- **IA mental model:** "dưới câu là một track dịch word-by-word chạy song song" (parallel channel)
- **Visual archetype:** ledger/track line
- **Non-digital reference:** dòng ghi chú liên tục dưới văn bản trong sách chú giải
- **Material / surface:** text thuần + hairline `border-top` `var(--color-overlay)` tách track khỏi cue
- **Typography treatment:** cùng size class gloss A nhưng một dòng flow tự do, `·` ngăn cách
- **Motion signature:** không có
- **UX flow:** journey 2→3 đổi: user đọc gloss như một câu rời, tự map về từ
- **UI structure:** `div.strip` dưới cue line; không per-word positioning → không cần pseudo-element
- **3 dials:** DESIGN_VARIANCE: 5, MOTION_INTENSITY: 1, VISUAL_DENSITY: 5
- **States:** loaded / loading (`…` đầu strip khi đang resolve) / missing (bỏ qua từ) / wrapped (strip tự wrap như text)
- **Why it fits:** không bao giờ truncate, không va chạm ngang, ít headroom hơn A
- **Risk:** mất mapping gloss↔từ (user đếm vị trí) — đúng việc feature cần làm thì đây là điểm yếu chí mạng; strip thêm 1 dòng dưới cue → block cao hơn A
- **Audit findings:** —

### Concept C — Glimpse

- **IA mental model:** "nghĩa ẩn dưới mỗi từ, chạm là ló lên" (progressive disclosure)
- **Visual archetype:** floating chip / mini-tooltip
- **Non-digital reference:** gạch chân chú thích trong sách, tra footnote khi cần
- **Material / surface:** `var(--color-surface-elevated)` chip + `var(--color-border-subtle)` + `var(--shadow-md)` — surface thật, nổi trên video
- **Typography treatment:** tick = chấm tròn 0.28em opacity 0.4; chip text `0.62em` medium
- **Motion signature:** fade + 2px rise `var(--duration-fast)`, tắt khi `prefers-reduced-motion`
- **UX flow:** journey 3 đổi thành action: user hover/tap từ lạ → chip ló. Scan cả câu cần N lần hover
- **UI structure:** `.cChip` absolute dưới từ, `z-overlay-secondary`; tick là `::after` trống
- **3 dials:** DESIGN_VARIANCE: 6, MOTION_INTENSITY: 4, VISUAL_DENSITY: 3
- **States:** hidden (tick) / revealed (chip) / missing (không tick) / touch (tap toggle)
- **Why it fits:** density thấp nhất — cue sạch như ship hiện tại; chip không truncate (max-width 40vw)
- **Risk:** không "liếc" được — phải tương tác; chip đè pixel video (transient); trên overlay block đang auto-hide/compact, tương tác thêm gãy xem phim. Lệch khỏi intent "gloss hiện sẵn"
- **Audit findings:** —

## Responsive

| Width | Behavior |
|---|---|
| 320 | Cue wrap nhiều dòng — headroom dưới giữ đúng khoảng cách; gloss ellipsis sớm hơn (box = từ + 0.8em) |
| 768 | Như 320, cue ít wrap hơn |
| 1280 | Cue thường 1 dòng — gloss lane ổn định |
| 1920 | Không đổi — overlay block đã giới hạn giữa nav clusters |

## States (chosen direction — TBD sau khi Anh pick)

| State | Rendering |
|---|---|
| gloss on, loaded | `data-gloss` → ::after text |
| gloss on, loading | không attr → không ::after (trống, không spinner) |
| gloss missing | như loading — trống |
| gloss off | `gloss-off` modifier trên token word → bỏ ::after + headroom |
| reading off + gloss on | gloss vẫn hiện — hai lớp độc lập |
| wrapped cue | headroom dưới giữ gloss không đè dòng dưới |

## Anti-patterns avoided

- Không Liquid Glass, không blur — gloss là text thuần trên video.
- Không component mới trong shared/ui — gloss là pseudo-element của token span hiện có.
- Không reflow-per-resolve: headroom dưới cố định ngay khi bật, gloss điền vào chỗ trống sẵn.
- Không đưa gloss vào DOM text → copy/selection sạch, không cần xử lý clipboard.

## Why the archetypes differ

A = annotation *gắn* vào từ (per-word, per-token DOM). B = annotation *rời* khỏi từ thành line-level track — đổi đơn vị đọc từ word→cue. C = annotation *theo yêu cầu* — đổi modality từ passive→interactive. Ba concept khác đơn vị dữ liệu (word / cue / word-on-demand), không phải ba skin của một layout.

## Mockup

`src/entrypoints/mockup-word-translation/` — Real panel mount đúng `findTextBlocks` + `tokenizeTextBlock` + `bindTokenBlock` (production render path, IPA-only shipped state). Screenshots: `tmp/word-translation/concept-{a,b,c}-light.png`, `concept-a-dark-desktop.png`.

## Chosen concept

**A — Interlinear** (user pick). Gloss sits centered under each word as a `::after` pseudo-element mirroring the IPA `::before` cap: bounded to token width + 0.4em bleed each side, `text-overflow: ellipsis` when longer. Headroom `margin-bottom: 1.35em` on the word token span while glosses are on; the `gloss-off` modifier releases it. Loading/missing states render as absence — no placeholder, no error UI.
