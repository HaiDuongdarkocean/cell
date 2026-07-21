# 0-Wiki — Project Overview

> **Đọc file này đầu tiên** sau mỗi context reset để biết dự án có gì.

## Cây thư mục tổng quan

```
docs/           # Tài liệu dự án
├── 0-wiki.md                          # File này — mục lục tổng quan
├── 1-share-language.md                # Glossary human ↔ system language
├── 2-architechture-system.md          # Architecture chi tiết (src/ + tests/ + dependency + function index + data flows; overlay button appearance/host-CSS defenses; top-frame guard cho Cloudflare challenge iframe)
├── technical-debt-audit.md            # Tổng hợp nợ kỹ thuật hiện có của codebase
├── interview_ui-ux-tokenize-on-media.md # Interview UI/UX phân tích từ trên media (đã hoàn thành 2026-07-20: wireframe + prototype verified Edge DevTools; 7 IA groups, token inline-block + status float absolute không nhảy dòng, status underline 2px, không viền outline hover/active, bỏ hiển thị IPA trên token, FAB draggable, desktop anchored dialog, known/ignore ẩn phân tích mặc định hover hiện status, văn bản dài multi-line test)
├── adr/                               # Architecture Decision Records (mỗi quyết định 1 file)
│   ├── 001-zustand-not-redux.md
│   ├── 002-muxjs-not-ffmpeg-wasm.md
│   ├── 003-content-script-background-network-interception.md
│   ├── 004-layered-clean-architecture.md
│   ├── 005-subtitle-floating-panel.md # Subtitle panel: inline DOM, bilingual delimiter, CS shortcuts
│   ├── 006-architecture-proposal.md   # Architecture proposal
│   ├── 007-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load architecture
│   ├── 008-side-panel-subtitle.md     # Side Panel API thay thế inject-DOM panel
│   ├── 009-side-panel-video-controls.md # Side Panel video controls (hotkeys + media clear)
│   ├── 010-in-page-episode-switch-detection.md # In-page episode switch (video element replacement)
│   ├── 012-spa-two-phase-render-wipe.md # SPA two-phase render wipe (isVideoReady gate)
│   ├── 013-subtitle-appearance-manager.md # 2 overlay layer độc lập + per-layer style + drag handle
│   ├── 014-subtitle-selector-multi-match.md # Subtitle selector ≥2 matches (V2 ADR-007 D3) + bug A fix (loadBilingualCues merge)
│   ├── 015-subtitle-drag-integrated.md  # Subtitle drag integrated (xóa icon riêng, drag trực tiếp overlay background)
│   └── 016-fsd-screaming-architecture-worktree.md # FSD + Screaming Architecture worktree (refactor src/ + tests/ cho Orca platform, 6 layer + dependency rule + port/adapter)
│   └── 017-refactor-architecture-debt.md
│   └── 018-subtitle-navigation-control-cluster.md # Nav cluster controller contract (NavClusterController class, settings schema v2 flat keys, cue source findCurrentLine, kbd fixed parallel, Pointer Events drag, CSS half-circle collapse) # Refactor architecture debt phase 2 (8 decisions D1-D8 from architecture review 2026-07-01, M14-M21)
│   └── 019-subtitle-time-offset.md # Subtitle time offset V1 interface contracts (OffsetController class, lazy/committed mode, settings schema)
│   └── 020-youtube-subtitle-detection.md # YouTube subtitle detection interface contracts (Two Detection Paths, MAIN world postMessage bridge, InnerTube fallback via background SW, SPA yt-navigate-finish + videoId dedup, DetectedSubtitle isAsr?/displayName?)
│   └── 021-translate-subtitle-background-prefill.md # ADR-021 background prefill + Google unofficial + 0 setting + cache per-session + ShortcutInput combo (cite spec)
│   └── 022-port-theocean-theme-system.md # ADR-022 port theocean theme: storage tách riêng (themeMode + themeConfig no mode), 9 core tokens runtime + derive secondary, system mode, content-script inject customColors, SettingsDialog giữ toggle shortcut, ThemeProvider init 3 entrypoint
│   └── 023-port-theocean-dictionary-import.md # ADR-023 port theocean dict: IndexedDB 3 stores + dbHash random, migration v9 create-all only, strategy template method (5 + base), fflate gzip+zip, sql.js lazy-load (wasm-unsafe-eval CSP đã có), atomic rollback, SHA-256 dedupe 1MB sample, batch 5000 streaming
│   └── 024-portable-theme-boundary.md # ADR-024: component-level data-theme boundary cho portable content-script UI (amends ADR-022 D4)
│   └── 025-subtitle-block-unified.md # ADR-025: gộp target + native + nav cluster thành 1 block, pill kéo trục Y, auto-scale theo video
│   └── 026-card-creator-anki-integration.md # ADR-026: Card Creator — Anki integration via AnkiConnect (desktop + Android, silent no-op detection, draft autosave)
│   └── 027-generate-native-subtitle.md # ADR-027: manual generate native subtitle via button/shortcut, reuse ADR-021 prefill, virtual panel slot
│   └── 028-iqiyi-subtitle-detection.md # ADR-028: iQIYI subtitle detection — MAIN-world playerObject.stl extraction, clone ADR-020 pattern, SRT format, lid→ISO map, source dispatch trên DETECTED_SUBTITLES
│   └── 029-netflix-subtitle-detection.md # ADR-029: Netflix subtitle detection — graph traversal cadmiumPlayerRepository, TTML format, MAIN-world IIFE
│   └── 030-netflix-seek-d7375.md # ADR-030: Netflix M7375 fix — route seek/play/pause qua player API via CustomEvent, tránh video.currentTime trực tiếp
│   └── 031-netflix-ui-z-index-fix.md # ADR-031: Netflix UI z-index fix — mount Cell UI vào .watch-video + z-index max, copy data-theme cho CSS vars
│   └── 032-cue-seek-dedupe.md # ADR-032: dedupe cue-seek khi Side Panel + keydown cùng fire + cleanup listeners tránh stale instances
│   └── 033-netflix-seek-async-rapid-nav.md # ADR-033: track lastSeekTarget cho rapid cue-nav — Netflix seek async, videoMs chưa tới target → tính sai
│   └── 034-track-element-subtitle-detection.md # ADR-034: trust `<track>` element semantics, bypass URL pattern cho extension-less subtitle URL (anikage.cc)
│   └── 035-scanned-subtitle-initiator-dnr-origin.md # ADR-035: pass frame URL as `initiator` cho scanned subtitle → DNR Origin → fix 403 "forbidden origin" trên prox.anicore.tv (anikage.cc)
│   └── 036-stremio-addon-subtitle-listing-parser.md # ADR-036: parse Stremio addon listing JSON (torrentio) → extract subtitles[].url thật, không misclassify listing URL thành subtitle file
│   └── 037-english-phrase-match.md          # ADR-037: Cambridge phrase templates → compact anchor index + bounded token-DP matcher, low-RAM deterministic matching
│   └── 038-popup-dictionary-shadow-dom-vanilla-dom.md # ADR-038: Popup Dictionary Shadow DOM + vanilla DOM (CSS isolation, no React in content script)
│   └── 039-cambridge-sense-splitting.md     # ADR-039: split Cambridge multi-sense definitions at every numeric marker, including idiom markers without POS
│   └── 040-inflectional-morphology-lemma.md # ADR-040: inflectional morphology lemma — comparative/superlative (-er/-est/-ier/-iest) + irregular comparison; orchestrator lemma fallback + multi-candidate
│   └── 041-unified-lemma-module.md          # ADR-041: unified multi-candidate lemma module — ALL 8 inflectional suffixes + irregulars; supersedes ADR-040 single-candidate; phraseMatcher delegates
│   └── 042-sticky-candidate-header.md       # ADR-042: sticky candidate header cho popup dictionary (CSS position:sticky, 2-layer shell + candidate-list wrapper, iOS Safari bug workaround)
│   └── 043-popup-dictionary-ux-improvements.md # ADR-043: header audio/close buttons, audio play/pause state, image grid, links chips, Quick Add toast, focus trap, drag header
│   └── 044-design-token-ssot.md        # ADR-044: Single source of truth cho design tokens (tokens.json + generator + runtime wrapper)
│   └── 045-popup-dictionary-redesign-hybrid-chips.md # ADR-045: Popup Dictionary redesign — hybrid chips + expand, single context-aware toolbar, 3-row header, footer status/send/settings
│   └── 046-web-text-dictionary-decouple.md # ADR-046: Decouple web-text dictionary popup from video presence + word highlight
│   └── 047-viewport-lazy-tokenization.md # ADR-047: Viewport-driven lazy tokenization for 1GB RAM (text + subtitle)
│   └── 048-tokenize-spa-activation-starvation.md # ADR-048: Fix activation/re-scan starvation trên heavy SPA (Facebook/Twitter) — max-delay cap + ViewportTracker re-observe onEnter
│   └── 049-tokenize-smooth-fast-spa.md # ADR-049: Tokenize mượt hơn, toàn diện hơn, nhanh hơn trên heavy SPA — early bind + batched metadata + incremental scan + defensive renderer
│   └── 050-tokenize-raf-fast-path.md # ADR-050: MutationObserver fast path qua requestAnimationFrame để tokenize ngay lập tức khi DOM xuất hiện
│   └── 051-tokenize-frequency-very-low-band.md # ADR-051: Thêm very-low frequency band để 100% token có frequency data được parse và hiển thị
├── ideas/                             # Refined idea one-pagers (idea-refine skill output)
│   ├── overlay-appearance-settings.md
│   ├── subtitle-panel-outside-video.md
│   ├── subtitle-text-selection.md
│   ├── sync-all-icon-buttons-to-ds.md
│   └── tokenize-on-media.md           # Simplified native tokenize on media
├── intent/                            # Output interview-me — "what user wants"
│   ├── intent-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load (target + native)
│   ├── intent-side-panel-subtitle.md  # Side Panel subtitle (thay thế inject-DOM panel)
│   ├── intent-side-panel-video-controls.md # Side Panel video controls (spacebar + hotkeys)
│   └── intent-subtitle-appearance-manager.md # Subtitle appearance manager (2 overlay độc lập + drag + realtime persist)
│   └── intent-subtitle-selector-multi-match.md # Subtitle selector khi ≥2 matches (V2 ADR-007 D3, giải quyết bug A)
│   └── idea-subtitle-manager-panel.md     # Subtitle Manager Panel (V2 ADR-014 — unified panel + import flow + active name + toast)
│   └── intent-subtitle-drag-integrated.md # Subtitle drag integrated (xóa icon riêng, drag trực tiếp overlay background)
│   └── intent-refactor-system-architecture.md # Refactor system architecture (G0 research 53 nguồn + 7 nguyên lý + architecture review 2026-07-01 findings + 8 findings scope)
│   └── intent-subtitle-navigation-control.md # Subtitle navigation control cluster (floating prev/repeat/next + seek 5s/10s + drag handle ⋯ + collapse half-circle, touch+mouse)
│   └── intent-settings-controls-restyle.md # Settings controls restyle (vỏ→ruột: Toggle/Slider/ShortcutInput/SubtitlePreview atoms, preserve behavior)
│   └── intent-settings-dialog-rearrange.md # Settings dialog rearrange (UI/UX: pair fields, fix Nav Cluster missing position, indent child, dividers)
│   └── intent-youtube-subtitle-detection.md # YouTube subtitle detection (proactive parse ytInitialPlayerResponse, include ASR, site adapter pattern, subtitle only)
│   └── intent-translate-subtitle-target-to-native.md # Translate subtitle target→native (Google unofficial, background prefill, real-time)
│   └── intent-port-theocean-dict-and-theme.md # Port theocean-dict reference: theme system (runtime configurable, thay DSDS) + import dict/freq 5 format → IndexedDB. Theme trước, dict sau.
│   └── intent-subtitle-block-unified.md # Gộp target + native + nav cluster thành 1 block, pill kéo trục Y, auto-scale theo video
│   ├── intent-card-creator.md # Card Creator — tạo + update Anki flashcard từ subtitle block (desktop + mobile)
│   └── intent-card-creator-ui-redesign.md # Card Creator UI redesign (preview block + Yomitan scan + media D&D/reorder)
│   ├── intent-web-text-dictionary-popup.md # Web-text dictionary popup (decouple from video + word highlight)
│   └── tokenize-on-media.md           # Simplified native tokenize on media (interview-me confirmed)
├── specs/                             # PRD chi tiết — "what to build"
│   ├── spec-subtitle-overlay.md       # Subtitle overlay PRD
│   ├── spec-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load PRD
│   ├── spec-side-panel-subtitle.md    # Side Panel subtitle PRD (thay thế inject-DOM panel)
│   ├── spec-side-panel-video-controls.md # Side Panel video controls PRD (spacebar + hotkeys + media clear)
│   ├── spec-subtitle-appearance-manager.md # Subtitle appearance manager PRD (2 overlay độc lập + drag + realtime persist)
│   └── spec-subtitle-selector-multi-match.md # Subtitle selector khi ≥2 matches PRD (V2 ADR-007 D3 + bug A fix)
│   └── spec-subtitle-manager-panel.md    # Subtitle Manager Panel PRD (V2 ADR-014 — unified panel + import flow + active name + toast)
│   └── spec-subtitle-drag-integrated.md  # Subtitle drag integrated PRD (xóa icon riêng, drag trực tiếp overlay background)
│   └── spec-refactor-system-architecture.md # Refactor system architecture PRD (FSD + Screaming Architecture worktree cho Orca platform extensibility)
│   └── spec-refactor-architecture-debt.md # Refactor architecture debt PRD phase 2 (8 findings: C1-C3 + H1-H5 from architecture review 2026-07-01)
│   └── spec-subtitle-navigation-control.md # Subtitle navigation control cluster PRD (6-nút 2 cột + drag + collapse + no-sub adaptive + settings)
│   └── spec-settings-controls-restyle.md
│   └── spec-settings-dialog-rearrange.md # Settings dialog rearrange spec (pair/indent/divider, fix Nav Cluster position) # Settings controls restyle PRD (Toggle/Slider/ShortcutInput/SubtitlePreview atoms, preserve behavior)
│   └── spec-translate-subtitle-target-to-native.md # Translate subtitle target→native PRD (background prefill, Google unofficial, ShortcutInput combo, general mọi site)
│   └── spec-generate-native-subtitle.md # Generate native bằng button/shortcut, feed overlay + overwrite active manager entry, in-memory đến SPA nav
│   └── spec-port-theocean-dict-and-theme.md # Port theocean-dict reference: theme system (runtime configurable, 9 core tokens, WCAG, import/export, system mode) + dict import 5 format → IndexedDB. Options page mới. Theme trước, dict sau.
│   └── spec-subtitle-block-unified.md # Unified subtitle block PRD: gộp target + native + nav cluster, auto-scale, settings rearrange
│   ├── spec-card-creator.md # Card Creator PRD: AnkiConnect integration, field mapping, media extraction, draft autosave, desktop Dialog + mobile BottomSheet
│   └── spec-card-creator-ui-redesign.md # Card Creator UI redesign PRD: preview block + Yomitan scan + media D&D/reorder
│   └── spec-iqiyi-subtitle-detection.md # iQIYI subtitle detection PRD: MAIN-world playerObject.stl extraction, SRT format, lid→ISO map, clone ADR-020 pattern, source dispatch trên DETECTED_SUBTITLES
│   └── blueprint-cell-learning-platform.md # Blueprint for learning platform
│   └── spec-shared-ui-components.md # Shared UI component library (Button/Card/Dialog/Input + atoms/molecules + migration of existing feature UI)
│   └── spec-icon-library.md # SVG icon library (Lucide reference catalog, 1995 icons, ISC license, docs-only not bundled)
│   └── design/dictionary-popup-prototype-handoff.md # Interactive dictionary popup prototype handoff (English/Chinese, tabs, media, card creator, design-system constraints)
│   └── design/popup-dictionary-tab-ui-design.md # Popup Dictionary tab UI design variants: audio, image, translate, links (selected variants + CSS)
│   └── design/popup-dictionary-ux-improvements.md # Popup Dictionary UX improvement spec: Socratic audit, selected improvements, implementation notes
│   ├── web-text-dictionary-popup.md   # Web-text dictionary popup PRD (decouple from video + word highlight)
│   └── spec-tokenize-on-media.md      # Tokenize on media PRD (text page + subtitle, VDLT hybrid, 1GB RAM)
├── plan/                              # Feasibility & scope (G1) — "should we build it"
│   ├── chrome-extension-video-downloader.md
│   ├── parallel-hls-conversion-scaling.md
│   ├── subtitle-sidebar-shortcuts.md  # Subtitle floating panel + shortcuts
│   ├── plan-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load — feasibility (G1)
│   ├── plan-side-panel-subtitle.md    # Side Panel subtitle — feasibility + task breakdown
│   ├── plan-side-panel-video-controls.md # Side Panel video controls — feasibility (G1)
│   └── plan-subtitle-appearance-manager.md # Subtitle appearance manager — implementation plan (G2)
│   └── plan-subtitle-drag-integrated.md  # Subtitle drag integrated — implementation plan (G2)
│   └── plan-subtitle-selector-multi-match.md # Subtitle selector ≥2 matches — implementation plan (G2, V2 ADR-007 D3)
│   └── plan-refactor-system-architecture.md # Refactor system architecture — implementation plan (G2, 14 milestone + dependency graph + checkpoint A-E)
│   └── plan-refactor-architecture-debt.md # Refactor architecture debt — implementation plan phase 2 (G2, 8 milestones M14-M21, cite spec-refactor-architecture-debt)
│   └── plan-subtitle-navigation-control.md # Subtitle navigation control cluster — implementation plan (G2, 10 AD, 6 milestones, cue source divergence + settings schema v2)
│   └── plan-settings-controls-restyle.md
│   └── plan-settings-dialog-rearrange.md # Settings dialog rearrange plan (5 milestones M1-M5, CSS-first) # Settings controls restyle — implementation plan (G2, 10 milestones M1-M10, bottom-up atoms→integrate, cite spec-settings-controls-restyle)
│   └── plan-subtitle-time-offset.md # Subtitle time offset — implementation plan (G2, 6 AD, 7 milestones M1-M7, lazy/committed offset)
│   └── plan-youtube-subtitle-detection.md # YouTube subtitle detection — implementation plan (G2, 6 AD, 7 milestones M1-M7, Two Detection Paths, cite spec-youtube-subtitle-detection)
│   ├── plan-translate-subtitle-target-to-native.md # Translate subtitle target→native plan (G2, 6 milestones M1-M6, background prefill, cite spec)
│   └── plan-card-creator-ui-redesign.md # Card Creator UI redesign plan (M1-M9, preview → media → D&D → mobile)
│   └── plan-port-theocean-dict-and-theme.md # Port theocean-dict + theme plan (G2, 12 milestones M1-M12, theme trước F1-F6 → dict sau F7-F12, options page mới, cite spec)
│   └── plan-align-src-to-ds.md # Align src components to DS showcase — implementation plan (6 phase, 21 task, token+component song song)
├── task/                              # Task list (G4 đầu) — "how to build, step by step"
│   ├── task-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load — task list (G4)
│   ├── task-netflix-subtitle-detection.md # Netflix subtitle detection — dependency-aware task list (G4, parallel branches + sequential gates)
│   ├── task-side-panel-video-controls.md # Side Panel video controls — task list (G4)
│   ├── task-subtitle-appearance-manager.md # Subtitle appearance manager — task list (G4)
│   └── task-subtitle-selector-multi-match.md # Subtitle selector ≥2 matches — task list (G4, V2 ADR-007 D3)
│   └── task-refactor-system-architecture.md # Refactor system architecture — task breakdown (G4, M0-M13, 25 task, codebase reality check)
│   └── task-subtitle-navigation-control.md # Subtitle navigation control cluster — task breakdown (G4, 11 tasks M1-M6, TDD, vertical slices)
│   └── task-port-theocean-dict-and-theme.md # Port theocean-dict + theme — task breakdown (G4, 30 tasks M1-M12, theme trước F1-F6 → dict sau F7-F12, TDD + browser MCP stop-the-line)
│   ├── task-shared-ui-components.md # Shared UI component library — task breakdown (Phase 1-5: atoms, molecules, organisms, migration, audit)
│   └── task-card-creator-ui-redesign.md # Card Creator UI redesign task list (M1-M9, T1.1-T9.3)
│   ├── task9-browser-verify-report.md # Task 9 browser MCP verify report (Tasks 2,6,7,8)
│   └── 2026-06-29-subtitle-appearance-manager-mcp.md # ADR-013 browser MCP verify report (A1-A16)
│   └── task-align-src-to-ds.md # Align src components to DS showcase — task list (6 phase, 21 task)
├── knowledge/                         # Nguyên lý khái niệm hóa + chi tiết kỹ thuật bug fix — "lessons learned"
│   ├── principles.md                              # Principle index (abstract, layer 1)
│   ├── architecture-auto-select.md              # Auto-Select & Auto-Download architecture
│   ├── aspect-ratio-cross-size-preservation.md    # Preserve cross-axis size when aspect-ratio conflicts
│   ├── auto-download-subtitle-catchup.md          # Auto-download subtitle catch-up
│   ├── edge-app-window-leak.md                    # Edge app-window leak
│   ├── flex-min-width-auto-overflow.md            # Flex min-width: auto overflow
│   ├── fullscreen-target-shared-container.md      # Fullscreen target shared container
│   ├── inline-style-leak-toggle-cycle.md          # Inline style leak across toggle cycles
│   ├── measure-after-clearing-transition-styles.md # Measure after clearing transition styles
│   ├── out-of-flow-wrapper-collapse.md            # Out-of-flow wrapper collapse
│   ├── panel-body-mode-max-height.md              # Panel body mode max-height
│   ├── parallel-fmp4-merge.md                     # Parallel fMP4 merge (tfdt offset)
│   ├── state-dom-init-mismatch.md                 # State-DOM init mismatch
│   ├── subtitle-filename-matches-video.md         # Subtitle filename matches video
│   ├── subtitle-language-detection.md             # Subtitle language detection (hybrid)
│   ├── tab-scoping-popup-leak.md                  # Tab-Scoping (popup media leak)
│   ├── media-accumulation-navigation.md           # Media accumulation across navigation (clear on onTabUpdated)
│   ├── spa-two-phase-render-wipe.md               # SPA two-phase render wipe (Angular foreign element wipe)
│   ├── half-open-interval-cue-matching.md         # Half-open [start,end) for cue boundary matching
│   ├── instant-scroll-long-lists.md               # Instant scroll for long lists (motion sickness)
│   ├── sidepanel-active-tab-race.md               # Sidepanel stuck on "No subtitles loaded" after tab switch (activeTabIdForPanel race)
│   ├── srt-parser-none-literal-index.md           # kisskh SRT "None" literal cue index → parser skip noise lines
│   ├── url-lang-multi-separator-extraction.md     # kisskh kebab-case URL lang → multi-separator + domain guard
│   ├── url-first-spa-nav-stale-player-response.md # URL-first videoId — ytInitialPlayerResponse stale on SPA nav radio mix
│   ├── clear-subtitle-on-no-subtitle-video.md     # Clear previous video subtitles when new video has none (3-layer dead path)
│   ├── proactive-native-event-clear-vs-round-trip.md # Content-script proactive clear on yt-navigate-finish vs background round-trip
│   ├── drag-drop-stop-propagation-blocks-outer.md # MediaList inner stopPropagation blocks outer file-drop handler
│   ├── dropdown-menu-width-follows-content.md     # Select menu width locked to trigger clips long options + tràn card
│   ├── persist-config-clear-content.md            # Card Creator autosave: persist selections + tags, clear field content on close
│   ├── language-unique-signature-words.md         # Unique signature words cho 27 ngôn ngữ Latin (improve frequency detection accuracy)
│   └── skill-output-routing.md                    # Skill output routing (filled artifacts → project docs/, not skill dir)
├── test-reports/                      # MCP browser test reports — "does it work in real browser"
│   ├── 2026-06-26-subtitle-sidebar-shortcuts-mcp.md
│   ├── 2026-06-27-subtitle-panel-docking-mcp.md
│   ├── 2026-06-27-subtitle-panel-fullscreen-mcp.md
│   ├── 2026-06-30-subtitle-drag-integrated-mcp.md  # ADR-015 drag integrated verify (9/9 SC pass)
│   └── screenshot-after-fix.png
├── reviews/                           # Architecture review + spec review + design-system audit reports
│   ├── architecture-review-2026-07-01.md # Architecture review (chrome-extension-mv3-architecture-review skill, 17/42 failures, 3 Critical + 5 High)
│   ├── design-system-inventory-2026-07-02.md # Design-system UI/UX audit (design-system-ui-ux skill Step 1, 12 inconsist, file:line cited)
│   ├── design-system-drift-audit-2026-07-02.md # Post-fix drift audit (6 axes pass, browser-verified)
│   └── review-subtitle-drag-integrated.md # Spec review: subtitle drag integrated (APPROVED post-update)
│   └── review-refactor-system-architecture.md # Spec review: refactor system architecture (APPROVED, Opus 4.8, 1 CRITICAL + 2 HIGH fixed)
│   └── review-subtitle-navigation-control.md # Spec review: subtitle navigation control cluster (BLOCKED Kimi 2.7 → patched → APPROVED Opus 4.8, 9 risks resolved, 1 LOW non-blocking)
│   └── design-system-inventory-2026-07-02-nav-cluster.md # Design system inventory nav cluster (G3: 0 inconsist baseline, 10 new tokens, NavClusterButton atom, 3-layer enforcement)
│   └── nav-cluster-frontend-design.md # Frontend UI engineering nav cluster (G3 build HOW: DOM tree, state machines, ARIA toolbar, responsive touch target, perf, anti-AI-aesthetic)
│   └── review-youtube-subtitle-detection.md # Spec review: YouTube subtitle detection (APPROVED_WITH_CONDITIONS → revised → APPROVED, Opus 4.8, 3 CRITICAL + 4 HIGH resolved)
├── (design-system/ đã xóa — codebase là nguồn duy nhất: src/shared/styles/tokens.json + src/shared/ui/)
├── mockups/                           # HTML mockups (design-driven-development output, G0.5)
│   ├── subtitle-selector-mockup.html  # Subtitle selector mockup v4 (ADR-014 enhancement)
│   ├── mockup-settings-grouped.html   # Settings dialog grouped layout v1 (sidebar + cards)
│   ├── mockup-settings-searchable-and-hint.html # Settings SearchableSelect + HintIcon atoms mockup
│   ├── mockup-settings-rearrange.html # Settings dialog rearrange v2 (pair/indent/divider, fix Nav Cluster position)
│   ├── mockup-subtitle-block-unified.html # Unified subtitle block mockup: target + native + nav cluster gộp thành 1 block, pill kéo trục Y
│   ├── anki-card-mockup.html          # Card Creator mockup v2 (preview block + Yomitan scan + media D&D/reorder)
│   ├── tokenize-on-media-prototype.html # Floating badge manager prototype: Shadow DOM, design-system tokens + icons, 7 IA groups, full Settings mock data, host-page tokenization (inline-block token + status float absolute không nhảy dòng, status underline 2px, không viền outline hover/active, không hiển thị IPA trên token, frequency bg+text; known/ignore ẩn phân tích), desktop shortcuts 1/2/3/4 + multi-select, draggable FAB, desktop anchored dialog with FAB collapse button, văn bản dài multi-line test, responsive + focus trap + host-CSS isolation, verified edge-devtools
│   └── popup-dictionary/              # Modular interactive prototype (index.html + tokens/base/popup/creator.css + fixtures/icons/dropdown/popup/creator/app.js; Gate 2 contract: docs/specs/design/UI-UX-Contract-popup-dictionary.md; 4-icon toolbar single-select + 5-status + edit-mode config; verified edge-devtools)
├── intent/
│   └── intent-card-creator.md         # Card Creator intent (interview-me output, confirmed)
├── specs/
│   └── spec-card-creator.md           # Card Creator spec (PRD) — AnkiConnect + dialog + media extraction
├── reference/                         # Hướng dẫn dùng tools + research synthesis — "how to use / background"
│   ├── chrome-devtools-mcp.md
│   ├── e2e-debugging.md
│   ├── architecture-research-synthesis.md # Architecture research synthesis
│   ├── software-production-process-research.md # Software production process research
│   └── software-org-roles.md          # Software organization roles
│   └── youtube-subtitle-format-research.md # YouTube subtitle format research (timedtext API, captionTracks structure, fmt=vtt/json3, PO Token, InnerTube fallback)
├── shortcut-for-tw/                   # Cheatsheet terminal workflow (Windows Terminal + tmux-windows + Git Bash + devin CLI)
│   └── cheatsheet.md                  # Phím tắt WT + tmux + workflow "giao việc cho devin" (Win+Shift+Q, Ctrl+b prefix, swap/resize pane, detach/attach session)
└── reading-summaries/                 # Reading summaries

src/            # Source code (chi tiết trong 2-architechture-system.md)
tests/          # Test files (chi tiết trong 2-architechture-system.md)
.agents/        # Agent skills
  skills/         # 24 skill addyosmani/agent-skills (Define→Plan→Build→Verify→Review→Ship)
                 # browser-testing-with-devtools/SKILL.md: có "Reliable install workflow on Devin CLI"
                 #   (copy dist/ → %TEMP%\cell-ext-dist trước khi install_extension,
                 #    vì Devin MCP client negotiate roots nhưng không gửi workspace D:\...\cell)
  skills-deprecated/  # 4 skill cũ đã deprecate (chrome-extension-mv3-architecture-review, conceptualization, mockup-first, skill-creator)
.devin/        # Devin config (hooks.v1.json; agents/ đã xóa — thay bằng .agents/skills/)
.windsurf/      # Windsurf config (rules consolidated vào AGENTS.md — cross-tool source of truth)
```

