# Verify — sync-blob-compression

Fresh-context `subagent_explore` review of implementation vs `docs/specs/sync-blob-compression.md` Success Criteria.

## Round 1 (subagent verdict)

| AC | Result |
|---|---|
| AC-1 deterministic gzip emit | PASS — `dictBlobReader.ts:37` `gzipSync(portable, {mtime:0})`; tests assert `isGzip`, gunzip==serialize, byte-identical repeat reads |
| AC-2 raw legacy blob imports | PASS — raw fixtures in `dictLocalSource.test.ts` unmodified, apply green |
| AC-3 contentHash untouched | PASS — `resourceIdentity.ts:63` still `sha256Hex(serializeResourcePortable(...))` |
| AC-4 identical rows compressed vs raw | PASS — compressed-apply test asserts same terms/wordCount/`installationFinished` |
| AC-5 no new deps | PASS — `fflate ^0.8.3` pre-existing; `package.json` deps unchanged |
| AC-6 corrupt paths | PASS — corrupt gzip → `CorruptedFileError`; NDJSON paths unchanged |
| AC-7 ratio asserted | PASS — `<50%` on 200-row repeated-key fixture |

Boundaries clean: no format flag on `ResourceInfo`, `blobs/<hash>` naming untouched (`remotePaths.ts`), `wireCodec`/journal/snapshot untouched, emit path shared with `answerBlobsNeeded`. Bug-hunt clean: `isGzip` prefix-check safe on <2-byte payloads, raw portable output can never start with `0x1f 0x8b` (lines are `d`/`f`-prefixed), buffer slicing is offset-safe.

## Findings → applied

- [minor] REQ-3 pin test absent → added `keeps contentHash as sha256 of the raw portable bytes` in `dictBlobReader.test.ts` (stamps via `ensureResourceContentHash`, asserts `sha256Hex(gunzip(read)) === contentHash`)
- [minor] no malformed-NDJSON test → added `throws on malformed portable lines in a raw blob` in `dictLocalSource.test.ts` (rejects + `installationFinished` stays false)
- [minor] test Blob construction `new Blob([bytes.buffer])` not offset-safe → new tests use `new Blob([bytes])`

## Gates

typecheck pass · lint pass · test:unit 622 suites / 7474 tests · build pass (12.9s). Commit `b15c9f63`.

VERDICT: PASS
