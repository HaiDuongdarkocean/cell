# --help

## Problem

Junk pipeline item created by an accidental `pipeline-state.mjs init --help` invocation — the CLI treated the flag as a slug. There is no real feature, pain, or backlog row behind it.

## Journey

### As-is

- Operator runs `node scripts/pipeline-state.mjs init --help` expecting usage text.
- CLI interprets `--help` as a feature slug and writes a state item.
- Item sits at stage=analyze with no artifacts forever.

### To-be

- Item dropped from `tasks/pipeline-state.json`.
- No backlog row touched (none exists for this slug).
- Real items unaffected.

## Decision

no-go — not a real backlog item; junk state row from CLI misuse.
