import { deleteCollection } from './collectionRepository';
import { deleteDeck, getDecksByCollection, getDecksByParent } from './deckRepository';
import { deleteNote, getNotesByDeck } from './noteRepository';
import { deleteCard, getCardsByNote } from './cardRepository';
import { deleteReviewEvent, getReviewEventsByCard } from './reviewEventRepository';
import { deleteAudioAsset, getAudioAssetsByNote } from './audioAssetRepository';
import { deleteImageAsset, getImageAssetsByNote } from './imageAssetRepository';

/** Delete a card and all its review events. */
export async function deleteCardCascade(cardId: string): Promise<void> {
  const events = await getReviewEventsByCard(cardId);
  for (const event of events) {
    await deleteReviewEvent(event.id);
  }
  await deleteCard(cardId);
}

/** Delete a note, its cards + review events, and its audio/image assets. */
export async function deleteNoteCascade(noteId: string): Promise<void> {
  const cards = await getCardsByNote(noteId);
  for (const card of cards) {
    await deleteCardCascade(card.id);
  }

  const audioAssets = await getAudioAssetsByNote(noteId);
  for (const asset of audioAssets) {
    await deleteAudioAsset(asset.id);
  }

  const imageAssets = await getImageAssetsByNote(noteId);
  for (const asset of imageAssets) {
    await deleteImageAsset(asset.id);
  }

  await deleteNote(noteId);
}

/** Delete a deck, its subdecks, and all their notes/cards/assets/events. */
export async function deleteDeckCascade(deckId: string): Promise<void> {
  // Delete subdecks first so parent deletion is clean.
  const subDecks = await getDecksByParent(deckId);
  for (const sub of subDecks) {
    await deleteDeckCascade(sub.id);
  }

  const notes = await getNotesByDeck(deckId);
  for (const note of notes) {
    await deleteNoteCascade(note.id);
  }

  await deleteDeck(deckId);
}

/** Delete a collection, all its decks, notes, cards, assets, and review events. */
export async function deleteCollectionCascade(collectionId: string): Promise<void> {
  const decks = await getDecksByCollection(collectionId);
  // Only root decks; deleteDeckCascade will recurse into children.
  for (const deck of decks) {
    if (deck.parentId === null) {
      await deleteDeckCascade(deck.id);
    }
  }
  await deleteCollection(collectionId);
}
