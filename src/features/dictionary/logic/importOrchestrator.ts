// importOrchestrator — use-case + atomic rollback (ADR-023 D6, spec F10).
//
// Flow: validate → detect → signature → checkDuplicate → create resource
// (installationFinished=false) → strategy.execute() → update resource
// (wordCount, installationFinished=true) → return result.
// Error → rollbackImport(resourceId) → rethrow. Rollback-during-rollback → RollbackError.

import { validateFile, readFileHead, readFileBytes } from '../logic/fileDetector';
import type { ReadableFile } from '../logic/fileDetector';
import { detectFormat } from '../logic/formatDetector';
import { computeSignature } from '../logic/signatureGenerator';
import { resolveFormat, createStrategy } from '../strategies/strategyFactory';
import {
  DuplicateFileError,
  RollbackError,
} from '../logic/importErrors';
import {
  addResource,
  updateResource,
  getResource,
  findResourceBySignature,
  deleteResource,
  getAllResources,
} from '../repositories/resourceRepository';
import { deleteFrequencyByResource } from '../repositories/frequencyRepository';
import { deleteDictionaryByResource } from '../repositories/dictionaryRepository';
import { deletePhraseIndex } from '../repositories/phraseIndexRepository';
import { buildPhraseIndexForResource } from '../logic/phraseIndexBuilder';
import type {
  ImportFormat,
  ImportOptions,
  ImportResult,
  ResourceType,
  ResourceInfo,
} from '@/entities/dictionary';

/** Import a file: validate → detect → signature → dedupe → create → execute → finalize. */
export async function importFile(
  file: ReadableFile,
  resourceType: ResourceType,
  options: ImportOptions,
): Promise<ImportResult> {
  const { langCode, onProgress, onResourceCreated } = options;

  // 1. Validate file size ≤ 500MB
  validateFile(file);

  // 2. Read head (first 1MB) for format detection + signature
  const head = await readFileHead(file);

  // 3. Detect format
  const detectedFormat = await detectFormat(file.name, head);
  const format = resolveFormat(detectedFormat, resourceType);

  // 4. Compute signature (SHA-256(first1MB)_size_name)
  const signature = await computeSignature(file);

  // 5. Check duplicate (same signature = re-import)
  const existing = await findResourceBySignature(langCode, signature);
  if (existing) {
    throw new DuplicateFileError(signature, existing.name);
  }

  // 6. Read full file bytes
  const data = await readFileBytes(file);

  // 7. Create resource (installationFinished=false — UI sees progress)
  const resourceId = await addResource(langCode, {
    name: file.name,
    langCode,
    type: resourceType,
    format: format as ImportFormat,
    signature,
    wordCount: 0,
    installationFinished: false,
    importedAt: Date.now(),
  });
  onResourceCreated?.(resourceId);

  // 8. Execute strategy
  try {
    const strategy = createStrategy(format, resourceType, { resourceId, langCode, onProgress: onProgress as ((processed: number) => void) | undefined }, { data, fileName: file.name });
    const result = await strategy.execute();

    // 9. Build phrase index for Cambridge dictionaries (ADR-037 §7.2).
    //    Must succeed before installationFinished=true so a blob failure
    //    rolls back the whole import. Non-Cambridge / non-dictionary resources
    //    skip this step.
    if (format === 'cambridge-json' && resourceType === 'DICTIONARY') {
      await buildPhraseIndexForResource(langCode, resourceId);
    }

    // 10. Finalize resource (wordCount + installationFinished=true)
    const resource = await getResource(langCode, resourceId);
    if (resource) {
      await updateResource(langCode, {
        ...resource,
        wordCount: result.wordCount,
        installationFinished: true,
      });
    }

    return { resourceId, wordCount: result.wordCount, format };
  } catch (error) {
    // 11. Rollback on any error
    await rollbackImport(langCode, resourceId);
    throw error;
  }
}

/** Rollback: delete entries + resource. Rollback-during-rollback → RollbackError. */
export async function rollbackImport(langCode: string, resourceId: number): Promise<void> {
  try {
    await deleteDictionaryByResource(langCode, resourceId);
    await deleteFrequencyByResource(langCode, resourceId);
    await deletePhraseIndex(langCode, resourceId);
    await deleteResource(langCode, resourceId);
  } catch (rollbackErr) {
    throw new RollbackError(resourceId, rollbackErr);
  }
}

/** Delete a resource + cascade entries (user-initiated delete, not rollback). */
export async function deleteResourceCascade(langCode: string, resourceId: number): Promise<void> {
  await deleteDictionaryByResource(langCode, resourceId);
  await deleteFrequencyByResource(langCode, resourceId);
  await deletePhraseIndex(langCode, resourceId);
  await deleteResource(langCode, resourceId);
}

/** List all resources for a lang. */
export async function listResources(langCode: string): Promise<ResourceInfo[]> {
  return getAllResources(langCode);
}
