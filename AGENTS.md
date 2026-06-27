# Project Knowledge

## Tech Stack
- **Runtime**: Chrome Extension MV3 (manifest v3)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Transmuxing**: mux.js 6 (TS → fMP4)
- **Testing**: Jest 30 (unit + integration), Playwright (E2E)
- **Linting**: ESLint 9 + Prettier 3
- **Platform**: Windows (PowerShell) — no bash heredoc, use temp file + `git commit -F`

## Commands
```
Build:            npm run build
Typecheck:        npm run typecheck
Test (all):       npm test                  # unit + integration (~29s)
Test unit only:   npm run test:unit         # ~3s, day-to-day (alias: test:fast)
Test integration: npm run test:integration  # real m3u8 download + transmux
Test watch:       npm run test:watch        # unit only
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

Note: `npm test -- --testPathPattern=` is deprecated in jest 30; use `--testPathPatterns=`.

## Jest Projects (unit + integration split)
- **unit**: `tests/unit/**`, `tests/components/**`, `tests/utils/**`, `src/**` — `*.test.ts(x)`. ~3s, no network.
- **integration**: `tests/integration/**` — `*.integration.test.ts`. Uses `globalSetup` to download m3u8 + TS segments ONCE, cache to `.cache/` (gitignored).
- Run single: `npm run test:unit` / `npm run test:integration`, or `npx jest --selectProjects unit`.

## Code Conventions
- Functional components with hooks (no class components)
- Named exports (no default exports)
- Colocate tests: `Button.tsx` → `Button.test.tsx`
- Pure functions for logic (testable, no side effects)
- TypeScript strict mode — no `any` without justification
- Chrome API calls cite official docs: https://developer.chrome.com/docs/extensions/reference/
- **Always pass `tabId` in message payloads** — Chrome MV3 `sendMessage` cannot target specific tabs, broadcasts fan out to every listener. Popup filters by `tabId` in payload.
- **`getActiveContentTab()` for active tab resolution** — use `src/popup/utils/getActiveContentTab.ts`, not inline `chrome.tabs.query`. Handles Edge app-windows by filtering `chrome-extension://` URLs.
- **Auto-download guard uses id-level dedup** — `autoDownloadedTabs: Map<tabId, { url, enqueuedIds: Set<string> }>`, not URL-level guard (URL guard too coarse, blocks subtitle catch-up).

## Boundaries
- Never commit `.env` files or secrets
- Never add dependencies without checking bundle size
- Never modify `manifest.json` without testing in real Chrome

## Chrome Extension Baseline
- UI/UX: when using `/frontend-ui-engineering`, apply `docs/reference-ui_ux_system.md`
- Knowledge base: read `docs/0-wiki.md` (overview) → `docs/1-share-language.md` (glossary) → `docs/2-architechture-system.md` (file structure + dependencies + impact radius) before touching code
- chrome-devtools MCP: refer to `docs/reference/chrome-devtools-mcp.md`
- Architecture map: update `docs/2-architechture-system.md` whenever adding/removing/renaming files, changing imports, or modifying data flows. Use the "Update protocol" section at the bottom of that file.

## Ponytail (lazy senior dev mode)
Lazy = efficient, not careless. The best code is the code never written. Before writing code, stop at the first rung that holds:
1. YAGNI — does this need to exist?
2. Reuse codebase — does it already exist here?
3. Stdlib — does the standard library do it?
4. Native platform — does a native feature cover it?
5. Installed dependency — does an installed dep solve it?
6. One line — can this be one line?
7. Only then: write the minimum code that works.

Ladder runs AFTER understanding the problem (read task + code, trace real flow). Bug fix = root cause, not symptom (grep every caller, fix shared function once). No unrequested abstractions, no new deps if avoidable, deletion over addition, boring over clever, fewest files possible. Shortest working diff wins, but only once you understand the problem. Mark intentional simplifications with `ponytail:` comment (name ceiling + upgrade path).

Not lazy about: understanding the problem, input validation at trust boundaries, error handling that prevents data loss, security, accessibility, hardware calibration, anything explicitly requested. Non-trivial logic leaves ONE runnable check (assert-based demo or one small test file). **Baseline TDD override**: when in doubt, write the test — baseline wins over ponytail "trivial no test".

## Todo Discipline
Khi task >3 bước hoặc touch code: `todo_write` checklist nhúng rules (read `docs/2-architechture-system.md` Bảng phụ thuộc trước sửa, ponytail PRE-FILTER grep caller, fix root cause shared function, update docs/2-architechture-system.md 3 chỗ + verify by ls, npm run test:unit + npx tsc --noEmit). Mỗi item = 1 rule được tuân thủ, làm xong → complete → biến mất. Không đặt reminder chung chung không có done criteria.

## Workflow & Skills
**Identify your phase (0-7) → invoke `software-production-workflow` skill for full process (file ops, verify steps, skill activation per phase).** Cross-cutting: `doubt-driven-development` (non-trivial decisions), `context-engineering` (context degradation), `using-agent-skills` (discover skills), `git-workflow-and-versioning` (every code change).

### Browser-facing code verification (stop-the-line)
Any change touching content-scripts, popup UI, DOM injection, or extension runtime behavior **must be verified in a real browser** (MCP `chrome-devtools`/`edge-devtools`, or Playwright) before committing. Unit tests and `tsc` are necessary but not sufficient for visual/runtime bugs. No commit until the browser-level check passes.

## File Placement Convention
knowledge → `docs/knowledge/`, specs → `docs/specs/`, intent → `docs/intent/`, plan → `docs/plan/`, reference → `docs/reference/`, adr → `docs/adr/`. KHÔNG lưu loose file ở docs/ root.

## Communication
- always call me "Anh yêu", xưng là "em"
