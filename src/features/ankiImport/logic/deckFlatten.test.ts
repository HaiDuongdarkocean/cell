import { flattenDeckName, buildDeckPickerRows, resolveHomeDeckId, uniqueDeckNames } from './deckFlatten';
import type { NormalizedAnkiData, NormalizedAnkiDeck } from '../model/normalized';

const decks: NormalizedAnkiDeck[] = [
  { id: '1', name: 'Languages::Japanese::Core2k', filtered: false },
  { id: '2', name: 'Languages::Japanese::Mining', filtered: false },
  { id: '9', name: 'Filtered deck', filtered: true },
];

const card = (over: Partial<Parameters<typeof buildDeckPickerRows>[0]['cards'][number]>) => ({
  id: 1, noteId: 1, deckId: '1', ord: 0, type: 2, queue: 2,
  due: 0, ivl: 10, factor: 2500, reps: 5, lapses: 0, left: 0, odid: 0, ...over,
});

const data = (cards: ReturnType<typeof card>[]): NormalizedAnkiData => ({
  source: 'apkg', fidelity: 'full', hasScheduling: true, crtMs: 0,
  decks, notetypes: [], notes: [], cards, revlog: [],
  media: { names: [], resolve: async () => null },
});

describe('flattenDeckName', () => {
  it('flattens :: hierarchy', () => {
    expect(flattenDeckName('Languages::Japanese::Core2k')).toBe('Languages › Japanese › Core2k');
    expect(flattenDeckName('Solo')).toBe('Solo');
    expect(flattenDeckName('A:: ::B')).toBe('A › B');
  });
});

describe('buildDeckPickerRows', () => {
  it('counts per state, excludes filtered decks, routes their cards via odid', () => {
    const rows = buildDeckPickerRows(data([
      card({ id: 1 }),
      card({ id: 2, type: 0, queue: 0 }),
      card({ id: 3, type: 1, queue: 1 }),
      card({ id: 4, queue: -1 }),
      card({ id: 5, queue: -2 }),
      card({ id: 6, deckId: '9', odid: 1 }), // filtered → home deck 1
    ]));
    expect(rows.map((r) => r.deck.id)).toEqual(['1', '2']);
    const core = rows[0]!;
    expect(core.flatName).toBe('Languages › Japanese › Core2k');
    expect(core.counts).toEqual({ total: 6, new: 1, learning: 1, review: 2, suspended: 1, buried: 1 });
    expect(rows[1]!.counts.total).toBe(0);
  });
});

describe('resolveHomeDeckId', () => {
  const byId = new Map(decks.map((d) => [d.id, d]));
  it('normal card → own deck', () => {
    expect(resolveHomeDeckId({ deckId: '1', odid: 0 }, byId)).toBe('1');
  });
  it('filtered card → odid', () => {
    expect(resolveHomeDeckId({ deckId: '9', odid: 2 }, byId)).toBe('2');
  });
  it('filtered card, odid filtered → null', () => {
    expect(resolveHomeDeckId({ deckId: '9', odid: 9 }, byId)).toBeNull();
    expect(resolveHomeDeckId({ deckId: '9', odid: 0 }, byId)).toBeNull();
  });
});

describe('uniqueDeckNames', () => {
  it('suffixes collisions', () => {
    expect(uniqueDeckNames(['A › B', 'A › B', 'C'])).toEqual(['A › B', 'A › B (2)', 'C']);
  });
});
