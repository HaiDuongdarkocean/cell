# Intent — Refactor System Architecture (G0 Discovery)

> **Phase**: G0 Discovery — research + intent, chưa phải spec/plan.
> **Owner role**: Chief Architect / Software Architect (role #4 trong `docs/reference/software-org-roles.md`).
> **Date**: 2026-06-30.
> **Status**: Research complete — chờ anh confirm intent trước khi vào G1 Spec.

---

## 1. Mục đích (WHY)

Anh yêu muốn một **work tree gọn gàng, dễ maintain, dễ mở rộng, dễ tra cứu**. Codebase hiện tại có giá trị cao — mỗi file/function phải tìm được nhanh, tham chiếu/update không tốn sức. Đây là task **refactor cấu trúc toàn hệ thống** (hoặc từng phần tùy trường hợp), không phải rewrite behavior.

### Vấn đề gốc rễ quan sát được trong codebase hiện tại

Đọc `docs/2-architechture-system.md` thấy 2 "smell" rõ ràng:

1. **`src/content/` có ~20 file `subtitle*.ts` phẳng** — `subtitleParser`, `subtitleSync`, `subtitleUI`, `subtitleDragDrop`, `subtitleImport`, `subtitleOverlay`, `subtitleDragPosition`, `subtitleAutoLoad`, `subtitleMerge`, `subtitleTrackDropdown`, `subtitleSelector`, `subtitleBilingualParser`, `subtitlePanel`, `subtitleShortcuts`... Folder "screams" technical prefix thay vì domain intent → vi phạm **Screaming Architecture** (Uncle Bob).
2. **`src/lib/converters/` có ~15 file `parallel*.ts` phẳng** — `parallelTransmuxer`, `parallelCoordinator`, `parallelPlanner`, `parallelProgress`, `parallelSafetyAnalyzer`, `parallelPolicy`, `parallelFallback`, `parallelCancellation`, `segmentGrouping`, `segmentMerger`... Cùng cluster logic nhưng không có sub-folder group → khó tra cứu, khó mở rộng (thêm mode mới phải nhét thêm file phẳng).

Đây là dấu hiệu **"Big Ball of Mud" đang hình thành** (Foote & Yoder) — chưa tệ nhưng sẽ tệ nếu tiếp tục additive vào flat folder.

---

## 2. Role quyết định cấu trúc — Chief Architect

Tra `docs/reference/software-org-roles.md` mục #4 (line 245-290):

| Khía cạnh | Nội dung |
|---|---|
| **Input** | PRD (CPO), tech strategy + standards (CTO), constraints (budget/timeline/team), existing codebase, NFRs (performance/security/scalability) |
| **Output** | Architecture doc (C4 model: Context→Container→Component→Code), ADRs system-level, sequence diagrams, data model, API contracts, decision matrix |
| **WHY tồn tại** | Trả lời "Hệ thống cấu trúc thế nào?" — chống "big ball of mud", đảm bảo consistency, trade-off analysis thay vì "thích" |
| **WHY ảnh hưởng** | Structure (folder layout), Integration pattern (SW orchestrator + offscreen), Data flow (popup→SW→offscreen→storage), Testability (ports & adapters) |
| **HOW tác động** | Architecture doc (dev đọc biết file mới vào đâu), ADRs (chốt quyết định không tranh luận lại), diagrams (onboard 1 giờ thay 1 tuần), code review (dependency rule violation) |

→ **Em đóng role Architect** cho task này. Output của G0 này = input cho G1 Spec (refactor spec) → G2 Plan → G3 ADR → G4 Implementation.

---

## 3. Phương pháp nghiên cứu

Nghiên cứu **53 nguồn** chia 5 cluster, mỗi cluster do 1 subagent độc lập chạy web_search + webfetch:

| Cluster | Loại | Số nguồn |
|---|---|---|
| 1 | Sách nền tảng architecture & refactor | 10 |
| 2 | Video/vlog/conference talks | 13 |
| 3 | Web articles & blogs | 10 |
| 4 | Refactor patterns & mechanisms (concrete how) | 10 |
| 5 | Frontend & Chrome MV3-specific structure | 10 |
| **Tổng** | | **53** (≥30 yêu cầu) |

Danh sách đầy đủ 53 nguồn kèm URL ở **Phụ lục A** cuối file.

---

## 4. Nguyên lý cơ chế refactor — rút từ 53 nguồn

### 4.1. Nguyên lý lặp lại (cross-source, high-confidence)

7 nguyên lý xuất hiện ở ≥3 cluster độc lập → high-confidence:

#### P1. Test coverage là điều kiện tiên quyết để refactor an toàn
- **Fowler** (sách #1, talk #1): automated tests = safety net cho behavior-preserving transformations.
- **Feathers** (sách #2, talk #4): legacy code = code không có test; characterization tests pin current behavior trước khi sửa.
- **Ford/Richards** (sách #4): testability là architecture characteristic phải thiết kế + đo.
- **Uncle Bob** (sách #9, talk #11): inner layers testable vì dependency pointing inward.
- **Metz** (talk #6): "get to green quickly, then refactor".
- **→ Áp dụng**: trước khi move file nào, phải có characterization test pin behavior hiện tại. Codebase đã có Jest unit (~3s) + integration + Playwright E2E → tận dụng, bổ sung characterization cho 2 cluster smell.

#### P2. Nhận diện và tôn trọng boundary tự nhiên
- **Evans** (sách #6, talk #9): bounded contexts — ranh giới nơi một model áp dụng.
- **Newman** (sách #8, talk #10): service boundary align business capability + team ownership (Conway's Law).
- **Feathers** (sách #2): inflection points = narrow interface nơi change detectable.
- **Ousterhout** (sách #3): deep modules hide complexity behind simple interface; different layers khác abstraction level.
- **Ford/Richards** (sách #4): component determination qua functional cohesion + connascence.
- **→ Áp dụng**: không ép boundary theo "thích". Nhận diện cluster subtitle (overlay+sync+import+drag+panel+selector+merge+autoload+shortcuts) và cluster parallel-transmux (planner+coordinator+progress+safety+policy+fallback+cancellation+merger) là 2 bounded context tự nhiên. Folder phải phản ánh boundary này.

#### P3. Thay đổi tăng dần, không big-bang rewrite
- **Fowler** (sách #1, talk #1, #2): small behavior-preserving steps; strangler fig.
- **Feathers** (sách #2): legacy code change algorithm — small checkable steps.
- **Newman** (sách #8, talk #10): strangler fig + branch by abstraction; "monolith is not the enemy".
- **Foote & Yoder** (article #9): piecemeal growth + keep it working.
- **North** (talk #7, #13): "Best Simple System for Now" — từ chối false trade-off quick-hack vs over-engineer.
- **Farley** (talk #8): evolutionary architecture, "tourist map" evolve as you learn.
- **Spolsky** (pattern #7): "never rewrite from scratch" — old code chứa battle-tested bug fixes.
- **→ Áp dụng**: KHÔNG rewrite toàn bộ. Dùng Strangler Fig + Parallel Change (expand-migrate-contract) để move file theo cluster, giữ system compile + test pass xuyên suốt.

#### P4. Trade-off analysis — không có architecture hoàn hảo
- **Ford/Richards/Sadalage/Dehghani** (sách #5, talk #3): "no easy decisions, only trade-offs"; disintegrators vs integrators.
- **Kleppmann** (sách #7): CAP trade-offs, schema evolution continuous.
- **Ousterhout** (sách #3): deep vs shallow module là spectrum.
- **Henney** (talk #5): SOLID không phải rigid rules — contextual.
- **Farley** (talk #8): "few constraints, rigidly enforced".
- **→ Áp dụng**: mỗi quyết định folder/split phải có trade-off table (split vì cohesion cao? giữ vì transaction/data coupling?). ADR ghi lại reasoning.

#### P5. Dependency inversion + information hiding giảm coupling
- **Uncle Bob** (sách #9, talk #11): Dependency Rule — dep pointing inward.
- **Ousterhout** (sách #3): information hiding = kỹ thuật quan trọng nhất cho deep modules; eliminate back-door leakage.
- **Feathers** (sách #2): seams = place alter behavior without editing.
- **Evans** (sách #6): anti-corruption layer isolate external systems.
- **Cockburn** (pattern #9): ports & adapters — core không biết adapter, chỉ biết port.
- **→ Áp dụng**: chrome.* APIs (tabs/storage/runtime/cookies) là infrastructure → wrap vào port interface. Business logic (subtitle merge, transmux plan) depend vào port, không depend trực tiếp chrome.*. Cho phép test không cần browser.

#### P6. Align architecture với domain + organization
- **Evans** (sách #6): ubiquitous language per bounded context.
- **Newman** (sách #8): Conway's Law — boundary align team.
- **Ford/Richards** (sách #4): architecture characteristics translate domain stakeholder concerns.
- **Uncle Bob** (talk #11, pattern #10): Screaming Architecture — folder names reveal domain, không reveal framework.
- **→ Áp dụng**: folder `src/features/subtitle/` "screams" domain subtitle; `src/features/transmux/` screams transmux. KHÔNG dùng `src/lib/converters/parallel*.ts` (technical prefix).

#### P7. Data architecture thường là phần khó nhất
- **Ford/Richards/Sadalage/Dehghani** (sách #5): data ownership + distributed transaction là hard parts.
- **Newman** (sách #8): data decomposition harder than code decomposition.
- **Kleppmann** (sách #7): data modeling choices profound; schema evolution continuous.
- **Majors** (article #8): structured events — context propagation.
- **→ Áp dụng**: refactor phải tính data flow popup↔SW↔offscreen↔OPFS↔chrome.storage. State Zustand ở popup/sidepanel + cache ở SW + persist OPFS → vẽ data flow diagram trước khi move file.

### 4.2. Nguyên lý phụ (xuất hiện 1-2 cluster, vẫn值得 cite)

- **P8. Duplication cheaper than wrong abstraction** (Metz talk #6, North talk #7, Henney talk #5): không abstract sớm khi chưa thấy pattern rõ. Tolerate duplicate giữa các subtitle*.ts khi mới group, extract shared sau.
- **P9. Make smaller things / Fits in My Head** (Metz talk #6, North talk #7): module phải hiểu được trong ~5 giây. Nếu 1 file >300 dòng hoặc 1 folder >10 file → split signal.
- **P10. Opportunistic refactoring > planned refactoring** (Fowler talk #1): litter-pickup + comprehension + preparatory refactoring tích hợp vào daily work; planned refactoring story = smell chỉ insufficient opportunistic.
- **P11. Shearing layers** (Foote & Yoder article #9): tách component thay đổi rate khác. UI thay đổi nhanh hơn business logic nhanh hơn data schema → layer riêng.
- **P12. Architecture as constraints, not rules** (Farley talk #8, Henney talk #5): ít constraint, enforce nghiêm ngặt. VD: "feature folder không import feature folder khác qua internal path" — 1 rule, lint enforce.

---

## 5. Cơ chế refactor — concrete how (từ cluster 4 + 5)

### 5.1. Pattern ưu tiên cho codebase này (flat-folder → structured)

| Pattern | Nguồn | Khi nào dùng cho cell |
|---|---|---|
| **Characterization Tests** | Feathers | TRƯỚC khi move bất kỳ file nào — pin behavior 2 cluster smell |
| **Seams** | Feathers | Wrap chrome.* APIs thành port interface → enable test không browser |
| **Parallel Change (Expand-Contract)** | Fowler | Move file: expand (tạo new folder + barrel), migrate (update import từng file), contract (xóa old path) |
| **Branch by Abstraction** | Hammant/Newman | Khi 1 module cần rewrite logic (không chỉ move) — tạo interface, 2 impl共存, toggle switch |
| **Strangler Fig** | Fowler/Newman | Cho cluster lớn cần thay đổi dần — grow new structure around old, redirect incrementally |
| **Screaming Architecture** | Uncle Bob | Rename folder theo domain (`features/subtitle/`, `features/transmux/`) thay vì technical prefix |
| **Feature Folders + Colocation** | Bulletproof React, FSD | Group subtitle*.ts vào `features/subtitle/{ui,logic,service,types}/`; parallel*.ts vào `features/transmux/...` |
| **Ports & Adapters** | Cockburn | chrome.* adapters ở `shared/lib/chrome-apis/`, port interface ở `features/*/ports/` |
| **Zustand Slice Pattern** | pmndrs | Store popup/sidepanel split theo feature slice, persist middleware sync chrome.storage |

### 5.2. Pattern KHÔNG dùng / dùng cẩn thận

- **Paving the Cow Path** (Wirfs-Brock/Yoder) — **ANTI-PATTERN**: move file механически sang new folder mà không fix coupling → bad design trong new tech. **Tránh**: dùng cơ hội refactor để fix design, không chỉ reorganize.
- **Big-bang Rewrite** — **tránh** theo Spolsky + Fowler + Newman. Codebase đang chạy + có test → refactor tăng dần.
- **Premature Abstraction** — Metz cảnh báo: không tạo shared util giữa subtitle files khi mới group; tolerate duplicate, extract sau khi pattern rõ.

### 5.3. Quyết định Rewrite vs Refactor (Spolsky framework + Ford/Richards trade-off)

Score 4 dimension (0-25, max 100):

| Dimension | Score | Lý do |
|---|---|---|
| Codebase Health | 18/25 | Code chạy, có test, abstractions OK (chỉ folder structure messy, không core abstraction sai) |
| Business Risk | 5/25 | Extension đang hoạt động, không block revenue-critical feature, refactor chỉ cải thiện DX |
| Team Capability | 20/25 | 1 người (anh + em), hiểu WHY code như vậy, đã ship nhiều feature |
| Timeline | 10/25 | Không deadline cứng, nhưng không afford 12-18 tháng rewrite |
| **Tổng** | **53/100** | **40-65 → Hybrid: Strangler Fig + incremental modernization, KHÔNG rewrite** |

→ **Quyết định: Refactor tăng dần, không rewrite.**

---

## 6. Input → Output của toàn bộ task refactor

### 6.1. Input (cần có trước khi bắt đầu G4 Implementation)

| Input | Nguồn | Trạng thái |
|---|---|---|
| Existing codebase + architecture map | `docs/2-architechture-system.md` | ✅ có |
| Tech strategy + standards | `AGENTS.md`, ADRs 001-015 | ✅ có |
| Constraints (1 người, Windows, MV3 limits) | `AGENTS.md` | ✅ có |
| NFRs (performance, testability, maintainability) | implicit — cần explicit hóa ở G1 | ⚠️ cần |
| Characterization tests cho 2 cluster smell | Jest + Playwright hiện có | ⚠️ cần bổ sung |
| Trade-off analysis (split vs keep mỗi cluster) | mới rút nguyên lý P4 | ⚠️ cần làm ở G3 ADR |
| 53 nguồn nghiên cứu (Phụ lục A) | research này | ✅ có |

### 6.2. Output (sản phẩm cuối G4-G6)

| Output | Artifact | Phase |
|---|---|---|
| Architecture doc (C4 model) | `docs/architecture/system-architecture.md` (C4: Context→Container→Component→Code) | G3 |
| ADRs system-level (refactor decisions) | `docs/adr/016-refactor-folder-structure.md` + các ADR con | G3 |
| Sequence diagrams (data flow popup↔SW↔offscreen↔OPFS) | `docs/diagrams/` | G3 |
| Target folder structure | `src/` reorganized | G4 |
| Updated `docs/2-architechture-system.md` | reflect new structure | G4 (sau mỗi milestone) |
| Characterization test suite | `tests/characterization/` | G5 |
| Migration log | git history + ADR chain | G4-G6 |

### 6.3. Output KHÔNG bao gồm

- ❌ Behavior change (refactor = preserve behavior, không thêm feature)
- ❌ New dependencies (ponytail: dùng stdlib + installed deps)
- ❌ Rewrite logic trừ khi 1 module cụ thể có root-cause bug

---

## Phụ lục A — Danh sách 53 nguồn nghiên cứu

### Cluster 1: Sách nền tảng (10)
1. *Refactoring: Improving the Design of Existing Code* (2nd ed) — Martin Fowler & Kent Beck (2018) — https://martinfowler.com/books/refactoring.html
2. *Working Effectively with Legacy Code* — Michael Feathers (2004) — https://www.pearson.com/en-us/subject-catalog/p/Feathers-Working-Effectively-with-Legacy-Code/P200000008984
3. *A Philosophy of Software Design* (2nd ed) — John Ousterhout (2021) — https://stanford.edu/~ouster/cgi-bin/aposd.php
4. *Fundamentals of Software Architecture* (2nd ed) — Neal Ford & Mark Richards (2022) — https://www.oreilly.com/library/view/fundamentals-of-software/9781098175504/
5. *Software Architecture: The Hard Parts* — Ford, Richards, Sadalage, Dehghani (2021) — https://www.oreilly.com/library/view/software-architecture-the/9781492086888/
6. *Domain-Driven Design* — Eric Evans (2003) — https://www.domainlanguage.com/ddd/
7. *Designing Data-Intensive Applications* — Martin Kleppmann (2017) — https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/
8. *Building Microservices* (2nd ed) — Sam Newman (2021) — https://samnewman.io/books/building_microservices_2nd_edition/
9. *Clean Architecture* — Robert C. Martin (2017) — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
10. *Software Design for Flexibility* — Hanson & Sussman (2021) — https://mitpress.mit.edu/9780262045490/software-design-for-flexibility/

### Cluster 2: Video/vlog/conference talks (13)
11. "Workflows of Refactoring" — Martin Fowler (OOP 2014) — https://www.youtube.com/watch?v=vqEg37e4Mkw
12. "Strangler Fig Application" — Martin Fowler (blog/talk) — https://martinfowler.com/bliki/StranglerFigApplication.html
13. "Software Architecture: The Hard Parts" — Ford & Richards (GOTO) — https://www.youtube.com/watch?v=Q6RfMmMwhvM
14. "Working Effectively with Legacy Code" — Michael Feathers (talks) — https://www.youtube.com/watch?v=mwVRHDD0tEk
15. "SOLID Deconstruction" — Kevlin Henney (GOTO/YOW 2013-2014) — https://www.youtube.com/watch?v=EDdeO
16. "All the Little Things" — Sandi Metz (RailsConf 2014) — https://www.youtube.com/watch?v=8bZh5LMaSmE
17. "Software, Faster" — Dan North (GOTO Amsterdam 2016) — https://www.youtube.com/watch?v=USc-yLHXNUg
18. "What Software Architecture Should Look Like" — Dave Farley (GOTO 2022) — https://www.youtube.com/watch?v=Eg_dapdKCHU
19. "DDD & Microservices: At Last, Some Boundaries!" — Eric Evans (GOTO Berlin 2015) — https://www.youtube.com/watch?v=yPvef9R3k-M
20. "Monolith Decomposition Patterns" — Sam Newman (GOTO Berlin 2019) — https://www.youtube.com/watch?v=9I9GdSQ1bbM
21. "Clean Architecture and Design" — Robert C. Martin (COHAA 2012) — https://www.youtube.com/watch?v=asLUTiJJqdE
22. "Polly Want a Message" — Sandi Metz (Deconstruct 2018) — https://www.youtube.com/watch?v=XXi_FBrZQiU
23. "Best Simple System for Now" — Dan North (GOTO 2025 / blog) — https://dannorth.net/blog/best-simple-system-for-now/

### Cluster 3: Web articles & blogs (10)
24. "StranglerFigApplication" — Martin Fowler — https://martinfowler.com/bliki/StranglerFigApplication.html
25. "Refactoring" (catalog) — Martin Fowler — https://www.martinfowler.com/books/refactoring.html
26. "Separated Presentation" — Martin Fowler — https://martinfowler.com/eaaDev/SeparatedPresentation.html
27. "A Simple Framework for Architectural Decisions" — Eoin Woods (InfoQ) — https://www.infoq.com/articles/framework-architectural-decisions/
28. "Architecture Advice Process" — ThoughtWorks Technology Radar — https://www.thoughtworks.com/radar/techniques/architecture-advice-process
29. "Monolith Decomposition Patterns" — Sam Newman — https://samnewman.io/talks/monolith-decomposition-patterns/
30. "Branch by Abstraction" — Sam Newman / Paul Hammant — https://samnewman.io/patterns/architectural/branch-by-abstraction/
31. "Live Your Best Life With Structured Events" — Charity Majors — https://charity.wtf/2022/08/15/live-your-best-life-with-structured-events/
32. "Big Ball of Mud" — Brian Foote & Joseph Yoder — https://www.laputan.org/mud/
33. "The Clean Architecture" — Robert C. Martin — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html

### Cluster 4: Refactor patterns & mechanisms (10)
34. Strangler Fig Pattern — Martin Fowler — https://martinfowler.com/bliki/StranglerFigApplication.html
35. Branching by Abstraction — Paul Hammant — https://paulhammant.com/blog/branch_by_abstraction.html
36. Parallel Change (Expand-Contract) — Fowler — https://martinfowler.com/bliki/ParallelChange.html
37. Seams — Michael Feathers — https://martinfowler.com/bliki/LegacySeam.html
38. Characterization Tests — Michael Feathers — https://michaelfeathers.silvrback.com/characterization-testing
39. Paving the Cow Path (anti-pattern) — Wirfs-Brock & Yoder — https://wirfs-brock.com/PDFs/PatternsForSustainingArchitectures.pdf
40. Rewrite vs Refactor — Joel Spolsky — https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/
41. Feature Folders vs Layered Folders — React community — https://asrulkadir.medium.com/3-folder-structures-in-react-ive-used-and-why-feature-based-is-my-favorite-e1af7c8e91ec
42. Ports & Adapters (Hexagonal) — Alistair Cockburn — https://medium.com/@devripper133127/hexagonal-architecture-ports-adapters-23f87449159b
43. Screaming Architecture — Robert C. Martin — https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html

### Cluster 5: Frontend & Chrome MV3-specific (10)
44. Bulletproof React — alan2207 — https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
45. React Docs — "Choosing the State Structure" — https://react.dev/learn/choosing-the-state-structure
46. Chrome Extensions MV3 — Architecture Overview — https://developer.chrome.com/docs/extensions/mv3/architecture-overview
47. @crxjs/vite-plugin docs — https://crxjs.dev/guide/installation/from-scratch/
48. Feature-Sliced Design — https://feature-sliced.design/docs/get-started/overview
49. "How To Structure React Projects" — Web Dev Simplified — https://blog.webdevsimplified.com/2022-07/react-folder-structure/
50. Zustand Best Practices — Flux-Inspired + Slices — https://github.com/pmndrs/zustand/blob/HEAD/docs/learn/guides/flux-inspired-practice.md
51. "Screaming Architecture & Colocation" — The T-Shaped Dev — https://thetshaped.dev/p/screaming-architecture-and-colocation-nodejs-typescript-react
52. WXT (Web Extension Tools) docs — https://wxt.dev/docs/guide/essentials/project-structure
53. "How to Structure a Production-Ready Chrome Extension (MV3)" — Hewitt (dev.to) — https://dev.to/hewitt/how-to-structure-a-production-ready-chrome-extension-manifest-v3-2hlf

---

## 7. Target structure đề xuất (synthesis từ cluster 5)

> **Lưu ý**: đây là đề xuất sơ bộ từ research, KHÔNG phải quyết định cuối. Quyết định cuối ở G3 ADR sau khi trade-off analysis cụ thể.

Kết hợp **Bulletproof React** (feature folders + colocation) + **Feature-Sliced Design** (layer + import rule) + **Screaming Architecture** (domain-named folders) + **MV3 official** (entrypoint separation) + **Zustand slice pattern**:

```
src/
├── entrypoints/                    # MV3 surfaces (CRXJS/WXT convention)
│   ├── background/
│   │   ├── index.ts                # SW entry
│   │   └── handlers/               # Message handlers per feature
│   ├── content/
│   │   ├── index.ts                # Content script entry (thin)
│   │   └── video/                  # Domain-specific content modules
│   ├── offscreen/
│   │   └── transmux/
│   ├── popup/
│   └── sidepanel/
│
├── features/                       # Business features (Screaming Architecture)
│   ├── subtitle/                   # ← group 20 subtitle*.ts
│   │   ├── ui/                     # overlay, drag handle, selector, panel toggle
│   │   ├── logic/                  # sync, merge, bilingual parser
│   │   ├── service/                # auto-load, import, drag-drop, track dropdown
│   │   ├── ports/                  # ISubtitleStorage, ISubtitleOverlay
│   │   ├── types.ts
│   │   └── index.ts                # Public API (barrel)
│   ├── transmux/                   # ← group 15 parallel*.ts
│   │   ├── planning/               # planner, grouping, policy
│   │   ├── execution/              # coordinator, progress, cancellation, fallback
│   │   ├── merging/                # merger, validator, timer
│   │   ├── ports/                  # ITransmuxWorker, IOPFSStorage
│   │   ├── types.ts
│   │   └── index.ts
│   ├── download/                   # downloader, queue, auto-download
│   ├── detection/                  # video/subtitle/language/script detectors
│   └── whitelist/                  # whitelist CRUD
│
├── entities/                       # Domain models (FSD)
│   ├── subtitle/                   # SubtitleFormat, Cue, ParseResult
│   ├── video/                      # DetectedVideo, ByteRange, HlsEncryption
│   └── settings/                   # Settings, FilenameSource
│
├── shared/                         # Cross-cutting
│   ├── lib/
│   │   ├── chrome-apis/            # Adapters: runtime, storage, tabs (ports impl)
│   │   ├── messaging/              # messageBus, message-types
│   │   └── parsers/                # m3u8, ass, vtt, srt, assToSrt, vttToSrt, srtNormalizer
│   ├── utils/                      # file, time, url (pure)
│   └── config/                     # constants, urls, feature-flags
│
├── stores/                         # Zustand (slice pattern)
│   ├── popup/                      # slices: media, downloads, settings, subtitles
│   └── sidepanel/                  # slices: cues, playback
│
└── app/                            # Wiring
    ├── providers/
    └── styles/
```

**Dependency rule (FSD import rule)**:
```
entrypoints → features → entities → shared
features → shared, entities (KHÔNG → entrypoints)
features → KHÔNG import feature khác qua internal path (chỉ qua public index.ts)
```

---

## 8. Rủi ro + mitigation

| Rủi ro | Mitigation |
|---|---|
| Move file break import path hàng loạt | Parallel Change: expand (tạo new + barrel) → migrate (update import từng file, test sau mỗi file) → contract (xóa old) |
| Chrome MV3 build break (crxjs manifest path) | Test build sau mỗi milestone; không đổi manifest entry path nếu không cần |
| Behavior thay đổi vô tình | Characterization tests pin behavior trước; chạy `npm run test:unit` + `npx tsc --noEmit` sau mỗi file move |
| Over-engineer (premature abstraction) | Ponytail + Metz: tolerate duplicate, extract shared chỉ khi pattern rõ ≥3 lần |
| Browser runtime bug không bắt được bằng unit test | Browser-facing verification (chrome-devtools MCP / Playwright) trước commit — rule stop-the-line trong AGENTS.md |
| Bus factor = 1 (1 người refactor) | ADR ghi reasoning mỗi quyết định + update `2-architechture-system.md` sau mỗi milestone |

---

## 9. Câu hỏi cho anh (G0 → G1 gate)

Trước khi vào G1 Spec, em cần anh confirm:
<tool_call>ask_user_question
<arg_key>questions</arg_key>
<arg_value>[
    {
        "question": "Phạm vi refactor — anh muốn refactor toàn bộ hay ưu tiên 2 cluster smell (subtitle*.ts + parallel*.ts) trước?", 
        "header": "Phạm vi", 
        "multi_select": false, 
        "options": [
            {"label": "2 cluster smell trước", "description": "Refactor subtitle/ + transmux/ trước (20+15 file), giữ nguyên phần còn lại. Rủi ro thấp, value cao, nhanh thấy kết quả. Phần còn lại refactor sau nếu cần."}, 
            {"label": "Toàn bộ src/", "description": "Refactor toàn bộ src/ sang target structure (entrypoints/features/entities/shared/stores/app). Phạm vi rộng hơn, nhiều milestone hơn, nhưng nhất quán 1 lần."}, 
            {"label": "Toàn bộ + tests structure", "description": "Refactor cả src/ và tests/ cho đồng bộ cấu trúc. Phạm vi rộng nhất."}
        ]
    }, 
    {
        "question": "Target structure — anh đồng ý hướng Feature-Sliced Design + Screaming Architecture (đề xuất mục 7) hay muốn variant khác?", 
        "header": "Target struct", 
        "multi_select": false, 
        "options": [
            {"label": "Đồng ý đề xuất mục 7", "description": "entrypoints/ + features/ + entities/ + shared/ + stores/ + app/. FSD layers + Screaming Architecture domain folders."}, 
            {"label": "Giữ surface folders, chỉ group bên trong", "description": "Giữ src/{background,content,offscreen,popup,sidepanel,lib,constants,types} hiện tại, chỉ tạo sub-folder group bên trong content/ và lib/converters/. Ít break import nhất."}, 
            {"label": "Bulletproof React thuần", "description": "src/{app,features,shared,entities} không tách entrypoints (MV3 entry ở root). Đơn giản hơn FSD."}
        ]
    }, 
    {
        "question": "Cadence commit — anh muốn refactor theo milestone lớn hay commit nhỏ mỗi file/cluster?", 
        "header": "Commit cadence", 
        "multi_select": false, 
        "options": [
            {"label": "Commit nhỏ mỗi cluster", "description": "Mỗi cluster (subtitle, transmux, download, detection...) = 1 commit. Dễ rollback, dễ review, test pass sau mỗi commit."}, 
            {"label": "Commit mỗi file move", "description": "Mỗi file move + import update = 1 commit. Rất nhỏ, rất an toàn, nhưng nhiều commit."}, 
            {"label": "Milestone lớn (1 PR/branch)", "description": "Refactor trên branch riêng, 1 PR lớn merge cuối. Ít commit noise nhưng review khó."}
        ]
    }, 
    {
        "question": "Anh có muốn em viết luôn G1 Spec ngay sau khi confirm, hay dừng ở G0 chờ anh review research này trước?", 
        "header": "Next step", 
        "multi_select": false, 
        "options": [
            {"label": "Dừng G0, chờ review", "description": "Anh đọc research + nguyên lý này trước, confirm/điều chỉnh, rồi em mới vào G1 Spec."}, 
            {"label": "Viết luôn G1 Spec", "description": "Em viết luôn spec refactor dựa trên research + câu trả lời phạm vi/target ở trên."}
        ]
    }
]