---
name: system-architecture-design
description: Guides system architecture design from requirements to implementation. Use when starting a new project, designing a major feature, evaluating architecture trade-offs, or making technology selection decisions. Triggers on "design architecture", "system design", "architecture proposal", "tech stack selection", "evaluate architecture", "architecture review".
---

# System Architecture Design

## Overview

Feed the right architecture decisions at the right time. Architecture is the set of decisions that are hard to change later. This skill guides you through a structured process: understand requirements → evaluate constraints → select patterns → make decisions (ADR) → validate with fitness functions.

## When to Use

- Starting a new project or major feature
- Evaluating architecture trade-offs
- Making technology selection decisions
- Reviewing existing architecture for improvements
- Migrating from one architecture to another
- Setting up architecture governance (ADRs, standards, radar)

## The Architecture Design Process (5 Phases)

### Phase 1: Understand Requirements

Identify **architecturally significant requirements (ASRs)** — requirements that have a measurable effect on the architecture.

**Quality attributes to define:**
- Performance (latency, throughput, response time)
- Scalability (users, data volume, requests/sec)
- Security (auth, data protection, attack surface)
- Reliability (uptime, error rate, recovery time)
- Maintainability (change frequency, team size, onboarding)
- Deployability (release cadence, rollback strategy)
- Observability (logging, metrics, tracing)

**Source**: Attribute-Driven Design method — *Designing Software Architectures, 2nd Ed* (Cervantes & Kazman, 2024, Addison-Wesley)

**Template — Quality Attribute Scenario:**
```
 stimulus: user clicks word
 environment: offline, low-end device (4GB RAM)
 response: word popup appears
 response measure: < 150ms
```

### Phase 2: Evaluate Constraints & Context

**Business constraints:**
- Budget (dev cost, infra cost, 3-year TCO)
- Timeline (MVP deadline, feature roadmap)
- Team size & expertise (who maintains this in 2 years?)
- Compliance (GDPR, COPPA, accessibility WCAG)

**Technical constraints:**
- Platform (Chrome MV3, web, mobile, desktop)
- Legacy integration (existing code, data migration)
- Offline-first requirements
- Resource limits (RAM, CPU, storage, bundle size)

**MV3-specific constraints (Chrome Extension):**
- Service worker is ephemeral (killed after ~30s idle) — no global state
- No DOM in service worker — heavy compute → offscreen document
- 1 offscreen document at a time — queue services
- Content script runs in isolated world — no page `window` access
- `chrome.storage` for persistence (local: 10MB, session: 10MB, sync: 100KB)
- IndexedDB available in SW, popup, content script, offscreen
- OPFS (Origin Private File System) for large files

