import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { logger } from '@/shared/lib/logger';
import { scopeForTarget, targetOf } from '../domain/scope';
import type { RecordKey, Scope } from '../domain/types';
import type { Clock } from '../ports/clock';
import type { KeyValueStore } from '../ports/keyValueStore';
import type { LocalSource } from '../ports/localSource';
import type { SrsSyncAccess } from '../ports/srsSyncAccess';
import type { StorageProvider } from '../ports/storageProvider';
import type { BlobReader } from './blobRefs';
import type { ConnectionPullDeps, ScopePullOutcome } from './pullCycle';
import { runConnectionPull } from './pullCycle';
import {
  ackPendingKeys,
  collectPendingKeys,
  DEFAULT_PENDING_LIMIT,
} from './pushCycle';
import { collectScopeSnapshot, publishScopeSnapshot } from './snapshotPublish';
import type { SyncStore } from './syncStore';

export interface ReconcileDeps {
  readonly provider: StorageProvider;
  readonly connection: ConnectionPullDeps['connection'];
  readonly kv: KeyValueStore;
  readonly store: SyncStore;
  readonly sources: readonly LocalSource[];
  readonly blobs: BlobReader;
  readonly srs: SrsSyncAccess;
  readonly deviceId: string;
  readonly clock: Clock;
  readonly fence: () => Promise<void>;
  readonly observeHlc?: ConnectionPullDeps['observeHlc'];
  readonly onRoutingChange?: ConnectionPullDeps['onRoutingChange'];
  readonly onDisconnect?: ConnectionPullDeps['onDisconnect'];
}

export interface ReconcileResult {
  readonly scope: Scope;
  readonly pulled: ScopePullOutcome | undefined;
  readonly skippedCollections: string[];
  readonly snapshotN?: number;
  readonly coversSeq?: number;
  readonly recordsPublished: number;
  readonly ackedKeys: number;
}

export async function runScopeReconciliation(
  deps: ReconcileDeps,
  scope: Scope,
): Promise<ReconcileResult> {
  const remoteCollections = new Set<RecordKey>();
  const pullDeps: ConnectionPullDeps = {
    ...deps,
    onRemoteRecord: (record) => {
      if (record.scope === scope && record.dataClass === 'srsCollection' && record.op === 'put') {
        remoteCollections.add(record.key);
      }
    },
  };
  const pullResult = await runConnectionPull(pullDeps, [scope]);
  if (pullResult.disconnected) {
    return {
      scope,
      pulled: undefined,
      skippedCollections: [],
      recordsPublished: 0,
      ackedKeys: 0,
    };
  }
  const pulled = pullResult.outcomes[0];

  const excluded = await emptyLocalCollectionKeys(deps.srs, scope, remoteCollections);

  const records = await collectScopeSnapshot(deps, scope, excluded);

  const pending = (await collectPendingKeys(deps.sources, DEFAULT_PENDING_LIMIT)).filter(
    (key) => key.scope === scope,
  );

  const published = await publishScopeSnapshot(deps, scope, records);
  for (const source of deps.sources) {
    const mine = records.filter((record) => record.dataClass === source.dataClass);
    await source.stampCommitted(mine);
  }
  await deps.fence();
  await ackPendingKeys(deps.sources, pending);

  return {
    scope,
    pulled,
    skippedCollections: [...excluded],
    snapshotN: published.n,
    coversSeq: published.coversSeq,
    recordsPublished: records.length,
    ackedKeys: pending.length,
  };
}

async function emptyLocalCollectionKeys(
  srs: SrsSyncAccess,
  scope: Scope,
  remoteCollections: ReadonlySet<RecordKey>,
): Promise<Set<RecordKey>> {
  if (remoteCollections.size === 0) return new Set();
  const summaries = await srs.listCollectionSummaries();
  const excluded = new Set<RecordKey>();
  for (const { collection, deckIds, noteCount } of summaries) {
    if (collection.languageProfileId === null) continue;
    if (scopeForTarget(targetOf(collection.targetLanguage)) !== scope) continue;
    if (remoteCollections.has(`collections:${collection.id}`)) continue;
    if (noteCount > 0) continue;
    excluded.add(`collections:${collection.id}`);
    for (const deckId of deckIds) excluded.add(`decks:${deckId}`);
    if (collection.defaultStudyConfigId) {
      excluded.add(`studyConfigs:${collection.defaultStudyConfigId}`);
    }
    if (collection.defaultNotetypeId) {
      excluded.add(`notetypes:${collection.defaultNotetypeId}`);
    }
  }
  return excluded;
}

export function logReconcile(result: ReconcileResult): void {
  logger.info('[sync] reconciliation done', {
    scope: result.scope,
    published: result.recordsPublished,
    skipped: result.skippedCollections.length,
  });
}

export async function setActiveProfileAfterRestore(): Promise<void> {
  const settings = await loadSettings();
  if (settings.languageProfiles.length === 0 || settings.activeProfileId !== null) return;
  const [first] = [...settings.languageProfiles].sort(
    (a, b) => a.order - b.order || a.target.localeCompare(b.target),
  );
  if (!first) return;
  await saveSettings({ activeProfileId: first.id });
}
