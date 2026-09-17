# Product Backlog — Tihoka

> Living queue của các nhóm tính năng "Quản lý X". Sort theo **cost tăng dần** (rẻ → đắt); trong cùng cost, value cao đứng trước.
> Nguồn: audit tính năng 2026-09 (so sánh asbplayer + Migaku) — mọi item đều leverage infra hiện có (`wordStatusStore`, `cuesStore`, `frequencyClient`, `downloadQueue`, `mediaLibraryRepository`, `ApiKeyManager`, `lookupLog`).

## Cơ chế pick-off (lifecycle)

```
icebox → specced → planned → in-progress → shipped
```

1. **Pick**: lấy item trên cùng chưa `shipped` và không bị `deps` chặn. Reorder chỉ cho phép giữa các wave (không reorder giữa chừng khi đang build).
2. **Spec**: `/elicitation` → `docs/intent/<slug>.md` → `docs/specs/<slug>.md` → auto-review (spec-review-stakeholder) → fix ≤3 rounds.
3. **Plan**: `/planning-and-task-breakdown` → task list vào `tasks/`.
4. **Build**: implement theo plan — gates bắt buộc: `typecheck + lint + test:unit + build` + real-Chrome smoke nếu đụng runtime wiring; đổi `src/` → update `docs/2-architechture-system.md`.
5. **Ship**: commit → đổi status item thành `shipped` + link spec/commit trong backlog này → cập nhật `docs/0-wiki.md` changelog line.
6. **Veto**: Anh yêu có quyền veto/drop bất kỳ item nào bất cứ lúc nào — đổi status thành `dropped` kèm lý do 1 dòng.

### Cost key
`S` < 1 ngày · `M` 1–3 ngày · `L` > 3 ngày · `XL` multi-week

### Status key
`icebox` chưa spec · `specced` có spec · `planned` có plan · `in-progress` · `shipped` · `dropped`

## Backlog (rẻ → đắt)