**Source**: dev.to/hewitt (#12), GoogleChrome/modern-web-guidance (#13), codemyextension.com (#14)

### Phase 3: Select Architecture Style & Patterns

**Decision matrix:**

| Style | When to use | Trade-offs | Source |
|---|---|---|---|
| Layered (Clean Architecture) | Domain-heavy, testable, long-lived | Verbosity, learning curve | dev.to/ievgen_ch #15, bespoyasov.me #16 |
| Hexagonal (Ports & Adapters) | Multiple integrations, swappable adapters | Interface overhead | generalistprogrammer.com #18, saadh393 #17 |
| Feature-based folders | Large codebase, team scaling | Cross-feature coupling risk | EveVault #30, Meelio #29 |
| Hub-and-spoke (extension) | SW orchestrator + CS + offscreen | Single point of failure (SW) | dev.to/hewitt #12 |
| Monorepo | Multi-app sharing domain logic | Build complexity, tooling | Meelio #29, EveVault #30 |
| Event-driven | Async, decoupled, real-time | Complexity, debugging difficulty | O'Reilly #3 |

**Selection criteria:**
1. Does the domain have complex business rules? → Layered/Hexagonal
2. Are there multiple external integrations? → Ports & Adapters
3. Is the team > 5 people? → Feature-based
4. Is it a browser extension? → Hub-and-spoke (SW + CS + offscreen)
5. Are there multiple apps sharing logic? → Monorepo
6. Is offline-first required? → Local-first storage (IndexedDB/SQLite WASM)

### Phase 4: Make Architecture Decisions (ADR)

Write an **Architecture Decision Record** for each significant decision.

**ADR Template:**
```markdown
# ADR-NNN: [Decision Title]

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-XXX

## Context
[What is the problem? What are the constraints? What are the forces?]

## Decision
[What did we decide? Be specific and unambiguous.]

## Consequences
- Positive: [benefits]
- Negative: [trade-offs we accept]
- Neutral: [side effects]

## Alternatives Considered
- [Option A]: [why rejected]
- [Option B]: [why rejected]
```

**Governance priority** (source: github.com/architecture-decision-record #4):
1. CEO (business alignment)
2. CTO (tech strategy)
3. CLO (legal/compliance)
4. Implementing team (feasibility)
5. Domain experts (technical accuracy)

**Decision levels:**
- **CTO-level**: Org-wide (tech stack, monorepo vs polyrepo, cloud vendor)
- **Architect-level**: System-wide (layering, messaging protocol, storage strategy)
- **Team-level**: Module-wide (library choice, naming, file structure)

**Source**: InfoQ (#22), GOV.UK ADR Framework (#24), Dr Milan Milanović (#25)

### Phase 5: Validate with Fitness Functions

**Architectural fitness functions** = automated tests that validate architecture qualities.

```typescript
// F1: Dependency rule — domain layer has no infrastructure imports
test('domain/ has no infrastructure imports', () => {
  glob('src/domain/**/*.ts').forEach(file => {
    expect(read(file)).not.toMatch(/from ['"].*infrastructure/);
  });
});

// F2: Bundle size budget
test('popup bundle < 200KB gzipped', async () => {
  const stats = await build();
  expect(stats.gzip).toBeLessThan(200_000);
});

// F3: Cold start budget
test('SW init < 100ms', async () => {
  const t0 = performance.now();
  await import('../src/background/index');
  expect(performance.now() - t0).toBeLessThan(100);
});
```

**Source**: *Fundamentals of Software Architecture* — Neal Ford & Mark Richards (#6, #8)

---

## 12 Architecture Principles (for browser extensions)

### P1: Service Worker is Orchestrator, Not Compute
> Source: Chrome docs #1, dev.to/hewitt #7, codemyextension.com #14

- SW only: route messages, register listeners, orchestrate
- Heavy compute (parse, encode, AI) → offscreen document
- State persist → `chrome.storage` or IndexedDB
- Event listeners MUST register at top-level scope (not in async/promise)
- Use `chrome.alarms` not `setTimeout/setInterval`

### P2: Content Scripts Stay Thin
> Source: Chrome docs #4, #5, dev.to/hewitt #7

- CS only: read DOM, inject UI overlay, send data to SW
- NO business logic in CS
- Privileged work (storage, API, download) → SW
- Validate `sender` before privileged action

### P3: Typed + Validated Message Protocol
> Source: Chrome docs #4, codemyextension.com #14

- Every message has explicit `type` (string literal union)
- Payload typed (TypeScript interface)
- Validate payload shape before acting
- Return structured `{ success, data?, error? }` not throw
- 1 handler module per feature area

### P4: Single Source of Truth — State in Background, Proxy in UI
> Source: webext-redux #11, webext-zustand #12, webext-pegasus #13

- Main store in background (SW) = source of truth
- Proxy store in popup/CS = forward action → SW, receive broadcast
- SW persist to `chrome.storage` (survive terminate)
- Popup store = Zustand proxy, sync with SW

### P5: Layered Architecture (domain/application/infrastructure/presentation)
> Source: dev.to/ievgen_ch #9, bespoyasov.me #16, bazaglia.com #17

```
domain/          # Pure types, ZERO dependency (no chrome.*, no React)
application/     # Use cases + port interfaces (abstract)
infrastructure/  # Chrome APIs, IndexedDB, HTTP (implements ports)
presentation/    # React components + hooks
entrypoints/     # Composition root (wire adapters → use cases)
```

**Dependency rule (one-way, inward):**
```
presentation → application → domain
     ↓              ↓
infrastructure → application (implements ports)
     ↓
  entrypoints (composition root)
```

NEVER:
- domain → application/infrastructure/presentation ❌
- application → infrastructure/presentation ❌
- presentation → infrastructure (only via use case) ❌

### P6: Hexagonal — Ports & Adapters (Dependency Inversion)
> Source: softwarepatternslexicon.com #20, generalistprogrammer.com #18, saadh393 #17

- **Port** = interface declaring "domain needs what"
- **Adapter** = concrete implementation
- Use case depends on port (interface), NOT on adapter
- Test use case with fake adapter (InMemory), no browser needed

```
domain ← application/ports (interfaces)
                    ↑ implements
          infrastructure/adapters
```

### P7: Feature-Based Folders Within Each Layer
> Source: EveVault #30, Meelio #29, dev.to/_arpy #25

```
application/
  word/           # SaveWord, LookupWord use cases
  dict/           # ImportDict, LookupDict use cases
  mining/         # MineCard use cases
  anki/           # ExportAnki use cases
```

Add feature = add folder. Remove feature = remove folder.

### P8: Offscreen Document for Heavy Compute + OPFS + Workers
> Source: Chrome offscreen docs #26, sqlite-opfs-mv3 #27, lit.build #28

- Offscreen = HTML page, created on-demand via `chrome.offscreen.createDocument`
- In offscreen: create Web Workers, access OPFS, run WASM
- SW → offscreen: `chrome.runtime.sendMessage`
- Offscreen → Worker: `postMessage` + Transferable (zero-copy)
- **1 offscreen at a time** (Chrome limit) → route messages to multiple services

### P9: Shadow DOM for Overlay UI (Style Isolation)
> Source: dev.to/learcise_health #36, sweets.chat #36

- All UI injected into page → Shadow DOM
- CSS scoped, no leak in/out
- Use `adoptedStyleSheets` or `<style>` in shadow root

### P10: Least Privilege — Minimal Permissions
> Source: link.springer.com #37, redreamality.com #38

- Only request permissions truly needed
- `activeTab` over `all_urls` when possible
- `optional_permissions` for secondary features
- Minimal `host_permissions` (only sites that need injection)
- Fewer permission warnings = more installs

### P11: Lazy Load + Code Split Per Surface
> Source: extension.js.org #33, extensionbooster.net #35

- SW: static import only glue (routing, listeners). Heavy → offscreen (lazy)
- Popup: dynamic `import()` for secondary tabs
- Content script: chunk overlay UI, load when needed
- Tree shake: lodash-es not lodash, dayjs not moment

### P12: Test Pyramid — 80% Unit, 15% Integration, 5% E2E
> Source: dev.to/corrupt952 #30, extension.js.org #31, Chrome docs #32

- **Unit (80%)**: domain logic, use cases, parsers — mock ports, no browser
- **Integration (15%)**: adapter + Chrome API mock, IndexedDB fake
- **E2E (5%)**: Playwright + CDP, real extension, end-to-end flow

---

## Decision Frameworks

### Technology Radar + Standards + ADRs
> Source: InfoQ #22

| Building Block | Purpose | Example |
|---|---|---|
| Technology Radar | Track adoption readiness | Adopt: React 19. Trial: WXT. Assess: SQLite WASM. Hold: Plasmo |
| Technology Standards | Mandatory patterns | "All storage via port interface, no direct chrome.storage in use cases" |
| ADRs | Document decisions | "ADR-002: Dexie + SQLite WASM split" |

### Build vs Buy vs Open-source

| Criteria | Build | Buy (SaaS) | Open-source |
|---|---|---|---|
| Strategic differentiation | High | Low | Medium |
| Time to market | Slow | Fast | Medium |
| 3-year TCO | High (dev) | Medium (subscription) | Low (dev + maintain) |
| Control | Full | Limited | Full (fork) |
| Maintenance | Full | None | Shared |
| Lock-in | None | High | Low |

### Trade-off Analysis Matrix

```
| Decision | Performance | Maintainability | Scalability | Time-to-market | Risk |
|---|---|---|---|---|---|
| Option A | 9 | 7 | 8 | 5 | Low |
| Option B | 6 | 9 | 9 | 7 | Medium |
| Option C | 8 | 5 | 6 | 9 | High |
```

---

## Common Architecture Anti-patterns

- **God object** — one class/module does everything (asbplayer's `Binding` works but hard to maintain)
- **Premature abstraction** — interfaces with only 1 implementation (violates DRY, #20)
- **Big Ball of Mud** — no layering, everything depends on everything
- **Distributed Monolith** — microservices without autonomy, coupled deployments
- **SW state in globals** — MV3 kills SW, state lost (#13, #16)
- **Resume-Driven Development** — choosing tech because it's trendy
- **Architecture Astronaut** — designing for hypothetical scale, not current needs
- **Not Invented Here** — rebuilding what open-source already does

---

## Tools & Templates

### ADR Template
See Phase 4 above.

### Quality Attribute Scenario Template
```
 stimulus: [what happens]
 source: [who/what triggers it]
 environment: [under what conditions]
 response: [what the system does]
 response measure: [how to measure success]
```

### Fitness Function Template
```typescript
test('[quality attribute]: [description]', () => {
  // Setup
  // Execute
  // Assert architecture property holds
});
```

---

## References

### Books (7)
1. System Design Guide for Software Professionals (2024, O'Reilly) — Sinha (Google), Chopra (Netflix)
2. Designing Software Architectures: A Practical Approach, 2nd Ed (2024, Addison-Wesley) — Cervantes & Kazman
3. Principles and Patterns for Distributed Application Architecture (2025, O'Reilly)
4. Cloud Application Architecture Patterns (2025, O'Reilly) — Brown, Woolf, Yoder
5. Patterns of Distributed Systems (2024, Addison-Wesley) — Unmesh Joshi
6. Fundamentals of Software Architecture — Neal Ford & Mark Richards
7. Software Architecture and Decision-Making (O'Reilly)

### Chrome Extension Architecture (5)
12. How to Structure a Production-Ready Chrome Extension MV3 — https://dev.to/hewitt/how-to-structure-a-production-ready-chrome-extension-manifest-v3-2hlf
13. Chrome Extensions SKILL.md — https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/chrome-extensions/SKILL.md
14. Extension Architecture Patterns MV3 — https://codemyextension.com/resources/extension-architecture/
15. We Built a Chrome Extension With Clean Architecture — https://dev.to/ievgen_ch/we-built-a-chrome-extension-with-clean-architecture-heres-why-it-was-worth-the-extra-effort-1jk8
16. MV3 Chrome Extension Tutorial — https://dev.to/extinde/mv3-chrome-extension-tutorial-what-changed-and-how-to-build-it-right-3pp6

### Clean Architecture / Hexagonal (5)
17. Ports and Adapters Explained — https://saadh393.github.io/blog/adapter-port-architecture-two-cases
18. Hexagonal Architecture Complete Guide — https://generalistprogrammer.com/tutorials/hexagonal-architecture-complete-guide
19. Ports and Adapter with TypeScript — https://betterprogramming.pub/how-to-ports-and-adapter-with-typescript-32a50a0fc9eb
20. Hexagonal Architecture Frontend — https://github.com/juanm4/hexagonal-architecture-frontend
21. Hexagonal and Clean Architecture with examples — https://dev.to/dyarleniber/hexagonal-architecture-and-clean-architecture-with-examples-48oi

### CTO / Decision Making (7)
22. A Simple Framework for Architectural Decisions — https://www.infoq.com/articles/framework-architectural-decisions/
23. Architecture Decision Record — https://github.com/architecture-decision-record/architecture-decision-record
24. Architectural Decision Record Framework — https://www.gov.uk/government/publications/architectural-decision-record-framework
25. Facilitating Software Architectures — https://newsletter.techworld-with-milan.com/p/driving-architectural-decisions-with
26. CTO Architecture — https://fastercapital.com/content/CTO-Architecture--How-to-Design-and-Implement-Your-CTO-Architecture.html
27. Chief Software Architect vs CTO — https://www.aalpha.net/blog/chief-software-architect-vs-cto-differences/
28. ADR - CTO Framework — https://ctoframework.com/tech/architecture/architectural-decision-record/

### Monorepo / Extension Patterns (6)
29. Meelio — https://github.com/zainzafar90/meelio (Turborepo, Dexie, Zustand, Plasmo)
30. EveVault — https://github.com/evefrontier/evevault (WXT, feature-based)
31. Universal Bookmark Manager — https://github.com/lazyengineer-eth/universal-bookmark-manager
32. SessionKeeper — https://github.com/charlenopires/SessionKeeper (DDD, Dexie, CRXJS)
33. Chrome Extension Monorepo Setup — https://bestchromeextensions.com/docs/guides/chrome-extension-monorepo
34. Chrome Extension IndexedDB Guide — https://bestchromeextensions.com/docs/guides/chrome-extension-indexeddb-storage

### Video Courses (4)
8. Fundamentals of Software Architecture — https://www.youtube.com/watch?v=fvSZ7gocaxI
9. Software Architecture Fundamentals, 3rd Ed — https://www.oreilly.com/videos/software-architecture-fundamentals/0642572016094/
10. Architecture Patterns Part 1 & 2 — https://www.oreilly.com/videos/software-architecture-fundamentals/9781491901144/
11. Software Architecture Fundamentals, 2nd Ed — https://www.oreilly.com/videos/software-architecture-fundamentals/9781491998991/
