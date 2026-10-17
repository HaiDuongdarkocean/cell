import { SrsAudioAssetSchema } from '@/entities/srs/schemas';
import type { SrsAudioAsset } from '@/entities/srs/types';
import { SRS_STORES } from './srsDatabase';
import { createAssetRepository } from './createAssetRepository';

const repo = createAssetRepository<SrsAudioAsset>({
  store: SRS_STORES.AUDIO_ASSETS,
  schema: SrsAudioAssetSchema,
  dataClass: 'srsAudioAsset',
  keyPrefix: 'audioAssets',
  label: 'Audio',
});

export const getAudioAsset = repo.get;
export const putAudioAsset = repo.put;
export const deleteAudioAsset = repo.del;
export const getAudioAssetsByNote = repo.getByNote;
export const getAllAudioAssets = repo.getAll;
