import { logger } from '@/shared/lib/logger';
import type { Connection, Scope } from '../domain/types';
import type { StorageProvider } from '../ports/storageProvider';
import type { LocalSource } from '../ports/localSource';
import type { BlobReader } from './blobRefs';
import {
  parseJournalSeq,
  parseSnapshotN,
  scopeDevicePrefix,
} from './remotePaths';
import { collectScopeSnapshot, publishScopeSnapshot } from './snapshotPublish';
import type { SyncStore } from './syncStore';
import { decodeSnapshot } from './wireCodec';

export interface ChainHealthDeps {
  readonly provider: StorageProvider;
  readonly connection: Connection;
  readonly store: SyncStore;
  readonly sources: readonly LocalSource[];
  readonly blobs: BlobReader;
  readonly deviceId: string;
  readonly fence: () => Promise<void>;
}

export async function ensureChainHealthy(
  deps: ChainHealthDeps,
  scope: Scope,
  beforeSeq: number,
): Promise<{ journalCount: number }> {
  const lastCommitted = beforeSeq - 1;
  const entries = await deps.provider.list(
    deps.connection,
    scopeDevicePrefix(scope, deps.deviceId),
  );
  const journalSeqs = new Set<number>();
  const snapshotNs: { n: number; path: string }[] = [];
  for (const entry of entries) {
    const seq = parseJournalSeq(entry.path);
    if (seq !== null) journalSeqs.add(seq);
    const n = parseSnapshotN(entry.path);
    if (n !== null) snapshotNs.push({ n, path: entry.path });
  }

  const uncoveredCount = (coveredBase: number): number => {
    let count = 0;
    for (const seq of journalSeqs) {
      if (seq > coveredBase) count += 1;
    }
    return count;
  };

  let coveredBase = 0;
  let remoteTip = journalSeqs.size > 0 ? Math.max(...journalSeqs) : 0;
  const newest = snapshotNs.sort((a, b) => a.n - b.n)[snapshotNs.length - 1];
  if (lastCommitted <= 0 && newest === undefined && remoteTip === 0) {
    return { journalCount: 0 };
  }
  if (newest !== undefined) {
    let coversSeq: number | undefined;
    try {
      const blob = await deps.provider.read(deps.connection, newest.path);
      coversSeq = (await decodeSnapshot(blob)).coversSeq;
    } catch {
      coversSeq = undefined;
    }
    if (coversSeq === undefined) {
      await heal(deps, scope, remoteTip, lastCommitted);
      return { journalCount: 0 };
    }
    coveredBase = coversSeq;
    remoteTip = Math.max(remoteTip, coversSeq);
  }

  const counterReset = remoteTip >= beforeSeq;
  let contiguous = true;
  for (let seq = coveredBase + 1; seq <= lastCommitted; seq += 1) {
    if (!journalSeqs.has(seq)) {
      contiguous = false;
      break;
    }
  }

  if (!counterReset && contiguous) return { journalCount: uncoveredCount(coveredBase) };
  await heal(deps, scope, remoteTip, lastCommitted);
  return { journalCount: 0 };
}

async function heal(
  deps: ChainHealthDeps,
  scope: Scope,
  remoteTip: number,
  lastCommitted: number,
): Promise<void> {
  const coversSeq = Math.max(remoteTip, lastCommitted);
  try {
    const records = await collectScopeSnapshot(deps, scope);
    await publishScopeSnapshot(deps, scope, records, coversSeq);
    logger.info('sync: repaired damaged remote chain', {
      scope,
      deviceId: deps.deviceId,
      coversSeq,
    });
  } catch (e) {
    logger.warn('sync: chain repair snapshot failed; continuing to journal write', {
      scope,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
