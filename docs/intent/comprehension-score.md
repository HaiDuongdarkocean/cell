# Intent — Comprehension Score (Quản lý Độ hiểu)

> Backlog `#2` · seed: "Không biết media này 'vừa sức' hay quá khó trước khi xem" · Source: asbplayer+migaku · Elicitation 2026-09-17.

## Observation round — workflow hiện tại

- Anh đo độ khó bằng **xem thử vài phút** rồi tự cảm nhận → mất thời gian, quyết định cảm tính, không có signal khách quan.

## Feedback round 1 (interview)

- Score phải hoạt động trên **mọi tokenized text**, không chỉ video — liên quan cả reader + local player.
- Vị trí hiển thị phải **nghiên cứu kỹ** — "xuất hiện ở đâu đó trên màn hình mà có thể xem được và không gây vấn đề về cảm giác nhìn".
- Trigger: **auto khi có tokenMap** — không cần nút bấm.

## Feedback round 2 (interview + directive)

- Anh yêu cầu research khoa học cho formula + thang đo — theo **Krashen comprehensible input (i+1)**, immersion principle → `/inquiry-creativity`.
- Interaction: **display only** — không click-through.
- Scope: **tất cả trang tổng kết**, phân loại chỉ 2 loại content — **media** và **text**. Page có cả hai (YouTube) → **toggle pill 2 icon**, media = default display, text = secondary. Quan trọng nhất: user journey nhìn thấy score ở đâu.
- Badge **hiển thị thông tin hệ thống đã fetch sẵn** — không đào thêm data.
- Cross-model review: **skip** (single-model đủ).

## Research synthesis (inquiry-creativity)

| Source | Authority | Finding |
|---|---|---|
| Hu & Nation (2000) | high | 80% coverage → không ai đạt adequate; 90% → thiểu số; 95% → vẫn thiểu số; regression → **98%** cho đa số đọc adequate |
| Nation (2006) | high | 98% coverage = unassisted comprehension; 8–9k word families written, 6–7k spoken |
| Laufer & Ravenhorst-Kalovski (2010) | high | Hai ngưỡng reading: **optimal 98%** (8k families), **minimal 95%** (4–5k) |
| van Zeeland & Schmitt (2013) | high | **Listening**: 90% → đa số adequate (variance cao); 95% → good, ít variance |
| Schmitt, Jiang & Grabe (2011, n=661) | high | Quan hệ **linear** trên 90% — không có cliff; 98% target hợp lý cho academic text |
| Krashen (1985, 2020) | theory | i+1: input hiểu được phần lớn + chút vượt level; "optimal input" = comprehensible + compelling |
| Migaku | product precedent | Comprehension score = difficulty vs known words; 5 statuses unknown/learning/known/tracking/ignored; toolbar trên text sites hiển thị độ khó page |

**Mapping → Tihoka statuses** (`'unknown' | 'known' | 'tracking' | 'ignore'`):
`known`/`ignore` = biết (1.0) · `tracking` = đang học, biết một phần (0.5 — theo Schmitt 2011 linear, partial knowledge giúp comprehension) · `unknown` = 0.

**Formula**: `score = (known + ignore + 0.5·tracking) / totalNonSeparatorTokens × 100` — running-token coverage, đúng định nghĩa research.

**Bands** (media = listening ngưỡng thấp hơn text = reading):

| Band | media | text | Nghĩa |
|---|---|---|---|
| Thoải mái | ≥95% | ≥98% | Hiểu trôi chảy, ít từ mới |
| Vừa sức (i+1) | 90–<95% | 95–<98% | Sweet spot học — từ lạ đủ suy luận từ context |
| Quá khó | <90% | <95% | Comprehension gãy, quá nhiều từ lạ |

## Confirmed 8-field frame

1. **Problem**: Không biết media/text này "vừa sức" hay quá khó trước khi consume — hiện phải xem thử vài phút rồi đoán.
2. **User**: Language learner (persona 5–80, core 10–25) dùng Tihoka immersion trên streaming + reader + local player.
3. **Current workflow**: Xem thử → cảm giác quá khó/dễ → đổi content.
4. **Pain point**: Mất vài phút mới nhận ra sai level; không có metric khách quan; từ đã mark không quay lại phục vụ quyết định chọn content.
5. **Evidence**: Backlog audit (asbplayer/Migaku đều có difficulty/comprehension score); research coverage thresholds có sẵn data `wordStatus` × `frequency` trong pipeline tokenize.
6. **Desired outcome**: Một chỉ số glanceable trên màn hình — coverage % + band (Thoải mái/Vừa sức/Quá khó) — cho mọi tokenized content; media/text toggle pill khi cả hai cùng tồn tại (media default).
7. **Constraint**: Reuse pipeline sẵn có (tokenize × wordStatus × frequencyClient); O(n) max; <3s first score; RAM ≥1GB; display-only v1; không manifest change; không visual noise (edge-snapped, muted); MV3 message boundary.
8. **Scope**:
   - MVP: shared pure compute + score pill/badge; surfaces = SubtitlePanel header (streaming split view + local player + player mode qua shared component), reader header, web-page persistent pill cạnh OrbitalBadge khi tokenize on.
   - Toggle pill media/text khi page có cả hai; media default.
   - Out-of-scope: click-through word list (#3 vocabulary-browser territory), library card badge, per-site threshold config, historical score tracking.

## Doubt-driven check

- Fresh-context adversarial review đã chạy trên design proposal (artifact+contract, single-model — cross-model skipped theo Anh).
- Findings reconcile vào spec `docs/specs/comprehension-score.md` §Open Questions / accepted risks.
