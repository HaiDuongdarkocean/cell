import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  SrsAddNoteResult,
  SrsGetDecksNotetypesResult,
  SrsOpenStudyPagePayload,
  SrsTermCardsResult,
} from '@/entities/message';
import {
  SrsAddNotePayloadSchema,
  SrsGetDecksNotetypesPayloadSchema,
  SrsOpenStudyPagePayloadSchema,
  SrsTermCardsPayloadSchema,
} from '@/entities/message/schema';
import { addNoteFromMessage } from '@/features/srs/services/addNoteFromMessage';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getAllCollections, getCollection } from '@/features/srs/repositories/collectionRepository';
import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import { getNotetypesByCollection } from '@/features/srs/repositories/notetypeRepository';
import { getLinksByTerm } from '@/features/ankiStatusSync/repositories/statusSyncStorage';
import { normalizeTerm } from '@/features/dictionary';

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
        const collectionId =
          parsed.data.collectionId ?? (await ensureFirstRun()).collectionId;
        const collection = await getCollection(collectionId);
        const [decks, notetypes] = await Promise.all([
          getDecksByCollection(collection.id),
          getNotetypesByCollection(collection.id),
        ]);
        return {
          success: true,
          data: {
            collectionId: collection.id,
            defaultDeckId: collection.defaultDeckId,
            defaultNotetypeId: collection.defaultNotetypeId,
            decks: decks.map((d) => ({ id: d.id, name: d.name })),
            notetypes: notetypes.map((n) => ({
              id: n.id,
              name: n.name,
              targetFieldId: n.targetFieldId,
              fields: n.fields.map((f) => ({ id: f.id, name: f.name, type: f.type })),
            })),
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
      const params = new URLSearchParams();
      if (payload?.deckId) {
        params.set('deckId', payload.deckId);
      }
      if (payload?.view) {
        params.set('view', payload.view);
      }
      if (payload?.term) {
        params.set('term', payload.term);
      }
      const qs = params.toString();
      if (qs) {
        url += `?${qs}`;
      }
      const tab = await chrome.tabs.create({ url });
      if (tab.id === undefined) {
        return { success: false, error: 'Failed to create tab' };
      }
      return { success: true, data: { tabId: tab.id } };
    },
  );

  ctx.on(
    MESSAGE_TYPES.SRS_TERM_CARDS,
    async (request): Promise<MessageResponse<SrsTermCardsResult>> => {
      const parsed = SrsTermCardsPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid SRS_TERM_CARDS payload: ${parsed.error.message}` };
      }
      try {
        const { langCode, term } = parsed.data;
        const needle = normalizeTerm(term);
        const deckIds: string[] = [];
        let count = 0;
        for (const collection of await getAllCollections()) {
          if (collection.targetLanguage !== langCode) continue;
          for (const deck of await getDecksByCollection(collection.id)) {
            const hits = (await getNotesByDeck(deck.id)).filter(
              (note) => normalizeTerm(note.targetWord) === needle,
            ).length;
            if (hits > 0) {
              count += hits;
              deckIds.push(deck.id);
            }
          }
        }
        const ankiLinks = await getLinksByTerm(needle).catch(() => [] as const);
        count += ankiLinks.filter((link) => link.langCode === langCode).length;
        return { success: true, data: { count, deckIds } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    },
  );
}
