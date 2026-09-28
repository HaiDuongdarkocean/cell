# Plan: sync-blob-compression

Spec: `docs/specs/sync-blob-compression.md` (APPROVE). Two seams + tests. No UI.

## Slices

| # | Task | Files | AC traced | Parallel | Blocked by |
|---|---|---|---|---|---|
| S1 | Gzip emit in `dictBlobReader.read` — `gzipSync(bytes, {mtime:0})` after `serializeResourcePortable` | `src/features/dictionary/sync/dictBlobReader.ts` | AC-1, AC-5 | — | — |
| S2 | Sniff+gunzip at `importResourceBlob` — `isGzip` → `gunzipFile` → `deserializeResourcePortable` | `src/features/dictionary/sync/dictLocalSource.ts` | AC-2, AC-4, AC-6 | — | — |
| S3 | Tests: update `dictBlobReader.test.ts` to gunzip `read()` output before compare; add byte-stability + compression-ratio asserts; add corrupt-gzip case; `dictLocalSource.test.ts` compressed-fixture apply test (raw fixtures stay as AC-2 proof) | `dictBlobReader.test.ts`, `dictLocalSource.test.ts` | AC-1..AC-7 | with S1/S2 | — |
| S4 | Docs: `docs/2-architechture-system.md` dict-sync row + `docs/0-wiki.md` changelog | docs | DoD | — | S1–S3 |

## Verify

- `npm run typecheck && npm run lint && npm run test:unit && npm run build`
- fresh-context `subagent_explore` verify → `docs/reviews/sync-blob-compression-verify.md`
- `transition --to shipped` (all mode re-runs the four gates)
