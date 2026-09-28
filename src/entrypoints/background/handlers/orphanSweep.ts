/**
 * Orphan sweep — durable-output cleanup that does NOT rely on session job
 * records (browser close wipes chrome.storage.session).
 *
 * - Resource rows with installationFinished=false are authoritative orphan
 *   markers: a killed import left them behind. Each is rolled back; one
 *   failure does not abort the sweep. Rows owned by an active import job
 *   (matched by resourceId or file signature) are skipped — they may still
 *   be filling. The scan covers every per-language dictionary DB on the
 *   origin, including languages whose profile was removed.
 * - A built DSL index whose lastIndexedAt stamp was never written (caller
 *   died before saving settings) gets re-stamped.
 */
import { getAllResources } from '@/features/dictionary/repositories/resourceRepository';
import { rollbackImport } from '@/features/dictionary/logic/importOrchestrator';
import { countLingvoDslIndex } from '@/features/pronunciation/repositories/lingvoDslIndexRepository';
import { getDbHash } from '@/shared/lib/storage/dbHash';
import { isActiveJob } from '@/entities/job/types';
import { DEFAULT_PRONUNCIATION_SETTINGS } from '@/shared/config/config';
import { getJobRegistry } from './jobs';
import type { BackgroundContext } from '../context';

export async function sweepOrphanedWork(ctx: BackgroundContext): Promise<void> {
  const registry = getJobRegistry();
  const settings = await ctx.loadSettings();
  const activeImports = registry.list('resource-import').filter(isActiveJob);
  const activeResourceIds = new Set(
    activeImports.map((j) => j.resourceId).filter((id): id is number => id !== undefined),
  );
  const activeSignatures = new Map<string, Set<string>>();
  for (const job of activeImports) {
    const signature = job.params.signature;
    if (typeof signature !== 'string') continue;
    const lang = job.params.langCode as string;
    const set = activeSignatures.get(lang) ?? new Set<string>();
    set.add(signature);
    activeSignatures.set(lang, set);
  }

  const langCodes = new Set(settings.languageProfiles.map((p) => p.target));
  const dbHash = await getDbHash().catch(() => null);
  if (dbHash !== null && typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    const prefix = `orca-dict-${dbHash}-`;
    const dbs = await indexedDB.databases().catch(() => [] as IDBDatabaseInfo[]);
    for (const db of dbs) {
      if (db.name?.startsWith(prefix)) langCodes.add(db.name.slice(prefix.length));
    }
  }

  for (const langCode of langCodes) {
    let resources;
    try {
      resources = await getAllResources(langCode);
    } catch (err) {
      console.warn(`[orphanSweep] resource list failed for ${langCode}:`, err);
      continue;
    }
    const signatures = activeSignatures.get(langCode);
    for (const resource of resources) {
      if (resource.installationFinished !== false) continue;
      if (resource.id === undefined || activeResourceIds.has(resource.id)) continue;
      if (signatures?.has(resource.signature)) continue;
      try {
        await rollbackImport(langCode, resource.id);
        console.warn(`[orphanSweep] rolled back unfinished import ${resource.name} (${langCode}#${resource.id})`);
      } catch (err) {
        console.warn(`[orphanSweep] rollback failed for ${langCode}#${resource.id}:`, err);
      }
    }
  }

  const pronunciation = settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS;
  const localFile = pronunciation.localFile;
  if (localFile.dslFileHandleId !== null && localFile.lastIndexedAt === null) {
    const building = registry
      .list('local-audio-index')
      .some((j) => isActiveJob(j) && j.params.dslFileHandleId === localFile.dslFileHandleId);
    if (!building) {
      const count = await countLingvoDslIndex(localFile.dslFileHandleId).catch(() => 0);
      if (count > 0) {
        await ctx.saveSettings({
          ...settings,
          pronunciation: {
            ...pronunciation,
            localFile: { ...localFile, lastIndexedAt: Date.now() },
          },
        });
      }
    }
  }
}
