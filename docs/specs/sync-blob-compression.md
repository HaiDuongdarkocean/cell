# Spec: Compress synced dictionary blobs

> Intent: `docs/intent/sync-blob-compression.md` · ui_surface: no · Mode: all

## Objective

Shrink the largest sync payload — installed-dictionary portable content — by gzip-compressing blob bytes at emit and transparently decompressing at apply, while `contentHash` stays sha256 of the portable content so content-addressed naming, dedupe, and blob verify remain byte-for-byte identical across builds.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| SyncEngine (push cycle) | asks `BlobReader.read(contentHash)` for upload / `answerBlobsNeeded` | contentHash | Blob bytes to store under `blobs/<hash>` |
| SyncEngine (pull cycle) | applies a `resource:<hash>` record whose blob is available | fetched blob bytes | imported dictionary rows, `installationFinished` |

System-internal processing never includes human behavior — both actors are engine internals; no UI surface exists.

## Requirements

### Functional

REQ-1: Emit gzip-compressed blob bytes
- Actor: SyncEngine push cycle (incl. `answerBlobsNeeded`, which is triggered by a peer's `blobs-needed` marker during pull — `pullCycle.ts:561-578`)
- Goal: Upload/store a blob that is ~60–80% smaller than raw NDJSON
- Preconditions: a local resource exists whose `contentHash` token was requested
- Basic flow:
  1. actor calls `BlobReader.read(contentHash)`
  2. system locates the resource by `by_contentHash`, serializes portable NDJSON (unchanged), compresses with `gzipSync(bytes, {mtime:0})`
  3. system returns a `Blob` of the compressed bytes (MIME unchanged)
- Alt flow: no matching resource → `null` (unchanged)
- Exception: serialization/gzip throws → error propagates to the caller (same contract as today)
- Rules: output must be byte-deterministic for identical input; no change to `serializeResourcePortable`, `ensureResourceContentHash`, or `contentHash` stamping
- Postcondition: blob bytes on the wire/storage are gzip; `contentHash` and `blobs/<hash>` naming unchanged
- NFR refs: NFR-1, NFR-2, NFR-3

REQ-2: Decode sniffed payload on apply
- Actor: SyncEngine pull cycle (`afterApplyCommit` → `importResourceBlob`, `dictLocalSource.ts:278-335`)
- Goal: Install identical dict/freq rows from a compressed or a legacy raw blob
- Preconditions: blob bytes fetched for a pending `resource:<hash>` record
- Basic flow:
  1. actor supplies fetched `Blob`
  2. system reads bytes, checks `isGzip(bytes)` (`fileDetector.ts`)
  3. system gunzips when magic matches, else uses bytes as-is → `deserializeResourcePortable`
  4. system imports rows and stamps `installationFinished` (unchanged)
- Alt flow: `fetchBlob` returns `null` (blob absent on remote) → record stays pending, retried next apply (existing `continue`, unchanged). Raw (pre-upgrade) blob → sniff fails → raw decode path (byte-identical to today)
- Exception: corrupt gzip → `gunzipFile` throws `CorruptedFileError`; corrupt NDJSON → `deserializeResourcePortable`/`JSON.parse` throws. **Blast radius:** the throw happens inside `importResourceBlob` *after* the apply commit — the resource keeps `installationFinished=false`, the pull aborts, and the journal cursor does **not** advance, so the device retries the same record every pull until the blob or the build is fixed (pre-existing wedge semantics, unchanged by this work; a poison gzip blob inherits it)
- Rules: decode must be format-agnostic — no version flag, no record-field dependency
- Postcondition: identical rows regardless of transport encoding
- NFR refs: NFR-1, NFR-4

REQ-3: Preserve content-addressed identity across versions
- Actor: none (invariant, not a use case — verified by tests)
- Goal: the same dictionary yields the same `contentHash`/`blobs/<hash>` token on any build
- Basic flow: n/a — `ensureResourceContentHash` and `serializeResourcePortable` are untouched; tests pin `sha256(portableBytes) === contentHash` and identical tokens before/after
- Exception: n/a
- Rules: hash input is the portable serialization, never the compressed transport bytes
- Postcondition: no duplicate `resource:` records across mixed-version devices
- NFR refs: NFR-4

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | No new dependencies — reuse `fflate` (`gzipSync` at emit; `isGzip`/`gunzipFile` helpers at decode) | +resource | zero package.json delta |
| NFR-2 | Deterministic gzip — `gzipSync(bytes, {mtime:0})`; repeated `read()` of the same resource is byte-identical | R | byte-equality in test |
| NFR-3 | Compression overhead bounded — one gzip pass per `read()`, no hot loops; the ~60–80% size figure is an estimate from the audit (NDJSON with repeated keys), not a guarantee | P | qualitative — gzip wall-clock is amortized into the existing serialize+hash pass; measured indirectly by the compression-ratio AC |
| NFR-4 | Backward compatibility — raw blobs decode identically; `contentHash` tokens stable | R | raw-blob test passes unmodified |

## Flows / States

```
push:  read(hash) → lookup by_contentHash → serialize → gzipSync(mtime:0) → Blob
pull:  fetchBlob(hash) → bytes → isGzip? → yes: gunzipFile → deserialize → import rows
                                   └─ no: deserialize (legacy path) → import rows
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Compress dictionary blob transport | `dictBlobReader.read` gzip emit (`gzipSync {mtime:0}`) |
| Decode transport-agnostic blob bytes | `importResourceBlob` magic sniff → `gunzipFile` → `deserializeResourcePortable` |
| Keep content-addressed identity | unchanged `serializeResourcePortable`/`ensureResourceContentHash` + pinning tests |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `ResourceInfo.contentHash` | sha256 of portable NDJSON — **unchanged semantics** | `langResourceInfo` store + `resource:<token>` sync records | resource lifetime |
| Blob payload | gzip-or-raw bytes; self-describing via `1f 8b` magic | Drive `cell-sync/v1/blobs/<hash>` | until replaced/compacted |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 compress upload | REQ-1 | AC-1 |
| N2 read legacy blobs | REQ-2 | AC-2 |
| N3 stable content-hash identity | REQ-3 | AC-3 |
| N4 identical rows either way | REQ-2 | AC-4 |
| N5 no dep + deterministic + perf | REQ-1 rules | AC-1, AC-5 |
| (robustness) corrupt payload handling | REQ-2 exception | AC-6 |

| Journey step | REQ |
|---|---|
| TO-BE 1 same token across builds | REQ-3 |
| TO-BE 2 compressed upload + verify | REQ-1 |
| TO-BE 3 sniff+decompress+import | REQ-2 |
| TO-BE 4 smaller downloads, compressed storage | REQ-1, REQ-2 |
| TO-BE 5 raw blob passthrough | REQ-2 |

## Boundaries

- Always: reuse `isGzip`/`gunzipFile`/`gzipSync` — no hand-rolled codecs; run all deterministic gates before commit
- Ask first: touching `serializeResourcePortable` semantics or `contentHash` stamping (changes sync identity)
- Never: compress inside `serializeResourcePortable` (it is the identity format); store a format flag on `ResourceInfo` (self-describing bytes only)

## Success Criteria

- [ ] AC-1: `BlobReader.read(hash)` returns deterministic gzip bytes — two calls produce byte-identical output, `isGzip(bytes)` is true, and `gunzipFile(bytes)` equals `serializeResourcePortable` output for the resource
- [ ] AC-2: a blob of raw `serializeResourcePortable` bytes fetched by the new code imports successfully (legacy path; existing raw fixtures in `dictLocalSource.test.ts` stay green unmodified)
- [ ] AC-3: `sha256Hex(serializeResourcePortable(rows)) === resource.contentHash` before and after the change; `ensureResourceContentHash` untouched
- [ ] AC-4: applying a compressed blob produces identical `dictRows`/`freqRows` as applying the equivalent raw blob
- [ ] AC-5: `package.json` dependency list unchanged (`fflate` already present); `dictBlobReader.test.ts` updated to decode (gunzip) `read()` output before comparing — the test change is part of this work, not a regression
- [ ] AC-6: corrupt gzip blob surfaces `CorruptedFileError`; malformed NDJSON still throws (existing error paths unchanged — `corrupt portable resource blob` for bad line prefixes, `SyntaxError` for bad JSON)
- [ ] AC-7: compressed size < raw size on a representative repeated-key NDJSON fixture (ratio asserted, e.g. <50% — the audit's 60–80% is an estimate, not a gate)

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] Real-Chrome sync smoke: existing verify path unaffected (dict install still round-trips)
- [ ] Canon docs updated: `docs/2-architechture-system.md` sync/blob row + wiki line

## Alternatives considered

- **Hash-of-transport (sha256 of gzip bytes as `contentHash`)** — rejected: changes the identity token across versions, mints duplicate `resource:` records and duplicate installs for the same dictionary, and forces hash-aware emit for legacy-hashed resources. Hash-of-content keeps dedupe and stamping untouched.
- **Format flag on `ResourceInfo`** — rejected: self-describing bytes (gzip magic) carry the same information without schema change or stamping migration.

## Open Questions / Accepted Risks

- Mixed-version window: a stale build fetching a gzip blob fails `deserializeResourcePortable` until it auto-updates — accepted (no version negotiation exists in the wire protocol). Blast radius: the throw aborts the apply, leaves `installationFinished=false`, and the journal cursor does not advance — that device+scope retries every pull until it updates. Pre-existing wedge semantics, unchanged by this work.
- A device that already uploaded a raw `blobs/<hash>` never re-uploads it compressed — dedupe keeps the raw copy; savings apply to newly synced content only.
