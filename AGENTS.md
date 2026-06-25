# Project Knowledge

## Auto-download subtitle catch-up (incremental media detection)

### Problem
Auto-download downloaded the video but NOT subtitles. Root cause: `NetworkInterceptor.onMediaDetected` fires incrementally — the m3u8 is captured first, subtitles arrive later. The first fire (video only) ran `tryAutoDownload`, enqueued the video, and set a per-tab URL guard (`autoDownloadedTabs: Map<tabId, url>`). When subtitles arrived in the second fire, `maybeAutoDownload` saw the guard matched the URL and returned early, so subtitles were never enqueued.

### Fix
- `tryAutoDownload` now takes an optional `alreadyEnqueuedIds: ReadonlySet<string>` and returns `Promise<string[]>` (the media ids it enqueued this call; empty = silent no-op). Selected media whose id is in the set is skipped, so a follow-up call enqueues only newly discovered subtitles without re-downloading the video.
- `BackgroundService.autoDownloadedTabs` changed from `Map<tabId, url>` to `Map<tabId, { url, enqueuedIds: Set<string> }>`.
- `maybeAutoDownload` two branches:
  1. **Same page load** (state.url === tabUrl): call `tryAutoDownload` with `state.enqueuedIds`, add returned ids to the set (subtitle catch-up).
  2. **Fresh page load** (no state or URL changed): call `tryAutoDownload` fresh, store `{ url, enqueuedIds: new Set(newIds) }`.
- Guard is still cleared on `tabs.onUpdated` loading and `tabs.onRemoved`, so navigation to a different episode under the same whitelisted category still auto-downloads fresh.

### Key insight
The URL guard was too coarse — it prevented ALL re-runs for the same page, including the legitimate subtitle catch-up. The fix separates "don't re-download the video" (id-level dedup) from "allow new subtitles to be caught up" (re-run with skip set). `selectBestMedia` is pure and cheap, so re-running it each incremental fire and diffing against enqueued ids is safe.

## Tab-Scoping (learned while fixing popup media leak)

### Problem
Popup opened for tab A showed media from background tab B. Root cause: `handleGetDetectedMedia` and `handleDownloadAll` fell back to all-tab media when the active tab was empty, and `DETECTED_MEDIA_UPDATE` broadcasts were not tab-scoped.

### Fix
- `DetectedMediaUpdatePayload` now carries a required `tabId: number`.
- `handleGetDetectedMedia` returns empty when the requested tab has no media — NO all-tab fallback.
- `handleDownloadAll` returns `{ success: false, error: 'No media found for this tab' }` when the tab is empty — NO all-tab fallback.
- `useDetectedMedia` hook resolves the active content tab on mount via `getActiveContentTab()` (see "Edge app-window leak" below), stores `tabId` in a ref, sends `GET_DETECTED_MEDIA { tabId }`, and filters `DETECTED_MEDIA_UPDATE` broadcasts by `payload.tabId === tabIdRef.current`.
- `NetworkInterceptor` capture stays global (correct — per-tab storage already works). Only the message-passing + popup layer needed scoping.

### Key insight
Chrome MV3 `chrome.runtime.sendMessage` cannot target a specific tab — broadcasts fan out to every listener. Since only one popup is active at a time, the popup filters by `tabId` in the payload rather than the background trying to target a tab.

## Edge app-window leak (popup renders empty on Edge)

### Problem
On Edge, the Media + Downloads sections rendered completely empty (no console error). On Chrome the same extension + same page worked fine. Root cause: Edge ships built-in app-windows (e.g. the dictionary sidebar at `chrome-extension://<id>/pages/app-window/index.html#/app/dictionary`) that are themselves `active: true` and live in their own window. The popup hooks previously used `chrome.tabs.query({ active: true, currentWindow: false })` then `tabs[0]?.id` to grab "the active tab in a browser window, not the popup window". On Edge that query returns the app-window tab (a `chrome-extension://` URL), not the content tab. The background then looked up media/downloads for the extension tab id, found nothing, and the popup rendered empty with no error. The `lastFocusedWindow: true` fallback returned `null` on Edge, so it did not save the case.

