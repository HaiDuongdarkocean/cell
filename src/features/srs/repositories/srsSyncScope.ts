import { captureChange, readRecordMeta, scopeForTarget, targetOf, type Scope } from '@/features/sync';
import type { SrsCard, SrsCollection, SrsDeck, SrsNote, SrsReviewRecord } from '@/entities/srs/types';
import { SRS_STORES } from './srsDatabase';
import { getById } from './srsRepositoryHelpers';

type AnySrsAsset = { noteId: string };

export async function collectionScope(collection: SrsCollection): Promise<Scope> {
  return scopeForTarget(targetOf(collection.targetLanguage));
}

export async function scopeOfCollection(tx: IDBTransaction, collectionId: string): Promise<Scope | null> {
  const collection = await getById<SrsCollection>(tx.objectStore(SRS_STORES.COLLECTIONS), collectionId);
  return collection ? scopeForTarget(targetOf(collection.targetLanguage)) : null;
}

export async function scopeOfDeck(tx: IDBTransaction, deckId: string): Promise<Scope | null> {
  const deck = await getById<SrsDeck>(tx.objectStore(SRS_STORES.DECKS), deckId);
  return deck ? scopeOfCollection(tx, deck.collectionId) : null;
}

export async function scopeOfNote(tx: IDBTransaction, noteId: string): Promise<Scope | null> {
  const note = await getById<SrsNote>(tx.objectStore(SRS_STORES.NOTES), noteId);
  return note ? scopeOfDeck(tx, note.deckId) : null;
}

export async function scopeOfCard(tx: IDBTransaction, card: SrsCard): Promise<Scope | null> {
  return scopeOfDeck(tx, card.deckId);
}

export async function scopeOfReviewEvent(tx: IDBTransaction, event: SrsReviewRecord): Promise<Scope | null> {
  const card = await getById<SrsCard>(tx.objectStore(SRS_STORES.CARDS), event.cardId);
  return card ? scopeOfCard(tx, card) : scopeOfNote(tx, event.noteId);
}

export async function scopeOfAsset(tx: IDBTransaction, asset: AnySrsAsset): Promise<Scope | null> {
  return scopeOfNote(tx, asset.noteId);
}

export async function studyConfigScopes(tx: IDBTransaction, configId: string): Promise<Scope[]> {
  const collections = await getAll<SrsCollection>(tx.objectStore(SRS_STORES.COLLECTIONS));
  const decks = await getAll<SrsDeck>(tx.objectStore(SRS_STORES.DECKS));
  const scopes = new Set<Scope>();
  for (const collection of collections) {
    if (collection.defaultStudyConfigId === configId) {
      scopes.add(scopeForTarget(targetOf(collection.targetLanguage)));
    }
  }
  for (const deck of decks) {
    if (deck.studyConfigId === configId) {
      const scope = await scopeOfCollection(tx, deck.collectionId);
      if (scope) scopes.add(scope);
    }
  }
  return [...scopes];
}

export async function announceStudyConfig(
  store: IDBObjectStore,
  scope: Scope | null,
  configId: string,
): Promise<void> {
  const key = `studyConfigs:${configId}`;
  const meta = await readRecordMeta(store, key, scope);
  if (meta?.op !== 'put') {
    await captureChange(store, { scope, dataClass: 'studyConfig', key, op: 'put' });
  }
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}
