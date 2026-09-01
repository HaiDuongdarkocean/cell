import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  SrsAddNoteResult,
  SrsGetDecksNotetypesResult,
  SrsOpenStudyPagePayload,
} from '@/entities/message';
import {
  SrsAddNotePayloadSchema,
  SrsGetDecksNotetypesPayloadSchema,
  SrsOpenStudyPagePayloadSchema,
} from '@/entities/message/schema';
import { addNoteFromMessage } from '@/features/srs/services/addNoteFromMessage';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getNotetypesByCollection } from '@/features/srs/repositories/notetypeRepository';

const SRS_STUDY_PATH = 'src/entrypoints/srs-study/index.html';

/** Register Ocean SRS cross-context message handlers. */
export function registerSrsHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.SRS_ADD_NOTE,
    async (request): Promise<MessageResponse<SrsAddNoteResult>> => {
      const parsed = SrsAddNotePayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid SRS_ADD_NOTE payload: ${parsed.error.message}` };
      }
      try {
        const result = await addNoteFromMessage(parsed.data);
        return { success: true, data: result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.SRS_GET_DECKS_NOTETYPES,
    async (request): Promise<MessageResponse<SrsGetDecksNotetypesResult>> => {
      const parsed = SrsGetDecksNotetypesPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid payload: ${parsed.error.message}` };
      }
      try {
        const collection = await getCollection(parsed.data.collectionId);
        const [decks, notetypes] = await Promise.all([
          getDecksByCollection(collection.id),
          getNotetypesByCollection(collection.id),
        ]);
        return {
          success: true,
          data: {
            decks: decks.map((d) => ({ id: d.id, name: d.name })),
            notetypes: notetypes.map((n) => ({ id: n.id, name: n.name })),
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.SRS_OPEN_STUDY_PAGE,
    async (request): Promise<MessageResponse<{ tabId: number }>> => {
      const parsed = SrsOpenStudyPagePayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid payload: ${parsed.error.message}` };
      }
      let url = chrome.runtime.getURL(SRS_STUDY_PATH);
      const payload = parsed.data as SrsOpenStudyPagePayload;
      if (payload?.deckId) {
        url += `?deckId=${encodeURIComponent(payload.deckId)}`;
      }
      const tab = await chrome.tabs.create({ url });
      if (tab.id === undefined) {
        return { success: false, error: 'Failed to create tab' };
      }
      return { success: true, data: { tabId: tab.id } };
    },
  );
}
