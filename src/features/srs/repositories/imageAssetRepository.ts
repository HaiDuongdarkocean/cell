import { SrsImageAssetSchema } from '@/entities/srs/schemas';
import type { SrsImageAsset } from '@/entities/srs/types';
import { SRS_STORES } from './srsDatabase';
import { createAssetRepository } from './createAssetRepository';

const repo = createAssetRepository<SrsImageAsset>({
  store: SRS_STORES.IMAGE_ASSETS,
  schema: SrsImageAssetSchema,
  dataClass: 'srsImageAsset',
  keyPrefix: 'imageAssets',
  label: 'Image',
});

export const getImageAsset = repo.get;
export const putImageAsset = repo.put;
export const deleteImageAsset = repo.del;
export const getImageAssetsByNote = repo.getByNote;
export const getAllImageAssets = repo.getAll;
