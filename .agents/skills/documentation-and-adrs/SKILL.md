---
name: documentation-and-adrs
description: Record decisions and docs - ADRs, architecture notes. Use when making architectural decisions or changing public APIs.
---

# Documentation and ADRs

## Overview

Document decisions, not just code. Code shows *what*; docs explain *why it was built this way* and *what alternatives were rejected* — context future humans and agents need.

## When to Use / NOT

**Use:** significant architectural decisions; choosing between approaches; public API changes; user-facing behavior changes; repeating the same explanation.

**NOT:** obvious code; comments that restate the code; throwaway prototypes.

## ADRs (highest-value docs)

**Write one for:** framework/library/major-dep choices, data models, auth strategy, API architecture, build/hosting/infra, anything expensive to reverse.

**Structure:** Status (Accepted/Superseded/Deprecated) · Date · Context (requirements + constraints) · Decision · Alternatives Considered (pros/cons/rejected-why) · Consequences. Store in `docs/adr/` with sequential numbering.

**Debt payback ADR variant** adds: audit item ref, debt type, current state, trigger, chosen strategy (Strangler Fig / Branch by Abstraction / Boy Scout / test sprint), temporary abstractions + removal conditions, rollback plan.

**Lifecycle:** PROPOSED → ACCEPTED → SUPERSEDED/DEPRECATED. Never delete old ADRs — supersede them.

→ Full ADR + debt-ADR templates, README skeleton, changelog format, OpenAPI example: `references/templates.md`

## Inline documentation

House rule (AGENTS.md): **the only allowed comment is an ADR pointer** — `// <why it binds> (ADR-NNN)`. Everything else is deleted on sight: narration, TODOs, commented-out code. If a gotcha is worth explaining, it earns an ADR first, then the comment links it.

**When an ADR is written:** at the moment the decision is made — status `Proposed` during deliberate/implement, flip to `Accepted` when verification passes. Never written retroactively after ship (that's rationalization — rejected alternatives get reconstructed, not remembered). Exception: retroactive records from audit/incident discovery are still written, marked as discovered.

## API docs

- **TypeScript:** TSDoc on public functions — `@param`, `@returns`, `@throws`, `@example`.
- **REST:** OpenAPI/Swagger specs.
- **README:** quick start, commands table, architecture overview, contributing.
- **Changelog:** grouped by impact (Added/Fixed/Changed/Deprecated/Removed/Security), user-facing phrasing, linked issues.

## Docs for agents

`AGENTS.md` conventions, kept-current specs, ADRs (prevent re-deciding), inline gotchas — these are what agents actually read.

## Rationalizations / red flags

- "Code is self-documenting" → it doesn't show why or rejected alternatives · "docs when the API stabilizes" → the doc is the first test of the design
- "Nobody reads docs" → agents do; future you does · "ADRs are overhead" → 10 min now vs a 2-hour re-debate in 6 months
- Red flags: undocumented architectural decisions; undocumented public APIs; README without run instructions; commented-out code; stale TODOs; docs that restate code

## Verification

- [ ] ADRs exist for all significant decisions; README covers quickstart + commands + architecture
- [ ] Public APIs have param/return docs; known gotchas documented inline; no commented-out code

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
