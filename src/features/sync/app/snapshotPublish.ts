import type { ChangeRecord, Connection, Scope } from '../domain/types';
import type { LocalSource } from '../ports/localSource';
import type { StorageProvider } from '../ports/storageProvider';
import { ProviderError } from '../ports/storageProvider';
import type { BlobReader } from './blobRefs';
import { collectBlobHashes, uploadAndVerifyBlobs } from './pushCycle';
import { parseJournalSeq, scopeDevicePrefix, snapshotPath } from './remotePaths';
import type { SyncStore } from './syncStore';
import { encodeSnapshot } from './wireCodec';

export interface ScopePublishDeps {
  readonly provider: StorageProvider;
  readonly connection: Connection;
  readonly store: SyncStore;
  readonly sources: readonly LocalSource[];
  readonly blobs: BlobReader;
  readonly deviceId: string;
  readonly fence: () => Promise<void>;
}

export interface ScopePublishResult {
  readonly n: number;
  readonly path: string;
  readonly coversSeq: number;
  readonly recordCount: number;
  readonly writtenPaths: readonly string[];
}

export async function collectScopeSnapshot(
  deps: Pick<ScopePublishDeps, 'sources'>,
  scope: Scope,
  exclude?: ReadonlySet<string>,
): Promise<ChangeRecord[]> {
  const records: ChangeRecord[] = [];
  for (const source of deps.sources) {
    for await (const record of source.snapshot(scope)) {
      if (exclude !== undefined && exclude.has(record.key)) continue;
      records.push(record);
    }
  }
  return records;
}

export async function highestCommittedJournalSeq(
  provider: StorageProvider,
  connection: Connection,
  scope: Scope,
  deviceId: string,
): Promise<number> {
  const entries = await provider.list(connection, scopeDevicePrefix(scope, deviceId));
  let max = 0;
  for (const entry of entries) {
    const seq = parseJournalSeq(entry.path);
    if (seq !== null && seq > max) max = seq;
  }
  return max;
}

export async function publishScopeSnapshot(
  deps: ScopePublishDeps,
  scope: Scope,
  records: readonly ChangeRecord[],
  coversSeq?: number,
): Promise<ScopePublishResult> {
  const writtenPaths = await uploadAndVerifyBlobs(deps, collectBlobHashes(records));
  const seq = coversSeq ?? (await highestCommittedJournalSeq(
    deps.provider,
    deps.connection,
    scope,
    deps.deviceId,
  ));
  const n = await deps.store.allocateSnapshotN(deps.connection.connectionId, scope);
  const body = encodeSnapshot({ scope, deviceId: deps.deviceId, n, coversSeq: seq, records });
  const path = snapshotPath(scope, deps.deviceId, n);
  await deps.fence();
  const written = await deps.provider.write(deps.connection, path, body);
  const listed = await deps.provider.list(
    deps.connection,
    scopeDevicePrefix(scope, deps.deviceId),
  );
  const entry = listed.find((e) => e.path === path);
  if (
    entry === undefined ||
    entry.size !== written.size ||
    (written.providerChecksum !== undefined &&
      entry.providerChecksum !== undefined &&
      entry.providerChecksum !== written.providerChecksum)
  ) {
    throw new ProviderError('unknown', `snapshot verify failed for ${path}`);
  }
  return {
    n,
    path,
    coversSeq: seq,
    recordCount: records.length,
    writtenPaths: [path, ...writtenPaths],
  };
}
