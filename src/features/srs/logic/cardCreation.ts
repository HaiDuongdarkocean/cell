import type { SrsCard, SrsCollection, SrsFieldValue, SrsNote, SrsNotetype, SrsStudyConfig } from '@/entities/srs/types';
import type { SrsFsrsAdapter } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { generateId } from '@/features/srs/lib/helpers';
import { getNoteByTargetAndNotetype, putNote } from '@/features/srs/repositories/noteRepository';
import { getCardByNoteAndDeck, putCard } from '@/features/srs/repositories/cardRepository';
import { cacheNoteFields } from '@/features/srs/services/noteAssetLoader';
import { createCard } from './reviewEngine';

export interface AddNoteAndCardResult {
  readonly note: SrsNote;
  readonly card: SrsCard;
}

/** Add a new note and its card, or create a new card for an existing note in a different deck. */
export async function addNoteAndCard(
  collection: SrsCollection,
  deckId: string,
  notetype: SrsNotetype,
  targetWord: string,
  fields: Record<string, SrsFieldValue>,
  config: SrsStudyConfig,
  now: Date,
  adapter: SrsFsrsAdapter,
): Promise<AddNoteAndCardResult> {
  if (notetype.collectionId !== collection.id) {
    throw new SrsError('INVALID_INPUT', 'Notetype does not belong to the collection');
  }

  const existingNote = await getNoteByTargetAndNotetype(targetWord, notetype.id);
  if (existingNote) {
    const existingCard = await getCardByNoteAndDeck(existingNote.id, deckId);
    if (existingCard) throw new SrsError('DUPLICATE', 'Card already exists in this deck.');
    const card = createCard(existingNote, deckId, config, now, adapter);
    await putCard(card);
    return { note: existingNote, card };
  }

  const note: SrsNote = {
    id: generateId(),
    notetypeId: notetype.id,
    deckId,
    targetWord,
    fields,
    createdAt: now.getTime(),
  };
  await putNote(note);
  await cacheNoteFields(note);

  const card = createCard(note, deckId, config, now, adapter);
  await putCard(card);

  return { note, card };
}
