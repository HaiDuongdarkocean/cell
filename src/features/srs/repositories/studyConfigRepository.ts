import type { SrsStudyConfig } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord } from './srsRepositoryHelpers';
import { studyConfigScopes } from './srsSyncScope';

const WRITE_STORES = [SRS_STORES.STUDY_CONFIGS, SRS_STORES.COLLECTIONS, SRS_STORES.DECKS, SRS_STORES.SYNC_OUTBOX, SRS_STORES.SYNC_META];

export async function getStudyConfig(id: string): Promise<SrsStudyConfig> {
  return withReadonlyStore(SRS_STORES.STUDY_CONFIGS, async (store) => {
    const record = await getById<SrsStudyConfig>(store, id);
    if (!record) throw new SrsError('NOT_FOUND', `StudyConfig ${id} not found`);
    return Object.freeze(record);
  });
}

export async function putStudyConfig(studyConfig: SrsStudyConfig): Promise<SrsStudyConfig> {
  if (!studyConfig.id) {
    throw new SrsError('INVALID_INPUT', 'StudyConfig id is required');
  }
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const scopes = isCaptureEnabled() ? await studyConfigScopes(tx, studyConfig.id) : [];
    await putRecord(store, studyConfig);
    for (const scope of scopes) {
      await captureChange(store, { scope, dataClass: 'studyConfig', key: `studyConfigs:${studyConfig.id}`, op: 'put' });
    }
    return Object.freeze(studyConfig);
  });
}

export async function deleteStudyConfig(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    let scopes = isCaptureEnabled() ? await studyConfigScopes(tx, id) : [];
    if (scopes.length === 0 && isCaptureEnabled()) {
      const scope = (await readRecordMeta(store, `studyConfigs:${id}`))?.scope;
      if (scope) scopes = [scope];
    }
    await deleteRecord(store, id);
    for (const scope of scopes) {
      await captureChange(store, { scope, dataClass: 'studyConfig', key: `studyConfigs:${id}`, op: 'delete' });
    }
  });
}
