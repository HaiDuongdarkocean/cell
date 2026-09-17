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
| `Status` | `icebox` → `specced` → `planned` → `in-progress` → `shipped` (+`dropped` kèm lý do) |
| `Spec` | Link `docs/specs/<slug>.md` khi có |

## Cơ chế pick-off (chi tiết: `.agents/skills/idea-pick-off/`)

1. **Pick**: item trên cùng có `status=icebox` và mọi `Deps` đã `shipped`. Top item bị block → xuống item kế.
2. **Spec**: `/elicitation` → intent + spec → spec-review-stakeholder → fix ≤3 rounds → `specced`.
3. **Plan**: `/planning-and-task-breakdown` → `tasks/` → `planned`.
4. **Build**: gates bắt buộc `typecheck + lint + test:unit + build` + real-Chrome smoke nếu đụng runtime; đổi `src/` → update `docs/2-architechture-system.md` → `in-progress`.
5. **Ship**: commit → `shipped` + spec/commit link → `docs/0-wiki.md` changelog line.
6. **Veto**: Anh yêu drop bất cứ lúc nào → `dropped` + 1 dòng lý do.

## Backlog (rẻ → đắt)

| # | Slug | Nhóm | Pain | Cost | Value | Infra | Deps | Source | Status | Spec |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `immersion-playback` | Quản lý Immersion Playback | Xem passive không chủ động — sub trôi qua kể cả từ chưa biết | M | ★★★★★ | wordStatus×cuesStore, NavCluster | — | asbplayer+migaku | icebox | — |
| 2 | `comprehension-score` | Quản lý Độ hiểu | Không biết media này "vừa sức" hay quá khó trước khi xem | M | ★★★★★ | tokenize×wordStatus, frequencyClient | — | asbplayer+migaku | icebox | — |
| 3 | `vocabulary-browser` | Quản lý Từ vựng | wordStatus có data nhưng không xem/quản lý được — từ "biến mất" sau lookup | M | ★★★★★ | wordStatusStore, statusKeyControls | — | asbplayer | icebox | — |
| 4 | `download-queue-ui` | Quản lý Download Queue | Queue chạy ngầm — không thấy job nào đang/stuck/fail | M | ★★★★ | downloadQueue (đã fix abort/pause) | — | internal-audit | icebox | — |
| 5 | `shortcuts-manager` | Quản lý Phím tắt | Hotkey hardcode — conflict với host site không sửa được | M | ★★★★ | subtitleShortcuts, dispatchers | — | asbplayer | icebox | — |
| 6 | `whitelist-manager` | Quản lý Whitelist | Tắt extension trên 1 site phải đào settings | S | ★★★ | whitelist feature | — | internal-audit | icebox | — |
| 7 | `mining-history` | Quản lý Thẻ đã tạo | Card đã mine không tra lại được nguồn/lúc nào | M | ★★★★ | lookupLog ring-buffer pattern | — | asbplayer | icebox | — |
| 8 | `focus-modes` | Quản lý Focus | Sub hiện sẵn làm đọc trước khi nghe — không luyện listening | S | ★★★ | SubtitleBlock CSS | — | asbplayer | icebox | — |
| 9 | `srs-review-manager` | Quản lý SRS/Review | Due count/streak không visible — quên review | S | ★★★ | quotaManager, getSrsStats | — | internal-audit | icebox | — |
| 10 | `subtitle-library` | Quản lý Phụ đề | Sub đã attach + offset settings không nhớ lại cho series | M | ★★★★ | autoMatch, offsetController | — | internal-audit | icebox | — |
| 11 | `session-manager` | Quản lý Session | Reload = mất context đang xem | M | ★★★ | bounded caches, storage.session | — | internal-audit | icebox | — |
| 12 | `ocr-region-manager` | Quản lý OCR regions | Mỗi lần vào site phải kéo region lại | M | ★★★ | regionSelector | — | internal-audit | icebox | — |
| 13 | `media-library` | Quản lý Media Library | Library là flat list — series/progress không có | M | ★★★ | mediaLibraryRepository | — | internal-audit | icebox | — |
| 14 | `learning-recommendations` | Quản lý Đề xuất học | Không biết nên học từ nào tiếp — tự quyết cảm tính | M | ★★★★ | frequencyClient×wordStatus | — | migaku | icebox | — |
| 15 | `immersion-analytics` | Quản lý Ngữ cảnh học | Không đo được immersion time — không biết mình tiến bộ | M | ★★★ | — | — | migaku | icebox | — |
| 16 | `lookup-popup-config` | Quản lý Lookup & Popup | Popup behavior global — site A cần nhanh, site B cần hover delay | M | ★★★ | popupGeometry, popupLifecycle | — | internal-audit | icebox | — |
| 17 | `episode-series-tracker` | Quản lý Episode & Series | Không biết đã xem tới đâu trong series | M | ★★★ | — | #13 | migaku | icebox | — |
| 18 | `subtitle-discovery-config` | Quản lý Subtitle Discovery | Provider order/fallback hardcode — không override được | M | ★★★ | pickProviderOrder | — | internal-audit | icebox | — |
| 19 | `api-key-quota` | Quản lý API Keys & Quota | Key nào rate-limited/dead không thấy — fail mới biết | S | ★★ | ApiKeyManager, lastDownloadAt | — | internal-audit | icebox | — |
| 20 | `listening-audio` | Quản lý Listening | Audio snippet capture xong không re-record/tune được | M | ★★★ | pronunciation services | — | asbplayer | icebox | — |
| 21 | `mining-workflow` | Quản lý Mining Workflow | Mỗi card phải map field tay — không có preset per note-type | M | ★★★★ | cardCreator, fieldMappingService | — | asbplayer | icebox | — |
| 22 | `popup-dictionary-config` | Quản lý Popup Dictionary UI | Default tab/nested-stack behavior không configure được | S | ★★ | popup lifecycle | — | internal-audit | icebox | — |
| 23 | `appearance-manager` | Quản lý Appearance | Subtitle style global — site tối/sáng cần style khác | M | ★★★ | theme system, appearance panel | — | asbplayer | icebox | — |
| 24 | `diagnostics-panel` | Quản lý Diagnostics | Detection miss silent — không biết tại sao không detect | S | ★★ | gated diag infra (fetchInterceptor) | — | internal-audit | icebox | — |
| 25 | `reading-annotation` | Quản lý Reading Annotation | Không có reading/pitch trên từ — phải mở popup mới biết | L | ★★★★ | tokenSpan render | — | asbplayer+migaku | icebox | — |
| 26 | `goals-streaks` | Quản lý Goals & Streaks | Không có target hàng ngày — dễ bỏ dở | M | ★★★ | — | #15 | migaku | icebox | — |
| 27 | `playback-behavior` | Quản lý Playback Behavior | Sau khi mine xong video cứ chạy — muốn pause/replay tùy chọn | S | ★★★ | NavCluster, cardCreatorBridge | — | asbplayer | icebox | — |
| 28 | `settings-profiles` | Quản lý Settings Profiles | Một config cho mọi context — Netflix focus vs casual share chung settings | L | ★★★ | settingsStore | — | asbplayer | icebox | — |
| 29 | `data-manager` | Quản lý Dữ liệu | Không biết feature nào chiếm bao nhiêu storage, không export all được | M | ★★★ | — | — | internal-audit | icebox | — |
| 30 | `cache-performance` | Quản lý Cache & Performance | OPFS/LRU usage invisible — đầy mới phát hiện | M | ★★ | bounded caches | — | internal-audit | icebox | — |
| 31 | `privacy-manager` | Quản lý Privacy | Không có chỗ xem extension lưu gì ở đâu | M | ★★★ | — | — | internal-audit | icebox | — |
| 32 | `study-modes-manager` | Quản lý Study Modes | Custom modes build được nhưng không share/preset gallery | M | ★★★ | CustomModeBuilder | — | internal-audit | icebox | — |
| 33 | `performance-profile` | Quản lý Performance Profile | Máy yếu vẫn chạy full OCR/tokenize — lag | L | ★★★ | — | — | internal-audit | icebox | — |
| 34 | `sync-backup` | Quản lý Sync & Backup | Đổi máy = mất wordStatus/settings/queue | L | ★★★ | — | — | migaku | icebox | — |
| 35 | `ai-generation` | Quản lý AI Generation | Dictionary tĩnh — không giải thích theo ngữ cảnh | L | ★★★★ | dictionaryGenerate, ApiKeyManager | — | migaku | icebox | — |

## Wave gợi ý (deps + leverage đã xét)

| Wave | Items | Ghi chú |
|---|---|---|
| **W1** | 1, 2, 4, 10 | Infra sẵn hoàn toàn — immersion + comprehension = khác biệt lớn nhất vs asbplayer/Migaku |
| **W2** | 3, 7, 11, 9 | Word browser + history = retention loop |
| **W3** | 12, 13, 5, 6 | Power-user polish |
| **W4** | 14, 15, 21, 27 | Learning-loop deepen |
| **W5+** | còn lại | System/admin/đắt — làm khi cần hoặc khi LLM roadmap rõ |
