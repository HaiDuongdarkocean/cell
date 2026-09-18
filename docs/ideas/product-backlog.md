# Product Backlog — Tihoka

> Living queue các nhóm tính năng "Quản lý X". **Row trên cùng = next pick** — order theo cost tăng dần, value làm tiebreak. Nguồn: audit tính năng 2026-09 (asbplayer + Migaku).
> Consumed by: `.agents/skills/idea-grab/` (thêm items) + `.agents/skills/idea-pick-off/` (lấy item → pipeline).

## Item schema (contract cho pipeline)

| Field | Rule |
|---|---|
| `#` | Vị trí trong queue — số thứ tự, reorder giữa các wave only |
| `Slug` | kebab-case, stable — dùng đặt tên `docs/intent/<slug>.md`, `docs/specs/<slug>.md`; KHÔNG đổi sau khi specced |
| `Nhóm` | Tên hiển thị "Quản lý X" |
| `Pain` | 1 câu pain/outcome — seed cho elicitation 8-field frame |
| `Cost` | `S` <1d · `M` 1–3d · `L` >3d · `XL` multi-week |
| `Value` | ★1–5 |
| `Infra` | Hạ tầng có sẵn nó leverage (không phải dep) |
| `Deps` | Item IDs phải `shipped` trước — `-` = không có |
| `Source` | asbplayer / migaku / internal-audit / user |
| `Status` | `icebox` → `analyzed` → `specced` → `designed` → `in-progress` → `shipped` (+`dropped` kèm lý do) — mirror của `tasks/pipeline-state.json` stage; state file thắng khi lệch |
| `UI` | `yes`/`no`/`?` — item có đụng UI surface không; ANALYZE điền (`pipeline-state set uiSurface=`) |
| `Spec` | Link `docs/specs/<slug>.md` khi có |

## Cơ chế pick-off (chi tiết: `.agents/skills/idea-pick-off/`)

1. **Pick**: item trên cùng có `status=icebox` và mọi `Deps` đã `shipped`. Top item bị block → xuống item kế. `pipeline-state.mjs init <slug>` claim.
2. **Analyze**: `pipeline-analyze` → `docs/intent/<slug>.md` + `## Decision`. `go` → `analyzed`; `no-go` → `dropped` + lý do (kill sớm, không mất nguồn lực).
3. **Specify**: `pipeline-specify` → `docs/specs/<slug>.md` → spec-reviewer gate → fix ≤3 rounds → `specced`; `UI` column điền.
4. **Design** (chỉ `UI=yes`): `pipeline-design` → concepts + mockup + brief + mapping → approval/vision verdict → `designed`.
5. **Deliver**: `pipeline-deliver` → plan → build (engine `autonomous-pipeline` cho M+) → gates `typecheck + lint + test:unit + build` + browser khi UI → verify → `in-progress` → `shipped` + commit hash → `docs/0-wiki.md` changelog.
6. **Veto**: Anh yêu drop bất cứ lúc nào → `dropped` + 1 dòng lý do.

## Backlog (rẻ → đắt)

| # | Slug | Nhóm | Pain | Cost | Value | Infra | Deps | Source | Status | UI | Spec |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `immersion-playback` | Quản lý Immersion Playback | Xem passive không chủ động — sub trôi qua kể cả từ chưa biết | M | ★★★★★ | wordStatus×cuesStore, NavCluster | — | asbplayer+migaku | shipped | yes | [spec](../specs/immersion-playback.md) · [plan](../../tasks/plan-immersion-playback.md) |
| 2 | `comprehension-score` | Quản lý Độ hiểu | Không biết media này "vừa sức" hay quá khó trước khi xem | M | ★★★★★ | tokenize×wordStatus, frequencyClient | — | asbplayer+migaku | shipped | yes | [spec](../specs/comprehension-score.md) · [plan](../../tasks/plan-comprehension-score.md) |
| 3 | `vocabulary-browser` | Quản lý Từ vựng | wordStatus có data nhưng không xem/quản lý được — từ "biến mất" sau lookup | M | ★★★★★ | wordStatusStore, statusKeyControls | — | asbplayer | shipped | yes | [spec](../specs/vocabulary-browser.md) · [plan](../../tasks/plan-vocabulary-browser.md) · f2687403 + 6be1fd87 |
| 4 | `cue-recommend-fab` | Quản lý Cue đề xuất | Xem phim không biết cue nào đáng dừng — cần FAB góc phải dưới subtitle panel lọc cue i+1 (1–2 từ lạ) ngay lúc xem | S | ★★★★ | unknownCueMap, CueList | — | user | shipped | yes | [spec](../specs/cue-recommend-fab.md) · [plan](../../tasks/plan-cue-recommend-fab.md) · `763c8a75` |
| 5 | `cue-difficulty-map` | Quản lý Bản đồ độ khó | Cue nào dễ/khó không thấy — seek mò; heat per-cue để nhảy tới đoạn i+1 | S | ★★★ | comprehensionScore per-cue, CueList | — | lingq+internal-audit | shipped | yes | [spec](../specs/cue-difficulty-map.md) · [plan](../../tasks/plan-cue-difficulty-map.md) · `40825616` |
| 6 | `i1-content-queue` | Quản lý Hàng đợi i+1 | Có score nhưng phải tự mò video vừa sức — cần "xem gì tiếp" sort theo coverage gần band 95–98% | M | ★★★★★ | comprehensionScore, mediaScoreSource, mediaLibraryRepository | — | migaku+lingq | shipped | yes | [spec](../specs/i1-content-queue.md) · [plan](../../tasks/plan-i1-content-queue.md) · `a87e8bc1` |
| 7 | `immersion-clock` | Quản lý Đồng hồ Input | Không biết đã nạp bao nhiêu giờ input — không có roadmap level→fluency | M | ★★★★ | playback session, comprehensionStore | — | dreaming-spanish | shipped `a8c99cbf` | yes | [spec](../specs/immersion-clock.md) · [plan](../../tasks/plan-immersion-clock.md) · [intent](../intent/immersion-clock.md) |
| 8 | `pre-watch-primer` | Quản lý Khởi động trước khi xem | Vào video mới dồn từ lạ → bỏ cuộc; preview top từ high-freq unknown trước khi xem | M | ★★★★ | cuesStore tokenize, frequencyClient, wordStatus | — | migaku+internal-audit | icebox | yes | — |
| 9 | `adaptive-subtitles` | Quản lý Phụ đề thích ứng | Sub luôn hiện = đọc thay vì nghe; coverage cao → tự ẩn sub, thấp → hiện translation | M | ★★★★ | comprehensionScore stream, SubtitleBlock, studyModes | — | migaku | icebox | yes | — |
| 10 | `dense-cue-replay` | Quản lý Vòng lặp i+1 | Cue có đúng 1–2 từ lạ = vàng nhưng trôi qua; auto-loop cue đó, skip cue 0 lạ hoặc quá nhiều lạ | M | ★★★★ | unknownCueMap, studyModePlaybackController | — | asbplayer+internal-audit | icebox | yes | — |