### Fix
- New helper `src/popup/utils/getActiveContentTab.ts` exports `getActiveContentTab()` and `getActiveContentTabId()`. It runs 3 `chrome.tabs.query` shapes IN PARALLEL via `Promise.all` (currentWindow:true, lastFocusedWindow:true, `{}` all tabs), merges candidates in priority order, and picks the first one whose URL is NOT a `chrome-extension://` page. A tab with no URL (loading / restricted / mocked) is still accepted — chrome-extension tabs always carry a `chrome-extension://` URL, so a missing URL never masks one.
- `useDetectedMedia`, `useDownloadProgress`, and the auto-download whitelist check in `App.redesigned.tsx` all now use this helper instead of inline `currentWindow: false` + `tabs[0]?.id` logic. The inline `getActiveContentTab` previously duplicated in `App.redesigned.tsx` was removed in favor of the shared helper (DRY).

### Key insight
`chrome.tabs.query({ active: true, currentWindow: false })` is a fragile trick for "active tab in a browser window, not the popup window". It assumes the only other active tab is the content tab. Edge's app-windows break that assumption. The robust pattern is: gather candidates from several query shapes, then filter out `chrome-extension://` URLs explicitly. This works on both Chrome (no app-window interference) and Edge. Tests that flush microtasks need ~2 extra `await Promise.resolve()` because `Promise.all` over 3 queries adds overhead vs the old 2-sequential-await path.

### Pre-existing e2e issues (fixed)
- `redesigned-popup.spec.ts` and `m3u8-local.spec.ts` previously failed with strict mode violation: `[data-testid="empty-media"]` resolved to 2 elements (media-section + downloads-section share the same testid). Fixed by scoping the locator: `[data-testid="media-section"] [data-testid="empty-media"]`.

