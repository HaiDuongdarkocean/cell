/**
 * PROFILE_DATA_* — check + wipe the data bound to a language profile.
 *
 * Retargeting a profile (changing its target language) makes the old target's
 * vocabulary, imported dictionaries, and the profile's SRS collection
 * orphans. The settings panel asks this handler whether data exists before
 * warning the user, and calls WIPE after confirmation — the destructive part
 * stays in the extension origin where the IndexedDB stores actually live.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { ProfileDataPayloadSchema } from '@/entities/message/dictionarySchemas';
import { getAllWordStatuses } from '@/features/dictionary';
import { getAllResources } from '@/features/dictionary/repositories';
import { clearAllStores } from '@/features/dictionary';
import { getCollectionByLanguageProfileId } from '@/features/srs/repositories/collectionRepository';
import { deleteCollectionCascade } from '@/features/srs/repositories/deleteCascade';

export interface ProfileDataStatus {
  readonly vocab: number;
  readonly resources: number;
  readonly srs: boolean;
}

export function registerProfileDataHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.PROFILE_DATA_CHECK, async (request): Promise<MessageResponse<ProfileDataStatus>> => {
    const parsed = ProfileDataPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid PROFILE_DATA_CHECK payload: ${parsed.error.message}` };
    }
    try {
      const { langCode, profileId } = parsed.data;
      const [vocab, resources, collection] = await Promise.all([
        getAllWordStatuses(langCode).then((e) => e.length).catch(() => 0),
        getAllResources(langCode).then((r) => r.length).catch(() => 0),
        getCollectionByLanguageProfileId(profileId).catch(() => null),
      ]);
      return { success: true, data: { vocab, resources, srs: collection != null } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ctx.on(MESSAGE_TYPES.PROFILE_DATA_WIPE, async (request): Promise<MessageResponse<Record<string, never>>> => {
    const parsed = ProfileDataPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid PROFILE_DATA_WIPE payload: ${parsed.error.message}` };
    }
    try {
      const { langCode, profileId } = parsed.data;
      await clearAllStores(langCode);
      const collection = await getCollectionByLanguageProfileId(profileId).catch(() => null);
      if (collection) await deleteCollectionCascade(collection.id);
      return { success: true, data: {} };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