## Cách dùng tổng quan

| Khi nào | Đọc gì | Để biết |
|---|---|---|
| Đầu session | 0-wiki.md | Dự án có gì, docs nào tồn tại |
| Trước khi sửa code | 2-architechture-system.md | Cấu trúc src/, dependency map, function index |
| Khi hiểu sai intent | 1-share-language.md | Glossary human ↔ system language (2 chiều + Update protocol) |
| Đầu feature | docs/intent/<feature>.md | Output interview-me — what user wants |
| Trước khi plan | docs/specs/<feature>.md | PRD chi tiết — what to build |
| Mỗi task | docs/plan/<feature>.md | Task list — how to build |
| Trước khi viết function mới | grep docs/knowledge/ | Nguyên lý đã học, tránh tái phạm |
| Khi gặp tool mới | docs/reference/<tool>.md | Hướng dẫn dùng tool |
| Khi thay đổi kiến trúc | docs/adr/<decision>.md | Tại sao chọn kiến trúc này |
| Sau khi implement | docs/test-reports/<feature>-mcp.md | MCP browser test — bugs phát hiện trong real Chrome |

## File quan trọng (always-load)

| File | Bản chất | Khi nào load |
|---|---|---|
| AGENTS.md | Cross-tool rules + skill hierarchy (baseline + ponytail consolidated) | Mỗi session (Windsurf + Devin) |
| 0-wiki.md | Mục lục tổng quan | Đầu session |
| 1-share-language.md | Glossary human ↔ system | Đầu session |
| 2-architechture-system.md | Architecture chi tiết | Trước khi sửa code |

## Update protocol

- Thêm/xóa file docs/ → update 0-wiki.md (mục lục)
- Thêm/xóa/sửa file src/ → update 2-architechture-system.md (cây thư mục + dependency + function index)
- Thay đổi kiến trúc → thêm ADR vào docs/adr/
- Đúc rút nguyên lý → thêm vào docs/knowledge/<principle>.md
- Fix bug → ghi bug log + nguyên lý vào docs/knowledge/<principle>.md
- Sinh/rename/xóa system term (tên file, toggle, message type, store key) → update 1-share-language.md (xem Update protocol cuối file đó)
