import type { NormalizedAnkiCard, NormalizedAnkiData, NormalizedAnkiDeck } from '../model/normalized';

/** 'Languages::Japanese::Core2k' → 'Languages › Japanese › Core2k' */
export function flattenDeckName(raw: string): string {
  return raw
    .split('::')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' › ');
}

export interface DeckPickerRow {
  readonly deck: NormalizedAnkiDeck;
  readonly flatName: string;
  readonly counts: {
    readonly total: number;
    readonly new: number;
    readonly learning: number;
    readonly review: number;
    readonly suspended: number;
    readonly buried: number;
  };
}

/**
 * Per-deck card counts for the picker. Suspended/buried counted separately —
 * suspended will be skipped, buried imported under their `type`.
 */
export function buildDeckPickerRows(data: NormalizedAnkiData): DeckPickerRow[] {
  const homeDeckById = new Map(data.decks.map((d) => [d.id, d]));
  const counts = new Map<string, { total: number; new: number; learning: number; review: number; suspended: number; buried: number }>();

  for (const card of data.cards) {
    const deckId = resolveHomeDeckId(card, homeDeckById);
    if (deckId === null) continue;
    const c = counts.get(deckId) ?? { total: 0, new: 0, learning: 0, review: 0, suspended: 0, buried: 0 };
    c.total += 1;
    if (card.queue === -1) c.suspended += 1;
    else if (card.queue === -2 || card.queue === -3) c.buried += 1;
    else if (card.type === 0) c.new += 1;
    else if (card.type === 2) c.review += 1;
    else c.learning += 1;
    counts.set(deckId, c);
  }

  return data.decks
    .filter((d) => !d.filtered)
    .map((deck) => ({
      deck,
      flatName: flattenDeckName(deck.name),
      counts: counts.get(deck.id) ?? { total: 0, new: 0, learning: 0, review: 0, suspended: 0, buried: 0 },
    }));
}

/**
 * Effective home deck for a card: filtered-deck cards route to `odid` first;
 * when `odid` is itself filtered/missing we walk to the card's `deckId`.
 * Returns null when no importable deck owns the card.
 */
export function resolveHomeDeckId(
  card: Pick<NormalizedAnkiCard, 'deckId' | 'odid'>,
  decksById: ReadonlyMap<string, NormalizedAnkiDeck>,
): string | null {
  const home = decksById.get(card.deckId);
  if (home && !home.filtered) return home.id;
  if (card.odid !== 0) {
    const orig = decksById.get(String(card.odid));
    if (orig && !orig.filtered) return orig.id;
  }
  return null;
}

/** Disambiguate flattened names that collide (e.g. 'A::B' and 'A › B' literal). */
export function uniqueDeckNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    return n === 0 ? name : `${name} (${n + 1})`;
  });
}
