import type { SrsCollection, SrsFieldValue, SrsNotetype, SrsStudyConfig } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { addNoteAndCard } from '@/features/srs/logic/cardCreation';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import { getDeck } from '@/features/srs/repositories/deckRepository';
import { getNotetype } from '@/features/srs/repositories/notetypeRepository';
import { getStudyConfig } from '@/features/srs/repositories/studyConfigRepository';

export interface SrsAddNoteMessageInput {
  readonly targetLanguage: string;
  readonly collectionId?: string;
  readonly deckId?: string;
  readonly notetypeId?: string;
  readonly targetWord: string;
  readonly fields: Record<string, SrsFieldValue>;
}

export interface SrsAddNoteMessageResult {
  readonly noteId: string;
  readonly cardId: string;
}

const adapter = createSrsFsrsAdapter();

/**
 * Create a note + 3-component card from an external message.
 *
 * V1: if `collectionId` is omitted, `ensureFirstRun()` is used with the active
 * language profile. Multi-language collection auto-creation is a known ceiling;
 * callers that want a specific target language should pass `collectionId`.
 */
export async function addNoteFromMessage(input: SrsAddNoteMessageInput): Promise<SrsAddNoteMessageResult> {
  const { collection, deck, notetype, studyConfig } = await resolveTargets(input);

  if (notetype.collectionId !== collection.id) {
    throw new SrsError('INVALID_INPUT', 'Notetype does not belong to the collection');
  }
  if (deck.collectionId !== collection.id) {
    throw new SrsError('INVALID_INPUT', 'Deck does not belong to the collection');
  }

  const now = new Date();
  const { note, card } = await addNoteAndCard(
    collection,
    deck.id,
    notetype,
    input.targetWord,
    input.fields,
    studyConfig,
    now,
    adapter,
  );

  return { noteId: note.id, cardId: card.id };
}

interface ResolvedTargets {
  collection: SrsCollection;
  deck: { id: string; collectionId: string };
  notetype: SrsNotetype;
  studyConfig: SrsStudyConfig;
}

async function resolveTargets(input: SrsAddNoteMessageInput): Promise<ResolvedTargets> {
  if (input.collectionId && input.deckId && input.notetypeId) {
    const [collection, deck, notetype, studyConfig] = await Promise.all([
      getCollection(input.collectionId),
      getDeck(input.deckId),
      getNotetype(input.notetypeId),
      loadStudyConfigForCollection(input.collectionId),
    ]);
    return { collection, deck, notetype, studyConfig };
  }

  const firstRun = await ensureFirstRun();
  const collection = await getCollection(firstRun.collectionId);
  const notetype = input.notetypeId ? await getNotetype(input.notetypeId) : await getNotetype(firstRun.notetypeId);
  const deck = input.deckId ? await getDeck(input.deckId) : { id: firstRun.deckId, collectionId: collection.id };
  const studyConfig = await getStudyConfig(firstRun.studyConfigId);

  return { collection, deck, notetype, studyConfig };
}

async function loadStudyConfigForCollection(collectionId: string): Promise<SrsStudyConfig> {
  const collection = await getCollection(collectionId);
  return getStudyConfig(collection.defaultStudyConfigId);
}
