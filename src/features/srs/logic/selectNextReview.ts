import type { ComponentType, Pool, PoolCandidate, SrsAudioAsset, SrsFsrsAdapter, SrsImageAsset, SrsReviewSession, SrsStudyConfig } from '@/entities/srs/types';
import type { SrsCard } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { FUTURE_ISO, minISO } from '@/features/srs/lib/helpers';
import { getCardIdsByDeckDueBefore, getCardsByIds } from '@/features/srs/repositories/cardRepository';
import { getDeck, getSubDecks } from '@/features/srs/repositories/deckRepository';
import { getNotesByIds } from '@/features/srs/repositories/noteRepository';
import { getNotetypesByIds } from '@/features/srs/repositories/notetypeRepository';
import { resolvePool } from './resolvePool';
import { pickHighestPriority } from './pickHighestPriority';
import { resolveReviewSurface } from './resolveReviewSurface';
import { loadNoteAssets } from '@/features/srs/services/noteAssetLoader';

const COMPONENT_TYPES: readonly ComponentType[] = ['sound', 'meaning', 'spelling'];

/** Resolve the set of deck IDs to study, optionally including all descendants. */
async function resolveDeckIds(rootDeckId: string | null, includeSubdecks: boolean): Promise<string[]> {
  if (!rootDeckId) return [];

  const root = await getDeck(rootDeckId);
  const result = [root.id];

  if (includeSubdecks) {
    const queue = [root.id];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const subDecks = await getSubDecks(parentId);
      for (const deck of subDecks) {
        result.push(deck.id);
        queue.push(deck.id);
      }
    }
  }

  return result;
}

function effectiveDueFor(card: SrsCard, type: ComponentType, adapter: SrsFsrsAdapter): string {
  const comp = card.components[type];
  const fsrsDue = adapter.getDue(comp.fsrsState);
  const studyAgain = card.studyAgainDue[type];
  return minISO(fsrsDue, studyAgain ?? FUTURE_ISO);
}

/** Pick the next review session from a deck (and optionally its subdecks). */
export async function selectNextReview(
  rootDeckId: string | null,
  includeSubdecks: boolean,
  config: SrsStudyConfig,
  now: string,
  adapter: SrsFsrsAdapter,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
  maxScan = 1000,
): Promise<SrsReviewSession | null> {
  const deckIds = await resolveDeckIds(rootDeckId, includeSubdecks);
  if (deckIds.length === 0) return null;

  const cardIds: string[] = [];
  for (const deckId of deckIds) {
    if (cardIds.length >= maxScan) break;
    const remaining = maxScan - cardIds.length;
    const ids = await getCardIdsByDeckDueBefore(deckId, now, remaining);
    cardIds.push(...ids);
  }

  const cards = await getCardsByIds(cardIds);
  const noteIds = Array.from(new Set(cards.map((c) => c.noteId)));
  const notes = await getNotesByIds(noteIds);
  const notetypeIds = Array.from(new Set(notes.map((n) => n.notetypeId)));
  const notetypes = await getNotetypesByIds(notetypeIds);

  const candidates: PoolCandidate[] = [];
  for (const card of cards) {
    const note = notes.find((n) => n.id === card.noteId);
    const notetype = note ? notetypes.find((nt) => nt.id === note.notetypeId) : undefined;
    if (!note || !notetype) continue;

    for (const type of COMPONENT_TYPES) {
      const pool: Pool | null = resolvePool(card, type, now, config, adapter);
      if (!pool) continue;
      const effectiveDue = effectiveDueFor(card, type, adapter);
      const comp = card.components[type];
      candidates.push({
        card,
        note,
        notetype,
        componentType: type,
        effectiveDue,
        progress: comp.progress,
        pool,
      });
    }
  }

  const winner = pickHighestPriority(candidates);
  if (!winner) return null;

  const audioMap = new Map<string, SrsAudioAsset>(audioCache);
  const imageMap = new Map<string, SrsImageAsset>(imageCache);
  await loadNoteAssets(winner.note, audioMap, imageMap);

  const surface = resolveReviewSurface(winner.note, winner.notetype, winner.componentType, audioMap, imageMap);
  if (!surface) {
    throw new SrsError('NO_TEMPLATE', `No usable template for ${winner.componentType} on note ${winner.note.id}`);
  }

  const { template, stimulus } = surface;
  const mode = poolToMode(winner.pool);
  const startedAt = Date.now();

  return {
    card: winner.card,
    note: winner.note,
    notetype: winner.notetype,
    componentType: winner.componentType,
    template,
    stimulus,
    mode,
    startedAt,
  };
}

function poolToMode(pool: Pool): SrsReviewSession['mode'] {
  if (pool === 'explore') return 'explore';
  if (pool === 'studyAgain') return 'studyAgain';
  return 'normal';
}
