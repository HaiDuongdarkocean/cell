import type { Pool, PoolCandidate, SrsAudioAsset, SrsFsrsAdapter, SrsImageAsset, SrsReviewSession, SrsStudyConfig, SrsVariant, SrsVariantToggles, VariantId } from '@/entities/srs/types';
import type { SrsCard } from '@/entities/srs/types';
import { FUTURE_ISO, minISO } from '@/features/srs/lib/helpers';
import { getCardIdsByDeckDueBefore, getCardsByIds } from '@/features/srs/repositories/cardRepository';
import { getDeck, getDecksByCollection, getSubDecks } from '@/features/srs/repositories/deckRepository';
import { getNotesByIds } from '@/features/srs/repositories/noteRepository';
import { getNotetypesByIds } from '@/features/srs/repositories/notetypeRepository';
import { getVariantPresetForDeck } from '@/features/srs/repositories/variantPresetRepository';
import { isVariantServable, resolveVariantToggles, servableVariantIds } from '@/features/srs/lib/variantFront';
import { resolvePool } from './resolvePool';
import { orderCandidates } from './pickHighestPriority';
import { buildVariantStimulus } from './resolveReviewSurface';
import { loadNoteAssets } from '@/features/srs/services/noteAssetLoader';

/** Resolve the set of deck IDs to study, optionally including all descendants. */
async function resolveDeckIds(rootDeckId: string | null, includeSubdecks: boolean, collectionId?: string): Promise<string[]> {
  if (!rootDeckId) {
    if (!collectionId) return [];
    const decks = await getDecksByCollection(collectionId);
    return decks.map((d) => d.id);
  }

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

function effectiveDueFor(card: SrsCard, type: VariantId, adapter: SrsFsrsAdapter): string {
  const comp = card.components[type];
  const fsrsDue = adapter.getDue(comp.fsrsState);
  const studyAgain = card.studyAgainDue[type];
  return minISO(fsrsDue, studyAgain ?? FUTURE_ISO);
}

export interface SelectNextReviewOptions {
  readonly shuffle?: boolean;
  readonly startWith?: 'reviews' | 'new';
  /** Persisted per-variant toggle prefs — applied when the note material still offers the option. */
  readonly variantToggles?: Readonly<Record<VariantId, SrsVariantToggles>>;
  /** Global loops override (Settings → "new cards need N passes") — wins over per-variant newLoops. */
  readonly newLoopsOverride?: number;
}

function withLoopOverride(variants: readonly SrsVariant[], override?: number): readonly SrsVariant[] {
  if (override === undefined || override === null) return variants;
  return variants.map((v) => (v.newLoops === override ? v : { ...v, newLoops: override }));
}

/** Pick the next review session from a deck (and optionally its subdecks), or across a whole collection when `rootDeckId` is null and `collectionId` is given. */
export async function selectNextReview(
  rootDeckId: string | null,
  includeSubdecks: boolean,
  config: SrsStudyConfig,
  now: string,
  adapter: SrsFsrsAdapter,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
  maxScan = 1000,
  options: SelectNextReviewOptions = {},
  collectionId?: string,
): Promise<SrsReviewSession | null> {
  const deckIds = await resolveDeckIds(rootDeckId, includeSubdecks, collectionId);
  if (deckIds.length === 0) return null;

  const variantsByDeck = new Map<string, readonly SrsVariant[]>();
  for (const deckId of deckIds) {
    const preset = await getVariantPresetForDeck(deckId);
    variantsByDeck.set(deckId, withLoopOverride(preset.variants, options.newLoopsOverride));
  }

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
    const variants = variantsByDeck.get(card.deckId);
    const note = notes.find((n) => n.id === card.noteId);
    const notetype = note ? notetypes.find((nt) => nt.id === note.notetypeId) : undefined;
    if (!variants || !note || !notetype) continue;

    const servable = servableVariantIds(variants, note, notetype);

    for (const variant of variants) {
      const pool: Pool | null = resolvePool(card, variant.id, variants, servable, now, config, adapter);
      if (!pool) continue;
      const comp = card.components[variant.id];
      if (!comp) continue;
      candidates.push({
        card,
        note,
        notetype,
        componentType: variant.id,
        effectiveDue: effectiveDueFor(card, variant.id, adapter),
        progress: comp.progress,
        pool,
      });
    }
  }

  const audioMap = new Map<string, SrsAudioAsset>(audioCache);
  const imageMap = new Map<string, SrsImageAsset>(imageCache);

  const loadedNotes = new Set<string>();
  for (const candidate of orderCandidates(candidates, options)) {
    const variants = variantsByDeck.get(candidate.card.deckId)!;
    const variant = variants.find((v) => v.id === candidate.componentType)!;

    if (!loadedNotes.has(candidate.note.id)) {
      await loadNoteAssets(candidate.note, audioMap, imageMap);
      loadedNotes.add(candidate.note.id);
    }
    const built = buildVariantStimulus(candidate.note, variant, audioMap, imageMap);
    if (!built) continue;

    // Re-derive toggles on material that actually resolved — dead assets degrade options.
    const resolvedServable = isVariantServable(variant, built.resolvedNote, candidate.notetype);
    if (!resolvedServable) continue;
    const toggles = resolveVariantToggles(
      variant,
      built.resolvedNote,
      options.variantToggles?.[variant.id],
    );

    return {
      card: candidate.card,
      note: candidate.note,
      notetype: candidate.notetype,
      variant,
      variants,
      toggles,
      stimulus: built.stimulus,
      mode: poolToMode(candidate.pool),
      startedAt: Date.now(),
    };
  }

  return null;
}

function poolToMode(pool: Pool): SrsReviewSession['mode'] {
  if (pool === 'explore') return 'explore';
  if (pool === 'studyAgain') return 'studyAgain';
  return 'normal';
}
