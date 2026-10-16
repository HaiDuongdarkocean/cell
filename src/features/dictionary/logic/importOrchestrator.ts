// importOrchestrator — use-case + atomic rollback (ADR-023 D6, spec F10).
//
// Flow: validate → signature → checkDuplicate → read bytes → detect → create
// resource (installationFinished=false) → strategy.execute() → update resource
// (wordCount, installationFinished=true) → return result.
// Error → rollbackImport(resourceId) → rethrow. Rollback-during-rollback → RollbackError.

import { validateFile, isGzip, getExtension, stripExtension } from '../logic/fileDetector';
import type { ReadableFile } from '../logic/fileDetector';
import { detectFormat, sniffZipFormat } from '../logic/formatDetector';
import { resolveImportSource, gunzipHead } from './importStreams';
import { deriveResourceType } from '../logic/dictionaryComponents';
import { computeSignature, isSignature } from '../logic/signatureGenerator';
import { createStrategy } from '../strategies/strategyFactory';
import {
  RollbackError,
  QuotaExceededError,
  DatabaseError,
  isImportError,
} from '../logic/importErrors';
import {
  addResource,
  updateResource,
  getResource,
  findResourceBySignature,
  deleteResource,
  getAllResources,
} from '../repositories/resourceRepository';
import { deleteEntriesByResource } from '../repositories/resourceEntryRepository';
import { compileEntryBlob } from '../repositories/entryBlobStore';
import { deletePhraseIndex } from '../repositories/phraseIndexRepository';
import { buildPhraseIndexForResource } from '../logic/phraseIndexBuilder';
import type {
  ImportFormat,
  ImportOptions,
  ImportResult,
  ResourceInfo,
} from '@/entities/dictionary';

/** Import a file: validate → signature → dedupe → read bytes → detect → create → execute → finalize.
 *  Format and content kind are content-derived — no declared resource type. */
export async function importFile(
  file: ReadableFile,
  options: ImportOptions,
): Promise<ImportResult> {
  const { langCode, onProgress, onResourceCreated } = options;

  // 1. Validate file size ≤ 500MB
  validateFile(file);

  // 2. Signature (SHA-256(first1MB)_size_name) — reuse the sender's only when
  //    its size+name tail matches this file; a stale or foreign signature can
  //    never drive dedupe or the replace cascade.
  const tail = `_${file.size}_${stripExtension(file.name)}`;
  const signature = isSignature(options.signature) && options.signature.endsWith(tail)
    ? options.signature
    : await computeSignature(file);

  // 3. Check duplicate (same signature = re-import)
  const existing = await findResourceBySignature(langCode, signature);
  if (existing) {
    const decision = await (options.onDuplicate?.(existing) ?? 'skip');
    if (decision === 'skip') {
      return {
        resourceId: existing.id ?? 0,
        wordCount: existing.wordCount,
        format: existing.format,
        skippedAsDuplicate: true,
        existingResource: existing,
      };
    }
    // decision === 'replace': delete existing entries + resource, then import normally
    await deleteResourceCascade(langCode, existing.id ?? 0);
  }

  // 4. Head-only detection — the full file never lands in memory; strategies
  //    stream it themselves (gunzip/unzip/scan per chunk).
  const head = new Uint8Array(
    await file.slice(0, Math.min(1024 * 1024, file.size)).arrayBuffer(),
  );
  let format = await detectFormat(file.name, head);

  // 4a. .gz: re-sniff on the inflated head only — the strategy stream-
  //     decompresses the body itself.
  if (isGzip(head) && getExtension(file.name) === 'gz') {
    format = await detectFormat(stripExtension(file.name), await gunzipHead(file));
  }

  // 4b. Zip: the streamed manifest (entry names + ≤64KB heads) sniffs the
  //     format authoritatively for any size zip — no full inflate — and
  //     flows on to the strategy so it skips its own manifest pass.
  const { file: sourceFile, manifest } = await resolveImportSource({ file, fileName: file.name });
  if (manifest) {
    const refined = sniffZipFormat(manifest);
    if (refined) format = refined;
  }

  // 5. Create resource (installationFinished=false — UI sees progress)
  const resourceId = await addResource(langCode, {
    name: file.name,
    langCode,
    type: 'DICTIONARY',
    format: format as ImportFormat,
    signature,
    wordCount: 0,
    installationFinished: false,
    importedAt: Date.now(),
  });
  onResourceCreated?.(resourceId);

  // 6. Execute strategy
  try {
    const strategy = createStrategy(format, { resourceId, langCode, onProgress, components: options.components }, { file: sourceFile, fileName: file.name, zipManifest: manifest ?? undefined });
    const result = await strategy.execute();

    // 6b. Compile the staged rows into immutable entry chunks + meta (ADR-118).
    //     Meta is written last — it is the commit point flipping this
    //     resource's reads to the blob path — then staged rows are deleted.
    //     Must succeed before installationFinished=true so a failure rolls
    //     back the whole import.
    await compileEntryBlob(langCode, resourceId);

    // 7. Build phrase index for entry-object dictionaries (ADR-037 §7.2).
    //    Must succeed before installationFinished=true so a blob failure
    //    rolls back the whole import.
    if (format === 'json-entries') {
      await buildPhraseIndexForResource(langCode, resourceId, result.phraseTerms);
    }

    // 8. Finalize resource (wordCount + components + derived type + installationFinished=true)
    const resource = await getResource(langCode, resourceId);
    // The row can vanish mid-import when a restarted SW reconciles the job as
    // interrupted and rolls back while an offscreen runner is still working —
    // claiming success here would orphan the inserted entries.
    if (!resource) {
      throw new DatabaseError(`Resource ${resourceId} disappeared mid-import.`);
    }
    await updateResource(langCode, {
      ...resource,
      type: deriveResourceType(result.components),
      wordCount: result.wordCount,
      components: result.components ?? [],
      installationFinished: true,
    });

    return { resourceId, wordCount: result.wordCount, format };
  } catch (error) {
    // 9. Rollback on any error
    await rollbackImport(langCode, resourceId);
    // Wrap IDB quota errors (spec §10 failure path: "Bộ nhớ đầy — xóa resource cũ")
    if (!isImportError(error) && isQuotaExceeded(error)) {
      throw new QuotaExceededError(error);
    }
    throw error;
  }
}

/** Rollback: delete entries + resource. Rollback-during-rollback → RollbackError. */
export async function rollbackImport(langCode: string, resourceId: number): Promise<void> {
  try {
    await deleteEntriesByResource(langCode, resourceId);
    await deletePhraseIndex(langCode, resourceId);
    await deleteResource(langCode, resourceId);
  } catch (rollbackErr) {
    throw new RollbackError(resourceId, rollbackErr);
  }
}

/** Check if an error is an IDB/DOM QuotaExceededError (spec §10 failure path). */
function isQuotaExceeded(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') return true;
  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    return lower.includes('quota') || lower.includes('storage') || lower.includes('full');
  }
  return false;
}

/** Delete a resource + cascade entries (user-initiated delete, not rollback). */
export async function deleteResourceCascade(
  langCode: string,
  resourceId: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  await deleteEntriesByResource(langCode, resourceId, onProgress);
  await deletePhraseIndex(langCode, resourceId);
  await deleteResource(langCode, resourceId);
}

/** List all resources for a lang. */
export async function listResources(langCode: string): Promise<ResourceInfo[]> {
  return getAllResources(langCode);
}
