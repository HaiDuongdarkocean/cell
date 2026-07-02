# Skill Output Routing — artifact location rule

> **Principle:** when a skill runs on a concrete project, filled artifacts (inventories, audit reports, specs, plans) belong in **that project's `docs/`**, never in the skill's own directory.

## Root cause this principle prevents

Agent runs `design-system-ui-ux` audit on project cell. Skill SKILL.md says "Output: `examples/inventory-template.md` filled with evidence." Agent fills template with cell-specific evidence and saves as `.agents/skills/design-system-ui-ux/examples/inventory-cell-2026-07-02.md`.

**Why wrong:**
- Project audit buried inside skill directory → not version-controlled with project
- Not indexed by project `docs/0-wiki.md` → onboarding agent won't find it
- Mixed with generic `examples/inventory-example.md` → skill directory polluted
- Re-running skill on another project compounds the pollution

## Rule

| Artifact type | Location | Purpose |
|---|---|---|
| **Template** (blank format) | skill `templates/` | Reusable format, generic, no project data |
| **Example** (filled generic sample) | skill `examples/` | Teaches format, NOT tied to a specific project |
| **Project output** (filled with THIS project's evidence) | **project `docs/`** | Project artifact → version control → indexed by `0-wiki.md` |

**Test:** does the artifact contain project-specific evidence (file:line citations, this project's token values, this project's component names)? → project `docs/`. Is it a blank format or a generic sample usable across projects? → skill `templates/` or `examples/`.

## Naming convention for project output

`<docs-folder>/<audit-name>-YYYY-MM-DD.md`

Date suffix disambiguates re-runs over time (e.g. quarterly drift audits). Folder follows project convention (e.g. `docs/reviews/` for audit reports, `docs/specs/` for PRDs, `docs/plan/` for implementation plans).

## Applies to

- `design-system-ui-ux` — inventory + drift audit report → `docs/reviews/`
- `spec-driven-development` — spec → `docs/specs/`
- `planning-and-task-breakdown` — plan/task list → `docs/plan/` + `docs/task/`
- `chrome-extension-mv3-architecture-review` — review → `docs/reviews/`
- Any skill whose SKILL.md "Output" section produces a filled artifact

## Skill authoring corollary

When writing/editing a SKILL.md "Output" or "Process" section, never write "Output: `examples/template.md` filled." Instead write: "Output: project `docs/<name>-YYYY-MM-DD.md` (use `templates/<name>-template.md` as the format — see Output routing rule)." Otherwise the skill actively misleads the agent into polluting its own directory.
