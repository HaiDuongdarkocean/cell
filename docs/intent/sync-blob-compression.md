# Intent: Compress synced dictionary blobs

> Slug: `sync-blob-compression` · Mode: all · Source: user statement ("đưa f2") → `docs/audits/20260928_sync-drive-efficiency.md` F2
> ui_surface: no
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Syncing an installed dictionary to other devices transfers the full portable content over the network and stores it on Google Drive uncompressed — tens of MB per dictionary per account | `serializeResourcePortable` emits raw NDJSON (`resourceIdentity.ts:8-17`); journals/snapshots are gzipped but blobs are not (`audit §3 F2`) | high |
| Change | Blob transport raw NDJSON → gzip-compressed bytes; `contentHash` stays sha256 of the portable **content** so identity/dedup is unchanged | audit §3 F2, §5.3; `pushCycle.ts:268-271` (verify is presence+size, never re-hashes fetched bytes) | high |
| Solution | Compress at the blob boundary only — `dictBlobReader` emits `gzipSync(bytes, {mtime:0})`, the apply path sniffs gzip magic and gunzips before `deserializeResourcePortable`; `ensureResourceContentHash` and `blobs/<sha256>` naming/verify unchanged | `dictBlobReader.ts`, `dictLocalSource.ts:288-303`, `fileDetector.ts:49-78` (`isGzip`/`gunzipFile` already exist) | high |
| Value | ~60–80% smaller upload per dictionary and per additional device download; less Drive quota burn; fewer resumable-upload retries on weak networks | audit §6 | high |
| Stakeholder | Sync users with large dictionaries (30–50MB NDJSON typical) | audit §6 | medium |
| Context | Chrome MV3; `fflate` already a dependency; sync provider is Google Drive; mixed-extension-version devices can share one account | `package.json`, `docs/2-architechture-system.md` sync section | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Em (agent) + Anh | Correct gzip framing at exactly two seams (write side emit, read side decode), tests covering both raw-legacy and compressed blobs | `fflate` in-tree; compression is a solved problem |
| Customer | Sync users importing large dictionaries | Faster, cheaper sync — the heaviest sync payload shrinks most | [assumption] typical dict ≥ tens of MB |
| Supplier/Dependency | Google Drive | Smaller file writes; same `blobs/` namespace and multipart/resumable paths | none — payload is opaque bytes to Drive |
| Organization | Future contributors | Blob format must stay self-describing so old records keep working | gzip magic sniffing (`1f 8b`) makes decode unambiguous |
| Regulator | Chrome Web Store / none | none — client-side compression of user data, no new permissions | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Synced dictionary blob bytes must be gzip-compressed on upload so each dictionary costs ~60–80% less bandwidth and Drive storage | P | audit F2 + §5.3; `resourceIdentity.ts:8-17` | high |
| N2 | A device must still read blobs written by pre-compression versions (raw NDJSON) — existing `blobs/<sha256>` objects and persisted `contentHash` values must not become unreadable | R | `dictLocalSource.ts:303` decode path; `by_contentHash` index `:366` | high |
| N3 | `contentHash` must stay sha256 of the portable content — the same dictionary stamps the same token on every build, so no duplicate `resource:` records / duplicate installs appear across mixed-version devices; blob naming + listing verify (presence + size) keeps working unchanged | F/R | `resourceRecordToken`/`by_contentHash` dedupe `dictLocalSource.ts:261-275,365-371`; verify `pushCycle.ts:243-276` | high |
| N4 | Dictionary install on the receiving device must produce identical rows whether the blob was raw or compressed | F | `deserializeResourcePortable` contract `resourceIdentity.ts:19-33` | high |
| N5 | No new dependency; compression must not regress import/apply throughput noticeably for multi-hundred-MB dictionaries; gzip output must be deterministic (`{mtime:0}` convention already used by `wireCodec.ts:76`) | P/+resource | `fflate` already installed (audit F2; `package.json`) | high |

## Scope

- **In:** blob emit path (`dictBlobReader`), remote-apply decode path (`dictLocalSource`), tests proving raw-blob backward compatibility and compressed round-trip. Dictionary blobs are the **only** `blobs/` producer today (`dictBlobReader` is the only `BlobReader` wired in `syncRuntime.ts`).
- **Out:** `ensureResourceContentHash`/`serializeResourcePortable` (hash-of-content stays); F1/F3/F4/F5 audit findings (separate items); Drive folder layout changes; `chrome.storage`/IndexedDB local copies.
- **Non-goals:** making a stale-version device understand gzip blobs (impossible without a decoder on that build — covered as a risk); changing the journal/snapshot wire format (already gzipped).