## Commands
```
Build:            npm run build
Typecheck:        npm run typecheck
Test (all):       npm test                  # unit + integration (~29s)
Test unit only:   npm run test:unit         # ~3s, day-to-day (alias: test:fast)
Test integration: npm run test:integration  # real m3u8 download + transmux
Test watch:       npm run test:watch        # unit only (watching integration is slow)
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

Note: `npm test -- --testPathPattern=` is deprecated in jest 30; use `--testPathPatterns=`.

## Jest projects (unit + integration split)

`jest.config.ts` uses `projects` to separate fast unit tests from slow network integration tests:
- **unit** project: `tests/unit/**`, `tests/components/**`, `tests/utils/**`, `src/**` — `*.test.ts(x)`. ~3s, no network.
- **integration** project: `tests/integration/**` — `*.integration.test.ts` only. Uses `globalSetup` (`tests/integration/setup/globalSetup.ts`) to download the m3u8 playlist + first 12 TS segments ONCE via curl.exe and cache them to `tests/integration/.cache/` (gitignored). The 3 split test files (sequential, parallel, compare) read from disk instead of each re-downloading, and run in 3 parallel jest workers.

Run a single project: `npm run test:unit` / `npm run test:integration`, or `npx jest --selectProjects unit`.
Force re-download of segments: `FORCE_DOWNLOAD=1 npm run test:integration` (PowerShell: `$env:FORCE_DOWNLOAD=1; npm run test:integration`).

## Auto-Select & Auto-Download Feature

### Architecture
- **Auto Download** (Header AD toggle): whitelists the current URL's **first pathname segment** (origin + first path segment) via `src/lib/utils/whitelist.ts`. Query strings, hash fragments, and the rest of the path are stripped. This means enabling AD for one episode of a show (e.g. `https://kisskh.co/Drama/.../Episode-1`) whitelists the whole category (`https://kisskh.co/Drama`), so navigating to `Episode-2` under the same category automatically triggers a download. Different domains (e.g. `https://anime.uniquestream.net/...`) never share a whitelist entry. Two trigger paths:
  1. **Toggle ON in popup** (`handleToggleAutoDownload` in `App.redesigned.tsx`): immediately runs `selectBestMedia` against currently detected media and triggers download of the best video + matching subtitles for the current tab — in addition to whitelisting for future revisits. AD implies auto-select for download, so this runs regardless of `autoSelectEnabled`.
  2. **Revisit whitelisted page**: `tryAutoDownload` in `src/background/autoDownload.ts` is triggered from `NetworkInterceptor.onMediaDetected` (NOT `tabs.onUpdated` complete — that fires before network interception captures m3u8/subtitle requests, so media is always empty there). A per-tab guard map (`autoDownloadedTabs` on `BackgroundService`) prevents duplicate downloads when `onMediaDetected` fires multiple times incrementally for the same exact page (m3u8 → subtitles → enriched variants). The guard stores the exact tab URL, so navigating to a different episode under the same whitelisted category still auto-downloads. The guard is cleared on `tabs.onUpdated` loading and `tabs.onRemoved`.
- `tryAutoDownload` returns `boolean` (true if items enqueued) so the caller knows whether to mark the tab as auto-downloaded.
- **Auto Select** (Settings AS toggle): when `settings.autoSelectEnabled` is ON, popup auto-checks best media via `selectBestMedia` on open. User still clicks Download manually.
- **selectBestMedia** (`src/lib/selectors/selectBestMedia.ts`): pure function. Fallback order: Preferred Format → Default Quality → Subtitle availability. Returns `AutoSelectResult | null`.
- **MultiSelect** (`src/popup/components/settings/MultiSelect.tsx`): reusable component with search + checkbox list. Used for subtitle language selection (replaces single dropdown).

### Settings migration
- `defaultSubtitleLanguage: string` → `selectedSubtitleLanguages: string[]` (multi-select). Migration in `popupStore.loadPersistedSettings`.
- New fields: `preferredVideoFormat: 'mp4' | 'm3u8'` (default 'm3u8'), `autoSelectEnabled: boolean` (default false).
- `STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST` stores `WhitelistEntry[]` in `chrome.storage.local`.

### Learned: integration.test.ts describe block merge
- The file had duplicate `describe('OffscreenManager')` blocks with a premature `});` closing the first one. Merged into single `describe('Background integration')` block. OffscreenManager tests now use `let manager: OffscreenManager` initialized per-test (no separate beforeEach) since they share the outer describe's mock setup.
- Mock Chrome needed `storage.session` added (BackgroundService uses `chrome.storage.session` for session media/downloads).

### Learned: Auto Download tab detection in popup
- `chrome.tabs.query({ active: true, currentWindow: true })` in a real Chrome popup returns the active content tab (the popup itself is not a tab). In Playwright E2E tests that open the popup URL as a regular tab, the active tab is the popup's chrome-extension URL, so the code must fall back through `lastFocusedWindow` and ultimately scan all tabs, ignoring any `chrome-extension://` URLs.
- Implemented `getActiveContentTab()` in `App.redesigned.tsx` that queries `currentWindow` → `lastFocusedWindow` → all active tabs → all tabs, and picks the first non-extension URL.

### Learned: MultiSelect footer + E2E click
- The MultiSelect component originally rendered `<li>` rows with a checkmark SVG and no footer. The E2E test expected checkbox inputs and a "Selected: ..." footer, so both were added:
  - Footer: `selectedSummary` derived from selected values + option labels; rendered as `data-testid="{testId}-footer"`.
  - E2E: click the `<li>` option row directly (the component toggles on `li` click); no checkbox input exists.

E2E Debugging guide moved to [docs/reference-knowledge_base.md](docs/reference-knowledge_base.md).

---

## Skill Orchestration

### Always-on Skills
- `.windsurf/rules/baseline.md` — Chrome extension specific rules (UI/UX, knowledge base, architecture map, TDD, code review, source-driven)
- `.windsurf/rules/ponytail.md` — Lazy senior dev ladder (YAGNI, reuse, stdlib first, minimal diff) with TDD override for this project
- `/context-engineering` — Activated when context window reaches 80% capacity

### Skill Hierarchy by Phase

#### Phase 1: Requirement Clarification
1. **interview-me** — When request is underspecified, user invokes, or when agent silently fills in ambiguous requirements
   - Extract what user actually wants instead of what they think they should want
   - One-question-at-a-time until ~95% confidence about underlying intent

#### Phase 2: Specification
1. **spec-driven-development** — When starting new project/feature and no spec exists
   - Write PRD before code
   - Requirements unclear, ambiguous, or only exist as vague idea

#### Phase 3: Planning
1. **planning-and-task-breakdown** — When spec/clear requirements exist
   - Break work into ordered, implementable tasks
   - When task feels too large, need to estimate scope, or parallel work possible

#### Phase 4: Architecture
1. **system-architecture-design** — When starting new project, designing major feature, evaluating architecture trade-offs
   - Design architecture from requirements to implementation
   - Technology selection, architecture governance
2. **cto-persona** — When making tech strategy decisions, evaluating build-vs-buy, prioritizing technical debt
   - Architecture oversight, aligning with business goals

#### Phase 5: Implementation
1. **incremental-implementation** — When implementing feature/change touching >1 file
   - Deliver changes incrementally
   - When about to write large amount of code at once
2. **source-driven-development** — When writing framework-specific code (Chrome extensions, React, etc.)
   - Ground every implementation decision in official documentation
   - Cite sources with full URLs
3. **frontend-ui-engineering** — When building/modifying user-facing interfaces
   - Production-quality UIs, components, layouts, state management
4. **doubt-driven-development** — When correctness matters more than speed, unfamiliar code, high stakes
   - Subject every non-trivial decision to adversarial review before it stands
5. **ponytail.md** (always-on) — Enforces ladder: YAGNI → reuse → stdlib → native → installed dep → one-liner → minimal

#### Phase 6: Testing
1. **test-driven-development** — When implementing logic, fixing bugs, changing behavior
   - RED → GREEN → REFACTOR
   - Prove-It Pattern for bug fixes
   - **REFACTOR phase rule**: Conscious decision, not automatic. After GREEN, ask "Anything to improve without changing behavior?" If no → skip, commit, move on. Use **5-axis review from `code-review-and-quality` skill** (correctness, readability, architecture, security, performance) — do NOT invent your own checklist. Ponytail: REFACTOR removes problems, never adds abstractions. Mark deliberate simplifications with `// ponytail:` comments.
2. **browser-testing-with-devtools** — When building/debugging browser-related code
   - Test in real browsers via Chrome DevTools MCP
   - Inspect DOM, capture console errors, analyze network requests

#### Phase 7: Review
1. **code-review-and-quality** — Before merging any change
   - Review across 5 axes: correctness, readability, architecture, security, performance
2. **doubt-driven-development** (re-use) — Adversarial review for correctness-critical changes

#### Phase 8: Git
1. **git-workflow-and-versioning** — When making any code change
   - Structure git workflow practices (commit, branch, resolve conflicts)

#### Phase 9: Security
1. **security-and-hardening** — When handling user input, auth, data storage, external integrations
   - Harden code against vulnerabilities
   - Input validation, session management, third-party services

#### Phase 10: Performance
1. **performance-optimization** — When performance requirements exist, suspect regressions
   - Optimize application performance
   - Profile bottlenecks, fix N+1 queries, unbounded loops

#### Phase 11: Documentation
1. **documentation-and-adrs** — When making architectural decisions, changing public APIs, shipping features
   - Record decisions and documentation
   - Context for future engineers and agents

#### Phase 12: Deployment
1. **shipping-and-launch** — When preparing production deployment
   - Pre-launch checklist, monitoring, staged rollout, rollback strategy
2. **ci-cd-and-automation** — When setting up/modifying build/deployment pipelines
   - Automate quality gates, test runners, deployment strategies

#### Phase 13: Monitoring
1. **observability-and-instrumentation** — When shipping production features or production issues reported
   - Add logging, metrics, tracing, alerting
   - Evidence that feature works

#### Phase 14: Debugging
1. **debugging-and-error-recovery** — When tests fail, builds break, behavior doesn't match expectations
   - Systematic root-cause debugging

#### Phase 15: Refactoring
1. **code-simplification** — When refactoring code for clarity without changing behavior
   - Simplify code that is harder to read/maintain/extend than it should be

#### Phase 16: Deprecation
1. **deprecation-and-migration** — When removing old systems/APIs/features
   - Manage deprecation and migration

#### Phase 17: Ideation
1. **idea-refine** — When idea is vague, need to stress-test assumptions
   - Refine raw ideas into sharp, actionable concepts

#### Phase 18: Meta
1. **using-agent-skills** — Discover and invoke agent skills
2. **devin-for-terminal** — Devin CLI documentation lookup
3. **context-engineering** — Optimize agent context setup
4. **api-and-interface-design** — Design stable APIs and module boundaries

### Skill Synergies (Strongest Combos for This Project)

**TDD + Minimalism + Code Review**
- `test-driven-development` + `ponytail.md` + `code-review-and-quality`
- Ponytail enforces minimal code, TDD ensures minimal is correct, code-review ensures minimal is quality
- Ponytail's "trivial one-liner no test" is overridden by baseline's TDD for this project
- **REFACTOR phase uses 5-axis review from `code-review-and-quality` skill** (not invented checklist): correctness, readability, architecture, security, performance.

**Chrome Extension Safety**
- `baseline.md` + `source-driven-development` + `browser-testing-with-devtools`
- Baseline requires Chrome API citation, source-driven fetches official docs, devtools verifies live

**Architecture + Incremental**
- `system-architecture-design` + `incremental-implementation` + `planning-and-task-breakdown`
- Design first, break down tasks, implement incrementally → prevents over-build

**Correctness + Doubt**
- `doubt-driven-development` + `test-driven-development` + `browser-testing-with-devtools`
- M3u8 parse, fMP4 merge are non-trivial → doubt-driven reviews decisions, TDD proves behavior, devtools verifies runtime

**Performance + Measurement**
- `performance-optimization` + `observability-and-instrumentation`
- No measurement → no knowledge of slowness → observability adds metrics, performance skill optimizes

**Security + Validation**
- `security-and-hardening` + `doubt-driven-development`
- Security critical → doubt-driven reviews security decisions, security skill implements hardening

### Architecture Sync Rule
When adding/removing/renaming files, changing imports, or modifying data flows:
1. Update `docs/architechture-system.md` before commit
2. Use "Update protocol" section at the bottom of that file for guidance
3. This is enforced by baseline.md Architecture Map rule

### Context Engineering Strategy
- Pro-active: compact context at start of new task, not reactive at 80%
- Strategy: only load relevant files for current task (grep/glob first, not entire src/)
- Activate `/context-engineering` with `proactive` mode for this project

### Communication
- always call me "Anh yêu", xưng là "em"
- always activate `/context-engineering` if context window reaches 80% capacity

### Git Commit Rules (from `git-workflow-and-versioning` skill)
- **Atomic commits**: each commit does one logical thing
- **Separate refactoring from feature work**: refactor commit ≠ feature commit (2 separate commits)
- **Commit message format**: `<type>: <description>` — types: feat, fix, refactor, test, docs, chore
- **Body explains why, not what**
- **Pre-commit hygiene**: check staged diff, no secrets, run tests + lint + typecheck
- **Change Summaries after modification**:
  ```
  CHANGES MADE:
  - file: what changed
  THINGS I DIDN'T TOUCH:
  - file: why not
  POTENTIAL CONCERNS:
  - concern
  ```


