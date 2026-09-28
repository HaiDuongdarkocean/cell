# Spec Review — sync-blob-compression

`spec-reviewer` subagent (fresh context) against `docs/specs/sync-blob-compression.md` + intent doc + code.

## Findings (condensed, full detail in subagent report)

- Design consistent: emit gzip → sniff at `importResourceBlob` → hash-of-content only; no consumer breaks (emit funnels through `dictBlobReader.read`; verify is presence+size; resumable-session keys hash uploaded bytes → deterministic gzip is sufficient).
- Majors: promised ~60–80% not verifiable by any AC; blast radius understated — decode failure aborts apply post-commit, `installationFinished=false`, journal cursor does not advance → indefinite retry wedge (pre-existing semantics).
- Minors: missing `fetchBlob→null` alt flow; seam name `applyBlobs` nonexistent (real seam `afterApplyCommit`/`importResourceBlob`); TO-BE 4 + AC-6 unmapped; NFR-3 untestable; AC-5 weak; AC-6 overclaimed error message; `dictBlobReader.test.ts` fixture update not acknowledged.

## Required changes → all applied to the spec

1. REQ-2 exception + Open Questions rewritten with real blast radius (post-commit throw → no cursor advance → indefinite retry).
2. AC-7 added (asserted compression ratio on repeated-key fixture); NFR-3 + ~60–80% demoted to estimate.
3. REQ-2 alt flow added (`fetchBlob→null`); seam renamed `afterApplyCommit`/`importResourceBlob`.
4. Traceability completed: TO-BE 4 → REQ-1+REQ-2; robustness row → AC-6.
5. AC-5/AC-6 tightened; `dictBlobReader.test.ts` gunzip-decode update declared in AC-5.

Subagent verdict: APPROVE_WITH_CHANGES → all changes applied above.

VERDICT: APPROVE