| # | Nhóm | Sub-features chính | Cost | Value | Deps | Status | Spec |
|---|---|---|---|---|---|---|---|
| 1 | Quản lý Immersion Playback | pause-on-unknown-word (threshold config), condensed (skip gap >Xs), fast-forward-unsubtitled, auto-pause cuối cue, hotkey toggle | M | ★★★★★ | wordStatus×cuesStore | icebox | — |
| 2 | Quản lý Độ hiểu | % known badge, per-cue unknown count, difficulty per episode, history | M | ★★★★★ | tokenize×wordStatus | icebox | — |
| 3 | Quản lý Từ vựng | word browser (search/filter/bulk/export), single-unknown hotkey, word detail panel | M | ★★★★★ | wordStatusStore | icebox | — |
| 4 | Quản lý Download Queue | queue UI sidepanel: pause/resume/retry/remove, per-job log | M | ★★★★ | downloadQueue (đã fix) | icebox | — |
| 5 | Quản lý Phím tắt | rebindable hotkeys, conflict detect, per-context scope | M | ★★★★ | subtitleShortcuts | icebox | — |
| 6 | Quản lý Whitelist | per-domain rules UI trong popup, quick-toggle site | S | ★★★ | whitelist feature | icebox | — |
| 7 | Quản lý Thẻ đã tạo | mining history ring buffer, filter per video, reopen/re-send | M | ★★★★ | lookupLog pattern | icebox | — |
| 8 | Quản lý Focus | blur-until-pause, hide native subs, dim page, minimal-UI | S | ★★★ | SubtitleBlock CSS | icebox | — |
| 9 | Quản lý SRS/Review | due count + daily goal + streak trong sidepanel | S | ★★★ | quotaManager, getSrsStats | icebox | — |
| 10 | Quản lý Phụ đề | per-video attach history, offset preset per site/series, auto-match rules UI, subtitle health (gap/overlap/CPS) | M | ★★★★ | autoMatch, offsetController | icebox | — |
| 11 | Quản lý Session | continue watching, restore sau reload, per-tab snapshot | M | ★★★ | bounded caches | icebox | — |
| 12 | Quản lý OCR regions | saved region per site, presets, re-calibrate | M | ★★★ | regionSelector | icebox | — |
| 13 | Quản lý Media Library | series grouping, watch progress/resume, recent | M | ★★★ | mediaLibraryRepository | icebox | — |
| 14 | Quản lý Đề xuất học | "học tiếp theo" = frequency ∩ unknown, per-media vocab list export | M | ★★★★ | frequencyClient×wordStatus | icebox | — |
| 15 | Quản lý Ngữ cảnh học | immersion minutes per site/show, session tracking, weekly recap | M | ★★★ | — | icebox | — |
| 16 | Quản lý Lookup & Popup | hover delay, dismiss timing, size preset per site, source priority | M | ★★★ | popupGeometry | icebox | — |
| 17 | Quản lý Episode & Series | episode progress, per-series vocab tích lũy, watch-next | M | ★★★ | #13 | icebox | — |
| 18 | Quản lý Subtitle Discovery | provider order UI, fallback chain, manual override attach | M | ★★★ | pickProviderOrder | icebox | — |
| 19 | Quản lý API Keys & Quota | usage counters, provider health, cooldown view | S | ★★ | ApiKeyManager | icebox | — |
| 20 | Quản lý Listening | audio snippet re-record, captured-audio speed, pronunciation source priority | M | ★★★ | pronunciation services | icebox | — |
| 21 | Quản lý Mining Workflow | one-click preset, template per note-type, quick-add rules | M | ★★★★ | cardCreator | icebox | — |
| 22 | Quản lý Popup Dictionary UI | nested-stack rules, default tab per language, lazy-media prefs | S | ★★ | popup lifecycle | icebox | — |
| 23 | Quản lý Appearance | per-site/per-track subtitle style, preset share | M | ★★★ | theme system | icebox | — |
| 24 | Quản lý Diagnostics | dev panel: fetch-interceptor misses, lookupLog export, msg trace | S | ★★ | gated diag infra | icebox | — |
| 25 | Quản lý Reading Annotation | reading trên từ, pitch accent source, freq badge position | L | ★★★★ | tokenSpan render | icebox | — |
| 26 | Quản lý Goals & Streaks | daily immersion minutes, cards/day, nudges | M | ★★★ | #15 | icebox | — |
| 27 | Quản lý Playback Behavior | playback-after-mining, speed step, per-site speed memory | S | ★★★ | NavCluster | icebox | — |
| 28 | Quản lý Settings Profiles | named profiles, quick-switch, per-site override | L | ★★★ | settingsStore | icebox | — |
| 29 | Quản lý Dữ liệu | storage usage per feature, export/import all, reset per-feature | M | ★★★ | — | icebox | — |
| 30 | Quản lý Cache & Performance | OPFS usage, LRU sizes, memory, free-space action | M | ★★ | bounded caches | icebox | — |
| 31 | Quản lý Privacy | per-site data scope, incognito behavior, local-only view | M | ★★★ | — | icebox | — |
| 32 | Quản lý Study Modes | preset gallery, per-language defaults, share mode | M | ★★★ | CustomModeBuilder | icebox | — |
| 33 | Quản lý Performance Profile | per-site perf budget, low-RAM mode, reduced motion | L | ★★★ | — | icebox | — |
| 34 | Quản lý Sync & Backup | export/import wordStatus+settings+queue, device merge | L | ★★★ | — | icebox | — |
| 35 | Quản lý AI Generation | provider config, model choice, usage view, result cache | L | ★★★★ | LLM roadmap | icebox | — |

## Wave gợi ý (đã xét deps + leverage)

| Wave | Items | Ghi chú |
|---|---|---|
| **W1** | 1, 2, 4, 10 | Infra sẵn hoàn toàn — immersion + comprehension = khác biệt lớn nhất vs asbplayer/Migaku |
| **W2** | 3, 7, 11, 9 | Word browser + history = retention loop |
| **W3** | 12, 13, 5, 6 | Power-user polish |
| **W4** | 14, 15, 21, 27 | Learning-loop deepen |
| **W5+** | còn lại | System/admin/đắt — làm khi cần hoặc khi LLM roadmap rõ |
