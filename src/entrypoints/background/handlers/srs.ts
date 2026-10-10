import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type {
  MessageResponse,
  SrsAddNoteResult,
  SrsCardsTermsResult,
  SrsGetDecksNotetypesResult,
  SrsOpenStudyPagePayload,
  SrsTermCardsResult,
} from '@/entities/message';
import {
  SrsAddNotePayloadSchema,
  SrsCardsChangedPayloadSchema,
  SrsCardsTermsPayloadSchema,
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
import { getAllLinks, getLinksByTerm } from '@/features/ankiStatusSync/repositories/statusSyncStorage';
import { normalizeTerm } from '@/features/dictionary';
import { broadcastSrsCardsChanged } from './srsCardsBroadcast';

const SRS_STUDY_PATH = 'src/entrypoints/srs-study/index.html';

/** Normalized targetWord → note count + decks holding it, across every
 *  collection of the language. Shared by SRS_TERM_CARDS (per-term lookup)
 *  and SRS_CARDS_TERMS (whole-language set for token card flags). */
async function scanCardTermsByDeck(
  langCode: string,
): Promise<Map<string, { count: number; deckIds: string[] }>> {
  const terms = new Map<string, { count: number; deckIds: string[] }>();
  for (const collection of await getAllCollections()) {
    if (collection.targetLanguage !== langCode) continue;
    for (const deck of await getDecksByCollection(collection.id)) {
      for (const note of await getNotesByDeck(deck.id)) {
        const term = normalizeTerm(note.targetWord);
        if (!term) continue;
        const entry = terms.get(term) ?? { count: 0, deckIds: [] };
        entry.count += 1;
        if (!entry.deckIds.includes(deck.id)) entry.deckIds.push(deck.id);
        terms.set(term, entry);
      }
    }
  }
  return terms;
}

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
        void broadcastSrsCardsChanged(ctx, parsed.data.targetLanguage);
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
        const scanned = (await scanCardTermsByDeck(langCode)).get(needle);
        let count = scanned?.count ?? 0;
        const ankiLinks = await getLinksByTerm(needle).catch(() => [] as const);
        count += ankiLinks.filter((link) => link.langCode === langCode).length;
        return { success: true, data: { count, deckIds: scanned?.deckIds ?? [] } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.SRS_CARDS_TERMS,
    async (request): Promise<MessageResponse<SrsCardsTermsResult>> => {
      const parsed = SrsCardsTermsPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid SRS_CARDS_TERMS payload: ${parsed.error.message}` };
      }
      try {
        const { langCode } = parsed.data;
        const terms = new Set((await scanCardTermsByDeck(langCode)).keys());
        const ankiLinks = await getAllLinks().catch(() => [] as const);
        for (const link of ankiLinks) {
          if (link.langCode === langCode && link.term) terms.add(link.term);
        }
        return { success: true, data: { terms: [...terms] } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    },
  );

  // Extension pages that mutate the SRS stores directly (srs-study deck
  // deletes bypass message handlers) ask the background to rebroadcast so
  // tokenized pages repaint their card layer.
  ctx.on(
    MESSAGE_TYPES.SRS_CARDS_CHANGED,
    async (request): Promise<MessageResponse> => {
      const parsed = SrsCardsChangedPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid SRS_CARDS_CHANGED payload: ${parsed.error.message}` };
      }
      void broadcastSrsCardsChanged(ctx, parsed.data.langCode);
      return { success: true };
    },
  );
}
