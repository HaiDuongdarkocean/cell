# MV3 Anti-Pattern Checklist

Run each item against the codebase. Record pass/fail + evidence (file:line).

## Lifecycle

- [ ] **L1 — God-file background SW**: `background/index.ts` (or equivalent) > 500 lines
- [ ] **L2 — Business logic in SW**: SW file contains domain logic (not just message routing + lifecycle hooks)
- [ ] **L3 — Persistent mutable state in SW**: global `let`/`var` in background that assumes SW stays alive (lost on idle eviction)
- [ ] **L4 — SW re-init not handled**: no `chrome.runtime.onStartup` / `onInstalled` restore logic for in-flight state
- [ ] **L5 — Long-running task in SW**: SW does fetch + transform synchronously (SW can be killed mid-task; should delegate to offscreen)

## Boundary

- [ ] **B1 — chrome.* scatter**: `chrome.*` calls outside entrypoints + adapter layer
- [ ] **B2 — Cross-feature import**: feature A imports feature B directly (not via shared barrel or app orchestration)
- [ ] **B3 — Deep import**: consumer imports internal file of a module, bypassing barrel `index.ts`
- [ ] **B4 — Layer violation**: lower layer (shared/entities) imports higher layer (features/app)
- [ ] **B5 — Circular dependency**: A → B → A (file or folder level)
- [ ] **B6 — No adapter for chrome.***: chrome.* called directly in features/entities (should go through adapter for testability)

## Message Passing

- [ ] **M1 — Untyped messages**: `chrome.runtime.sendMessage(any)` with no type contract (no union type, no MESSAGE_TYPES enum)
- [ ] **M2 — Missing tabId in payload**: messages broadcast without `tabId` — popup cannot filter (MV3 sendMessage broadcasts to all listeners)
- [ ] **M3 — No message handler registry**: giant `if/else` switch in background instead of typed handler map
- [ ] **M4 — Async response not awaited**: `sendResponse` called after `await` without `return true` from listener
- [ ] **M5 — Content script ↔ background tight coupling**: content script imports background types directly (should share via entities/)

## Storage

- [ ] **S1 — Magic string storage keys**: `chrome.storage.local.get('settings')` with inline string instead of central `STORAGE_KEYS` constant
- [ ] **S2 — Large data in chrome.storage**: storing > 5MB in `storage.local` (quota 10MB) or binary blobs (should use OPFS / IndexedDB)
- [ ] **S3 — No storage schema versioning**: settings shape changes with no migration path
- [ ] **S4 — session vs local confusion**: state that should be session-scoped (per-browser-session) stored in local (persists across restarts)
- [ ] **S5 — No storage onChanged listener**: UI does not react to storage changes from other contexts (popup vs sidepanel vs content)

## Content Script Injection

- [ ] **I1 — Unscoped content script**: `matches: ["<all_urls>"]` with no host filter or runtime check
- [ ] **I2 — Heavy logic in content script**: business logic (parsing, transformation) in content script instead of feature module
- [ ] **I3 — Content script imports entrypoint code**: content script imports from background/popup (tight coupling across contexts)
- [ ] **I4 — No world specification**: MAIN world vs ISOLATED world not specified when needed (DOM hooks need MAIN, chrome.* needs ISOLATED)
- [ ] **I5 — Multiple content scripts overlapping**: 2+ content scripts on same page without coordination

## Discoverability (AI + human)

- [ ] **D1 — Technical-prefix folders at root**: `lib/`, `utils/`, `helpers/`, `services/` at `src/` root (Screaming Architecture violation — should be domain-named)
- [ ] **D2 — No barrel exports**: modules without `index.ts` — consumers deep-import internal files
- [ ] **D3 — No architecture map doc**: missing `docs/2-architechture-system.md` or equivalent (file index + dependency + data flow)
- [ ] **D4 — Inconsistent naming**: mix of camelCase / kebab-case / PascalCase for folders/files
- [ ] **D5 — No glossary / share-language doc**: domain terms not defined (AI + new devs guess meaning)
- [ ] **D6 — God-folder**: single folder > 30 files (hard to navigate, low cohesion)

## Testability

- [ ] **T1 — chrome.* not mockable**: direct `chrome.*` calls in features/entities (cannot unit test without chrome global)
- [ ] **T2 — Test structure does not mirror src**: test folder organization does not match source structure (hard to find tests)
- [ ] **T3 — No characterization tests**: no tests pinning current behavior before refactor
- [ ] **T4 — Integration tests touch real chrome.***: integration tests require live extension (no mock layer)
- [ ] **T5 — No E2E for critical flows**: no Playwright/Puppeteer tests for popup → content → background round-trip

## Build / Config

- [ ] **C1 — Manifest paths hardcoded in multiple places**: entry paths in manifest + vite config + tests, no single source of truth
- [ ] **C2 — No type-safe manifest**: manifest.json not validated against schema (typos in entry paths fail at runtime)
- [ ] **C3 — Permissions over-granted**: permissions not used in code (security risk + store review friction)
- [ ] **C4 — web_accessible_resources too broad**: `matches: ["<all_urls>"]` for resources only needed on specific sites
- [ ] **C5 — CSP too permissive**: `unsafe-eval` or `unsafe-inline` without justification

## Scoring

Count failures per category. Categories with 3+ failures = systemic issue requiring structural change.

| Failures | Severity |
|----------|----------|
| 5+ in one category | Critical — systemic |
| 3-4 in one category | High — significant debt |
| 1-2 in one category | Medium — addressable |
| 0 | Pass — healthy |
