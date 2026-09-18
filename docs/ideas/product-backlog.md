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
| 8 | `pre-watch-primer` | Quản lý Khởi động trước khi xem | Vào video mới dồn từ lạ → bỏ cuộc; preview top từ high-freq unknown trước khi xem | M | ★★★★ | cuesStore tokenize, frequencyClient, wordStatus | — | migaku+internal-audit | shipped `58bf8ea7` | yes | [spec](../specs/pre-watch-primer.md) · [intent](../intent/pre-watch-primer.md) · [plan](../../tasks/plan-pre-watch-primer.md) |
| 9 | `adaptive-subtitles` | Quản lý Phụ đề thích ứng | Sub luôn hiện = đọc thay vì nghe; coverage cao → tự ẩn sub, thấp → hiện translation | M | ★★★★ | comprehensionScore stream, SubtitleBlock, studyModes | — | migaku | shipped `f7be4788` | yes | [spec](../specs/adaptive-subtitles.md) · [intent](../intent/adaptive-subtitles.md) · [plan](../../tasks/plan-adaptive-subtitles.md) |
| 10 | `dense-cue-replay` | Quản lý Vòng lặp i+1 | Cue có đúng 1–2 từ lạ = vàng nhưng trôi qua; auto-loop cue đó, skip cue 0 lạ hoặc quá nhiều lạ | M | ★★★★ | unknownCueMap, studyModePlaybackController | — | asbplayer+internal-audit | shipped `e58102cd` | yes | [spec](../specs/dense-cue-replay.md) · [intent](../intent/dense-cue-replay.md) · [plan](../../tasks/plan-dense-cue-replay.md) |
| 11 | `debug-seam-hardening` | Quản lý Cổng debug | Extension postMessage subtitle URL ra `window.parent '*'` + ~20 dataset.ocr* ungated — host page đọc được user xem gì, fingerprint extension | S | ★★★★ | `__CELL_DEBUG__` define, STORAGE_KEYS, contentScriptMessages | — | internal-audit | shipped `84e31c9e` | no | [spec](../specs/debug-seam-hardening.md) · [intent](../intent/debug-seam-hardening.md) · [plan](../../tasks/plan-debug-seam-hardening.md) |
| 12 | `local-player-hygiene` | Quản lý Local Player | Cache Map không giới hạn (pendingSubsRef, videoFileCacheRef, subtitleResponseCache) + 26 console.* — session dài leak memory, log nhiễu | S | ★★ | local-player refs, subtitleResponseCache | — | internal-audit | dropped — ** — the backlog row's stated pain is already satisfied in code: every named cac | no | — |
| 13 | `message-validation-thread` | Quản lý Message validation | `safeParse` chạy nhưng handler nhận raw request vẫn cast tay `payload.tracks as X` — lỗi schema lọt vào handler | S | ★★ | messageBus, zod MESSAGE_REGISTRY | — | internal-audit | shipped `0c343f71` | no | [spec](../specs/message-validation-thread.md) · [intent](../intent/message-validation-thread.md) · [plan](../../tasks/plan-message-validation-thread.md) |
| 14 | `download-queue-integrity` | Quản lý Hàng đợi tải | `pause()` không pause — item vẫn hoàn thành + ngốn băng thông sau cancel; concurrency cap vượt; restore sau restart bị stall + re-enqueue duplicate | M | ★★★★★ | downloadQueue, OPFS, chrome.storage.session | — | internal-audit | dropped — pain already fixed by `308ecb9c` (abort-aware queue, session-persisted dedup, restore→processNext, nav/removal lifecycle split); see [intent](../intent/download-queue-integrity.md) | no | — |
| 15 | `subtitle-bulk-status` | Quản lý Status hàng loạt | Bulk đổi status chỉ có trên web page text — subtitle block + subtitle panel thiếu parity (local player không có status keys; CueList thiếu ctrl+click + selected state) | M | ★★★★ | statusKeyControls, extractTermsFromSelection, cueListTokens | — | user | icebox | yes | — |
| 16 | `tokenize-controller-dedup` | Quản lý Tokenize Controller | Status-key logic near-verbatim ở 2 controller (web 896 vs subtitle 309 lines) — fix 1 bug phải sửa 2 chỗ, đang diverge | M | ★★★ | statusKeyControls, webTokenizeController, subtitleTokenizeController | — | internal-audit | dropped — ** — the dedup the row asks for already landed (`statusKeyControls.ts` shared fa | no | — |
| 17 | `dead-code-purge` | Quản lý Code chết | `USE_LEGACY_*` hardcoded false + 2 impl legacy + ~18 test + dead exports (`fetchAllSegments`, AudioPanel×2, `@/types` 35 sites) — đọc code phải phân biệt đường sống/chết | M | ★★★ | USE_LEGACY_* flags, downloader, types shims | — | internal-audit | icebox | no | — |
| 18 | `ui-layer-ssot` | Quản lý Ranh giới UI | CueList ở entrypoints nhưng 5 file features import ngược qua deep-import — shared UI không có ranh giới SSOT; barrels `export *`, ~845 deep imports, no `import/no-cycle` | L | ★★★★ | shared/ui, feature barrels, eslint no-restricted-imports | — | internal-audit | icebox | no | — |
| 19 | `god-file-decomposition` | Quản lý God file | Controller/state còn 1.4–1.8k lines (webTextDictionaryController 1816, useCardCreatorState 1425, content-script 1409, downloader 1221) — mọi change đụng 10+ internals, regression surface lớn | XL | ★★★★ | decomposition precedent (SubtitlePanels split), per-concern modules | — | internal-audit | icebox | no | — |