## Workflow

System↔system only. Device A finishes importing a dictionary → `contentHash` = sha256 of its portable NDJSON (unchanged) → when the SyncEngine asks `dictBlobReader` for `blobs/<hash>` it emits `gzipSync(portableBytes, {mtime:0})` → uploaded + verified by listing → journal references the hash. Device B pulls the journal → fetches `blobs/<hash>` → sniffs `1f 8b` magic → gunzips when present → imports identical rows → marks `installationFinished`. A legacy raw blob fetched by new code passes through the sniff untouched. Milestones: compress at emit, sniff at decode — nothing else changes.

## Journey

### AS-IS

1. User installs a 40MB dictionary on device A; sync capture stamps `contentHash` = sha256 of the raw portable NDJSON.
2. Next push cycle uploads `blobs/<hash>` as ~40MB of raw bytes to Drive, verified by listing.
3. Device B pulls the journal, fetches the ~40MB blob, decodes NDJSON directly, imports.
4. Every additional device pays the same ~40MB download; the account's Drive stores the full 40MB forever.
5. Edge: on a weak network the resumable upload of a large raw blob retries and burns more quota.

### TO-BE

1. User installs the same 40MB dictionary on device A; `contentHash` = sha256 of the portable NDJSON — **identical to AS-IS**, so a re-synced or cross-version copy never mints a second `resource:` record.
2. The push cycle asks `dictBlobReader` for the blob and uploads `blobs/<hash>` as ~8–16MB of deterministic gzip; the same presence+size verify applies.
3. Device B pulls the journal, fetches the smaller blob, sniffs `1f 8b`, decompresses, imports identical rows.
4. Each additional device downloads ~60–80% fewer bytes; Drive stores the compressed object.
5. Edge: a device on the new build fetches a raw blob written pre-upgrade — sniff passthrough decodes it; a stale-build device fetching a gzip blob fails decode until it auto-updates (risk below).

## Stories

- S1: As a sync user with large dictionaries, I want dictionary content to compress before upload so that syncing costs less bandwidth and Drive quota — done when the blob stored under `blobs/<hash>` is gzip and decompresses to identical rows.
- S2: As a sync user with dictionaries synced before this change, I want my old blobs to keep working — done when a raw-NDJSON blob fetched by the new build imports successfully.
- S3: As a maintainer, I want blob identity to stay content-addressed — done when the same dictionary yields the same `contentHash`/`blobs/<hash>` name regardless of build version or compression.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Old extension build fetches a gzip blob and fails to decode (mixed versions on one account) | external/operational | Dictionary won't install on the stale device until it updates; other data classes unaffected | auto-update keeps skew window small; sniff-decode added to new code protects the reverse direction; documented in verify doc |
| Compression CPU cost on multi-hundred-MB dictionaries | internal/performance | One serialize+gzip pass per sync-of-record; measured in tests | `fflate` sync gzip is fast; contentHash is already computed once per resource — no hot loop |
| Non-deterministic gzip output (mtime/OS bytes) causing size drift between repeated `read()` calls of the same blob | internal | Listing verify compares size — drift could flap retries | pin `gzipSync(bytes, {mtime:0})`, same convention as `wireCodec.ts:76`; round-trip test asserts byte-stability |
| `fflate` import into background bundle bloats it | internal | fflate already in dep tree (used elsewhere) — bundle delta near zero | check bundle output in build gate |

## Decision

go — highest-value sync data-savings item in the audit; boundary is narrow (two seams), backward compatibility is achievable by magic-byte sniffing, and the dependency already exists.

## Draft Acceptance Criteria

- [ ] `dictBlobReader`-emitted blob bytes are deterministic gzip (`{mtime:0}`) of the portable serialization; repeated reads are byte-identical
- [ ] `contentHash` = sha256 of the portable content — unchanged stamping; the same dictionary yields the same token on every build
- [ ] Receiving device imports identical rows from a compressed blob and from a legacy raw blob (sniffed via `isGzip`/`gunzipFile`)
- [ ] Unit tests cover: compressed round-trip, raw-blob decode, byte-stability, corrupt blob still throws
- [ ] Deterministic gates pass: typecheck, lint, test:unit, build
