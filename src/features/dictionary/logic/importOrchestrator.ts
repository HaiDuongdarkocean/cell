// importOrchestrator — use-case + atomic rollback (ADR-023 D6, spec F10).
//
// Flow: validate → signature → checkDuplicate → read bytes → detect → create
// resource (installationFinished=false) → strategy.execute() → update resource
// (wordCount, installationFinished=true) → return result.
// Error → rollbackImport(resourceId) → rethrow. Rollback-during-rollback → RollbackError.

import { validateFile, readFileBytes, isGzip, isZip, gunzipFile, unzipAll, getExtension, stripExtension } from '../logic/fileDetector';
import type { ReadableFile } from '../logic/fileDetector';
import { detectFormat, sniffZipFormat } from '../logic/formatDetector';
import { deriveResourceType } from '../logic/dictionaryComponents';
import { computeSignature, isSignature } from '../logic/signatureGenerator';
import { createStrategy } from '../strategies/strategyFactory';
import {
  RollbackError,
  QuotaExceededError,
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

  // 4. Read full file bytes — detection sniffs the head slice of the full
  //    read instead of a second 1MB fetch.
  let data = await readFileBytes(file);
  let format = await detectFormat(file.name, data.slice(0, 1024 * 1024));

  // 4a. A .gz whose head couldn't gunzip (or whose inner kind was guessed
  //     from the inner extension) gets a content-truth re-sniff here —
  //     decompressed bytes flow on to the strategy so it skips its own pass.
  if (isGzip(data) && getExtension(file.name) === 'gz') {
    data = gunzipFile(data);
    format = await detectFormat(stripExtension(file.name), data.slice(0, 1024 * 1024));
  }

  // 4b. Zip >1MB can't be sniffed from the head — 'term-bank' is only the
  //     extension default there. Re-sniff authoritative content on full bytes;
  //     the inflated map flows on to the strategy so it skips its own pass.
  let zipFiles: Record<string, Uint8Array> | undefined;
  if (format === 'term-bank' && isZip(data)) {
    zipFiles = unzipAll(data);
    const refined = sniffZipFormat(zipFiles);
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
    const strategy = createStrategy(format, { resourceId, langCode, onProgress, components: options.components }, { data, fileName: file.name, zipFiles });
    const result = await strategy.execute();

    // 7. Build phrase index for entry-object dictionaries (ADR-037 §7.2).
    //    Must succeed before installationFinished=true so a blob failure
    //    rolls back the whole import.
    if (format === 'json-entries') {
      await buildPhraseIndexForResource(langCode, resourceId, result.phraseTerms);
    }

    // 8. Finalize resource (wordCount + components + derived type + installationFinished=true)
    const resource = await getResource(langCode, resourceId);
    if (resource) {
      await updateResource(langCode, {
        ...resource,
        type: deriveResourceType(result.components),
        wordCount: result.wordCount,
        components: result.components ?? [],
        installationFinished: true,
      });
    }

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
