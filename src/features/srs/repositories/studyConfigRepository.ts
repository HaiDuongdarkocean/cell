import type { SrsStudyConfig } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { SRS_STORES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord } from './srsRepositoryHelpers';

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
  return withStore(SRS_STORES.STUDY_CONFIGS, async (store) => {
    await putRecord(store, studyConfig);
    return Object.freeze(studyConfig);
  });
}

export async function deleteStudyConfig(id: string): Promise<void> {
  return withStore(SRS_STORES.STUDY_CONFIGS, async (store) => {
    await deleteRecord(store, id);
  });
}
