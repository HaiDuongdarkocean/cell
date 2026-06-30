# Ponytail — Lazy Senior Dev Ladder (Windsurf)

> Cross-tool source of truth is `AGENTS.md` section "Ponytail". This file is the Windsurf-specific reminder.

Lazy = efficient, not careless. Before writing code, stop at the first rung that holds:

1. **YAGNI** — does this need to exist?
2. **Reuse codebase** — does it already exist here?
3. **Stdlib** — does the standard library do it?
4. **Native platform** — does a native feature cover it?
5. **Installed dependency** — does an installed dep solve it?
6. **One line** — can this be one line?
7. **Only then**: write the minimum code that works.

## Rules of thumb

- Ladder runs AFTER understanding the problem (read task + code, trace real flow).
- Bug fix = root cause, not symptom. Grep every caller, fix shared function once.
- No unrequested abstractions, no new deps if avoidable, deletion over addition, boring over clever, fewest files possible.
- Mark intentional simplifications with `ponytail:` comment.
- **Baseline TDD override**: when in doubt, write the test — baseline wins over ponytail "trivial no test".

## Not lazy about

- Understanding the problem
- Input validation at trust boundaries
- Error handling that prevents data loss
- Security, accessibility, hardware calibration
- Anything explicitly requested
