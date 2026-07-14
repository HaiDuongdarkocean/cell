---
name: chrome-extension-mv3-architecture-review
description: Reviews Chrome Extension MV3 architecture to surface maintainability, updateability, and discoverability risks for both AI agents and humans. Use when auditing an MV3 extension before a refactor, when architecture feels tangled, when onboarding to an unfamiliar MV3 codebase, or when planning a major change. Triggers on "review architecture", "audit extension", "architecture review", "kiến trúc có vấn đề gì", "refactor architecture", "is this MV3 codebase healthy".
---

# Chrome Extension MV3 Architecture Review

Reviews a Chrome Extension MV3 codebase to identify architecture risks that hurt maintainability, updateability, and discoverability (for AI agents + humans). Outputs a markdown report with severity-ranked findings + improvement directions. Does NOT modify code or generate refactor plans.

## When to Use

- Before a major refactor — get a baseline of architecture debt
- Onboarding to an unfamiliar MV3 codebase — understand structure + risks fast
- Architecture feels tangled / hard to change one thing without breaking others
- Planning a feature that touches many modules — know the coupling first
- Periodic health check — track architecture debt over time

**Trigger phrases**: "review architecture", "audit extension", "architecture review", "kiến trúc có vấn đề gì", "refactor architecture", "is this MV3 codebase healthy", "check extension structure".

## Input

- **Required**: path to extension root (folder containing `manifest.json` or `public/manifest.json`)
- **Optional**: focus area (e.g. "focus on message passing", "focus on storage")
- **Optional**: output path (default: `docs/reviews/architecture-review-YYYY-MM-DD.md`)

## Output

A markdown report file at `docs/reviews/architecture-review-YYYY-MM-DD.md` (or user-specified path) containing:

1. **Snapshot** — manifest summary, structure tree, chrome.* heatmap, dependency graph summary
2. **Findings** — severity-ranked (Critical / High / Medium / Low), each with: category, evidence (file:line), impact, recommendation
3. **Recommendations** — improvement directions with priority + impact + effort (no detailed task breakdown)
4. **Appendix** — full chrome.* usage table, dependency graph, anti-pattern checklist results

## Process

### Step 1 — Locate + parse manifest

1. Find `manifest.json` (root or `public/`)
2. Parse: `manifest_version`, `permissions`, `host_permissions`, `background.service_worker`, `content_scripts`, `action.default_popup`, `side_panel.default_path`, `web_accessible_resources`, `content_security_policy`
3. Identify all entrypoints: background SW, content scripts, popup, sidepanel, offscreen
4. Record manifest version + permission count + entrypoint count

### Step 2 — Map structure

1. Build folder tree of `src/` (or equivalent source root)
2. Identify layer organization: is there FSD? flat? technical-prefix (`lib/`, `utils/`, `helpers/`)?
3. Count files per top-level folder — flag god-folders (>30 files)
4. Detect barrel exports (`index.ts` per slice) — flag missing barrels
5. Detect technical-prefix folders at root (`lib/`, `utils/`, `services/`, `helpers/`) — flag for Screaming Architecture violation

### Step 3 — Trace dependencies

1. Grep all `import ... from` statements across `src/`
2. Build dependency graph (file → file)
3. Detect circular dependencies (A → B → A)
4. Detect cross-feature imports (feature A imports feature B directly, not via barrel)
5. Detect deep imports (import bypasses barrel, reaches internal files)
6. Detect layer violations (lower layer imports higher layer)

### Step 4 — Chrome.* heatmap

1. Grep `chrome\.(storage|runtime|tabs|downloads|webRequest|offscreen|sidePanel|action|scripting|contextMenus|alarms|notifications|identity|cookies|declarativeNetRequest)\.` across `src/`
2. Count per API per file
3. Identify scatter: chrome.* outside entrypoints + adapter layer
4. Flag files in features/entities/shared that call chrome.* directly (boundary violation)

### Step 5 — Run MV3 anti-pattern checklist

Read `checklists/mv3-anti-patterns-checklist.md` and run each item against the codebase. Record pass/fail + evidence for each.

### Step 6 — Synthesize findings

1. Group checklist failures + dependency issues + chrome.* scatter by category:
   - **Lifecycle** — SW persistence, idle eviction, state loss
   - **Boundary** — chrome.* scatter, cross-feature import, layer violation
   - **Message** — untyped messages, missing tabId, broadcast leak
   - **Storage** — magic strings, quota risk, no central keys
   - **Injection** — unscoped content scripts, heavy logic in content scripts
   - **Discoverability** — technical prefixes, missing barrels, no arch map
   - **Testability** — unmockable chrome.*, test structure mismatch
2. Assign severity:
   - **Critical** — breaks MV3 constraints, causes runtime bugs, data loss
   - **High** — blocks maintainability, hard to change without breakage
   - **Medium** — friction, slows down updates
   - **Low** — polish, nice-to-have
3. For each finding: evidence (file:line), impact (what breaks), recommendation (direction, not detailed plan)

### Step 7 — Write report

1. Read `templates/architecture-review-template.md`
2. Fill in all sections using collected data
3. Save to `docs/reviews/architecture-review-YYYY-MM-DD.md` (create `docs/reviews/` if missing)
4. Print summary to chat: top 3 critical/high findings + report path

## Verification

After running the review:

- [ ] Report file exists at expected path
- [ ] Report has all 4 sections (Snapshot, Findings, Recommendations, Appendix)
- [ ] Every finding has: severity, category, evidence (file:line), impact, recommendation
- [ ] chrome.* heatmap table is complete (all APIs counted)
- [ ] Anti-pattern checklist results recorded in Appendix
- [ ] No code was modified (read-only review)
- [ ] No refactor plan generated (findings + directions only)

## Boundaries

**Always do**:
- Read manifest first — it defines the extension's surface area
- Cite file:line evidence for every finding
- Distinguish "MV3-specific issue" from "general architecture issue"
- Note if codebase already uses FSD — adjust checklist accordingly

**Ask first**:
- If manifest is MV2 (not MV3) — confirm user wants MV3 review on MV2 code
- If codebase is not a Chrome Extension at all — clarify scope

**Never do**:
- Modify any code or config files
- Generate detailed refactor task breakdown (user decides implementation)
- Run tests, build, or any command with side effects
- Skip the anti-pattern checklist — it is the core of the review

## Examples

### Example trigger
> User: "review architecture of this extension"
> Agent: invokes skill, asks for extension root path, runs 7-step process, writes report to `docs/reviews/architecture-review-2026-07-01.md`, prints top 3 findings.

### Example finding format
```
### Critical
- [C1] Background service worker is a god-file (2,200 lines)
  - Evidence: src/background/index.ts:1-2200
  - Impact: Any change touches the file; SW re-evaluation risk on idle;
    hard to locate logic; untestable
  - Recommendation: Extract business logic into feature modules
    (features/<domain>/); keep SW as thin orchestrator
```
