# ADR-109: Gzip dictionary sync blobs at the transport boundary

## Status

Accepted — shipped with pipeline item `sync-blob-compression` (spec `docs/specs/sync-blob-compression.md`).

## Context

Sync audit `docs/audits/20260928_sync-drive-efficiency.md` (finding F2): journals and snapshots are gzipped, but dictionary content blobs (`blobs/<sha256>`) upload raw portable NDJSON — the largest single payload class in sync (tens of MB per dictionary).

Two design options:

- **Hash-of-transport**: `contentHash = sha256(gzip bytes)`. Rejected — changes the identity token across builds, mints duplicate `resource:<hash>` records and duplicate installs for the same dictionary, and requires version-aware stamping for legacy-hashed resources.
- **Hash-of-content** (chosen): `contentHash = sha256(raw portable bytes)`; gzip is transport/storage encoding only.

## Decision

- `dictBlobReader.read` emits `gzipSync(serializeResourcePortable(rows), {mtime:0})` — deterministic bytes, same convention as `wireCodec`.
- `dictLocalSource.importResourceBlob` decodes by gzip magic sniff (`isGzip`/`gunzipFile` from `fileDetector.ts`); raw legacy blobs pass through unchanged.
- `contentHash`, `blobs/<hash>` naming, `by_contentHash` lookup, presence+size verify, and `serializeResourcePortable` semantics are untouched.

## Consequences

- Smaller Drive storage + transfer for newly uploaded blobs (est. 60–80% on repeated-key NDJSON; tests assert <50% on a representative fixture).
- Mixed-version safe on the new-build side: new builds read both raw and gzip. Stale builds fetching a gzip blob fail `deserializeResourcePortable` until they update — the apply throws, `installationFinished` stays false, and the journal cursor does not advance (pre-existing wedge semantics; accepted, no version negotiation exists).
- Previously uploaded raw blobs are never re-uploaded compressed; dedupe keeps the raw copy.
