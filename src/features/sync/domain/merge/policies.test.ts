import type { ChangeRecord, DataClass, Hlc } from '../types';
import {
  compareApplyOrder,
  DATA_CLASS_APPLY_ORDER,
  sortRecordsForApply,
} from './applyOrder';
import { mergeRecord } from './mergeRecord';
import {
  mergeProfileConfig,
  mergeReaderProgress,
  mergeSrsCard,
  mergeSrsReviewEvent,
  profileExists,
  profileFieldMaterializable,
  profileRecordsOf,
} from './policies';

const h = (wall: number, counter = 0, node = 'a'): Hlc => ({ wall, counter, node });

const rec = (partial: Partial<ChangeRecord> = {}): ChangeRecord => ({
  scope: 'global',
  dataClass: 'settings',
  key: 'k1',
  op: 'put',
  hlc: h(1),
  ...partial,
});

interface CompOpts {
  readonly lastReview?: string;
  readonly reviewCount?: number;
  readonly exploreCount?: number;
  readonly progress?: number;
}

const comp = (opts: CompOpts = {}): Record<string, unknown> => ({
  type: 'meaning',
  progress: opts.progress ?? 0,
  exploreCount: opts.exploreCount ?? 0,
  reviewCount: opts.reviewCount ?? 0,
  fsrsState: {
    due: '2024-01-01T00:00:00.000Z',
    stability: 1,
    difficulty: 1,
    ...(opts.lastReview === undefined ? {} : { lastReview: opts.lastReview }),
  },
});

const card = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'card1',
  noteId: 'note1',
  deckId: 'deck1',
  createdAt: 1000,
  components: { meaning: comp(), sound: comp(), spelling: comp() },
  studyAgainDue: { meaning: null, sound: null, spelling: null },
  nextDue: '2024-01-01T00:00:00.000Z',
  maintenanceMode: false,
  ...over,
});

interface MergedCard {
  readonly noteId: string;
  readonly deckId: string;
  readonly createdAt: number;
  readonly nextDue: string;
  readonly components: Record<
    string,
    { readonly progress: number; readonly exploreCount: number }
  >;
  readonly studyAgainDue: Record<string, string | null>;
}

const mergedCard = (record: ChangeRecord | null): MergedCard => record?.value as MergedCard;

describe('mergeLww (default policy)', () => {
  it('picks the record with the higher HLC', () => {
    const older = rec({ hlc: h(3), value: 'old' });
    const newer = rec({ hlc: h(7), value: 'new' });
    expect(mergeRecord(older, newer)).toEqual(newer);
    expect(mergeRecord(newer, older)).toEqual(newer);
  });

  it('keeps local when its HLC is newer', () => {
    const local = rec({ hlc: h(9), value: 'local' });
    const remote = rec({ hlc: h(4), value: 'remote' });
    expect(mergeRecord(local, remote)).toBe(local);
  });

  it('returns remote when there is no local record', () => {
    const remote = rec({ hlc: h(2), value: 'v' });
    expect(mergeRecord(null, remote)).toBe(remote);
  });

  it('resolves tombstone vs put by HLC', () => {
    const put = rec({ hlc: h(5), value: 'v' });
    const tombstone = rec({ op: 'delete', hlc: h(8), value: undefined });
    expect(mergeRecord(put, tombstone)).toEqual(tombstone);
    expect(mergeRecord(tombstone, rec({ hlc: h(6), value: 'v' }))).toEqual(tombstone);
    const newerPut = rec({ hlc: h(10), value: 'v' });
    expect(mergeRecord(tombstone, newerPut)).toEqual(newerPut);
  });

  it('keeps a tombstone for a key never seen locally', () => {
    const tombstone = rec({ op: 'delete', hlc: h(3) });
    expect(mergeRecord(null, tombstone)).toBe(tombstone);
  });

  it('applies to kv settings, sync directory, dict fields, book fields, word status', () => {
    const classes: Array<[DataClass, string]> = [
      ['settings', 'kv:settings/subtitlePreference'],
      ['secondaryKey', 'kv:themeMode/mode'],
      ['syncDirectory', 'connection:google-drive:acct'],
      ['syncDirectory', 'binding:en'],
      ['syncDirectory', 'systemConnection'],
      ['studyConfig', 'studyConfigs:sc1'],
      ['srsCollection', 'collections:c1'],
      ['srsDeck', 'decks:d1'],
      ['srsNotetype', 'notetypes:nt1'],
      ['srsNote', 'notes:n1'],
      ['srsAudioAsset', 'audioAssets:a1'],
      ['srsImageAsset', 'imageAssets:i1'],
      ['dictResource', 'resource:abc123'],
      ['dictResource', 'resource:abc123/name'],
      ['dictResource', 'resource:abc123/enabled'],
      ['wordStatus', 'word:犬'],
      ['readerBook', 'book:b1'],
      ['readerBook', 'book:b1/title'],
    ];
    for (const [dataClass, key] of classes) {
      const older = rec({ dataClass, key, hlc: h(1), value: 'a' });
      const newer = rec({ dataClass, key, hlc: h(2), value: 'b' });
      expect(mergeRecord(older, newer)).toEqual(newer);
      expect(mergeRecord(newer, older)).toEqual(newer);
      const tomb = rec({ dataClass, key, op: 'delete', hlc: h(3) });
      expect(mergeRecord(newer, tomb)).toEqual(tomb);
    }
  });
});

describe('profileConfig policy', () => {
  const tombstone = rec({ dataClass: 'profileConfig', key: 'profile', op: 'delete', hlc: h(10) });
  const recreate = rec({ dataClass: 'profileConfig', key: 'profile', op: 'put', hlc: h(20), value: { target: 'en' } });

  it('resolves the existence key by plain LWW', () => {
    const put = rec({ dataClass: 'profileConfig', key: 'profile', op: 'put', hlc: h(5) });
    expect(mergeProfileConfig(put, tombstone, {})).toEqual(tombstone);
    expect(mergeProfileConfig(tombstone, recreate, {})).toEqual(recreate);
  });

  it('discards field puts older than the latest profile tombstone', () => {
    const staleField = rec({ dataClass: 'profileConfig', key: 'profile/native', hlc: h(5), value: 'vi' });
    const ctx = { tombstone };
    expect(mergeProfileConfig(null, staleField, ctx)).toBeNull();
    const local = rec({ dataClass: 'profileConfig', key: 'profile/native', hlc: h(12), value: 'en' });
    expect(mergeProfileConfig(local, staleField, ctx)).toEqual(local);
    expect(mergeRecord(null, staleField, { profile: ctx })).toBeNull();
  });

  it('stores a field put newer than the tombstone but gates materialization on a newer profile put', () => {
    const field = rec({ dataClass: 'profileConfig', key: 'profile/native', hlc: h(15), value: 'en' });
    const ctx = { tombstone };
    expect(mergeProfileConfig(null, field, ctx)).toEqual(field);
    expect(profileFieldMaterializable(field, ctx)).toBe(false);
    expect(profileFieldMaterializable(field, { tombstone, put: recreate })).toBe(true);
    expect(profileFieldMaterializable(field, {})).toBe(false);
  });

  it('suppresses a dead local field put symmetrically', () => {
    const deadLocal = rec({ dataClass: 'profileConfig', key: 'profile/native', hlc: h(4), value: 'x' });
    const deadRemote = rec({ dataClass: 'profileConfig', key: 'profile/native', hlc: h(6), value: 'y' });
    const ctx = { tombstone };
    expect(mergeProfileConfig(deadLocal, deadRemote, ctx)).toBeNull();
    const aliveRemote = rec({ dataClass: 'profileConfig', key: 'profile/native', hlc: h(15), value: 'z' });
    expect(mergeProfileConfig(deadLocal, aliveRemote, ctx)).toEqual(aliveRemote);
  });

  it('still merges field tombstones by HLC', () => {
    const fieldTomb = rec({ dataClass: 'profileConfig', key: 'profile/native', op: 'delete', hlc: h(6) });
    const put = rec({ dataClass: 'profileConfig', key: 'profile/native', hlc: h(5), value: 'v' });
    expect(mergeProfileConfig(put, fieldTomb, { tombstone })).toEqual(fieldTomb);
  });

  it('profileExists reflects the latest existence record', () => {
    expect(profileExists({})).toBe(false);
    expect(profileExists({ put: recreate })).toBe(true);
    expect(profileExists({ tombstone })).toBe(false);
    expect(profileExists({ put: recreate, tombstone })).toBe(true);
    const newerTomb = rec({ dataClass: 'profileConfig', key: 'profile', op: 'delete', hlc: h(30) });
    expect(profileExists({ put: recreate, tombstone: newerTomb })).toBe(false);
    expect(profileRecordsOf(recreate)).toEqual({ put: recreate });
    expect(profileRecordsOf(tombstone)).toEqual({ tombstone });
    expect(profileRecordsOf(null)).toEqual({});
  });
});

describe('mergeSrsCard', () => {
  const cardRec = (
    hlcV: Hlc,
    value: Record<string, unknown>,
    firstHlc: Hlc = h(1),
  ): ChangeRecord =>
    rec({ dataClass: 'srsCard', key: 'cards:c1', scope: 'profile:en', hlc: hlcV, value, firstHlc });

  it('put vs tombstone resolves by record HLC', () => {
    const put = cardRec(h(5), card());
    const tomb = rec({ dataClass: 'srsCard', key: 'cards:c1', op: 'delete', hlc: h(9) });
    expect(mergeSrsCard(put, tomb)).toEqual(tomb);
    expect(mergeSrsCard(tomb, put)).toEqual(tomb);
    const newerPut = cardRec(h(10), card());
    expect(mergeSrsCard(tomb, newerPut)).toEqual(newerPut);
  });

  it('suppresses a put that is dead relative to the key tombstone', () => {
    const tomb = rec({ dataClass: 'srsCard', key: 'cards:c1', op: 'delete', hlc: h(7) });
    const dead = cardRec(h(5), card({ deckId: 'dead' }), h(1));
    const live = cardRec(h(8), card({ deckId: 'live' }), h(8));
    expect(mergeSrsCard(null, dead, tomb)).toBeNull();
    expect(mergeSrsCard(live, dead, tomb)).toEqual(live);
    expect(mergeSrsCard(dead, live, tomb)).toEqual(live);
    expect(mergeRecord(dead, live, { keyTombstone: tomb })).toEqual(live);
  });

  it('keeps noteId/createdAt and takes deckId from the higher-HLC record', () => {
    const local = cardRec(h(5), card({ deckId: 'deck-a', noteId: 'note-old', createdAt: 111 }));
    const remote = cardRec(h(9), card({ deckId: 'deck-b', noteId: 'note-new', createdAt: 999 }));
    const winner = mergeSrsCard(local, remote);
    if (winner === null) throw new Error('expected a merged card');
    expect(winner.hlc).toEqual(h(9));
    expect(winner.firstHlc).toEqual(h(1));
    const value = mergedCard(winner);
    expect(value.deckId).toBe('deck-b');
    expect(value.noteId).toBe('note-new');
    expect(value.createdAt).toBe(111);
    const swapped = mergeSrsCard(remote, local);
    expect(mergedCard(swapped)).toEqual(value);
  });

  it('a put from a newer lifetime wins wholesale without component merge', () => {
    const local = cardRec(h(9), card({ deckId: 'deck-a' }), h(1));
    const remote = cardRec(h(3), card({ deckId: 'deck-b', components: { meaning: comp({ progress: 77 }), sound: comp(), spelling: comp() } }), h(6));
    const winner = mergeSrsCard(local, remote);
    expect(winner).toBe(remote);
    expect(mergeSrsCard(remote, local)).toBe(remote);
  });

  it('picks per-component winner by lastReview then reviewCount and carries its studyAgainDue', () => {
    const localCard = card({
      components: {
        meaning: comp({ lastReview: '2024-02-01T00:00:00.000Z', reviewCount: 3, progress: 11 }),
        sound: comp({ lastReview: '2024-01-01T00:00:00.000Z', reviewCount: 5, progress: 22 }),
        spelling: comp({ lastReview: '2024-03-01T00:00:00.000Z', reviewCount: 1, progress: 33 }),
      },
      studyAgainDue: { meaning: '2024-02-02T00:00:00.000Z', sound: null, spelling: null },
    });
    const remoteCard = card({
      components: {
        meaning: comp({ lastReview: '2024-01-15T00:00:00.000Z', reviewCount: 9, progress: 44 }),
        sound: comp({ lastReview: '2024-02-10T00:00:00.000Z', reviewCount: 2, progress: 55 }),
        spelling: comp({ lastReview: '2024-03-01T00:00:00.000Z', reviewCount: 7, progress: 66 }),
      },
      studyAgainDue: { meaning: null, sound: '2024-02-11T00:00:00.000Z', spelling: null },
    });
    const local = cardRec(h(5), localCard);
    const remote = cardRec(h(9), remoteCard);
    const value = mergedCard(mergeSrsCard(local, remote));
    expect(value.components.meaning.progress).toBe(11);
    expect(value.studyAgainDue.meaning).toBe('2024-02-02T00:00:00.000Z');
    expect(value.components.sound.progress).toBe(55);
    expect(value.studyAgainDue.sound).toBe('2024-02-11T00:00:00.000Z');
    expect(value.components.spelling.progress).toBe(66);
    expect(value.studyAgainDue.spelling).toBeNull();
  });

  it('treats absent fsrsState.lastReview as -infinity', () => {
    const localCard = card({ components: { meaning: comp({ reviewCount: 8, progress: 1 }), sound: comp({ reviewCount: 1 }), spelling: comp() } });
    const remoteCard = card({ components: { meaning: comp({ lastReview: '2020-01-01T00:00:00.000Z', reviewCount: 1, progress: 2 }), sound: comp({ reviewCount: 4, progress: 3 }), spelling: comp() } });
    const value = mergedCard(mergeSrsCard(cardRec(h(9), localCard), cardRec(h(2), remoteCard)));
    expect(value.components.meaning.progress).toBe(2);
    expect(value.components.sound.progress).toBe(3);
  });

  it('takes exploreCount as the max of both sides per component', () => {
    const localCard = card({
      components: {
        meaning: comp({ lastReview: '2024-02-01T00:00:00.000Z', exploreCount: 9, progress: 1 }),
        sound: comp({ exploreCount: 2 }),
        spelling: comp({ exploreCount: 1 }),
      },
    });
    const remoteCard = card({
      components: {
        meaning: comp({ lastReview: '2024-01-01T00:00:00.000Z', exploreCount: 4, progress: 2 }),
        sound: comp({ exploreCount: 7 }),
        spelling: comp({ exploreCount: 1 }),
      },
    });
    const value = mergedCard(mergeSrsCard(cardRec(h(5), localCard), cardRec(h(9), remoteCard)));
    expect(value.components.meaning.exploreCount).toBe(9);
    expect(value.components.sound.exploreCount).toBe(7);
  });

  it('is deterministic when component data ties on lastReview and reviewCount', () => {
    const localCard = card({ components: { meaning: comp({ lastReview: '2024-01-01T00:00:00.000Z', reviewCount: 3, progress: 1 }), sound: comp(), spelling: comp() } });
    const remoteCard = card({ components: { meaning: comp({ lastReview: '2024-01-01T00:00:00.000Z', reviewCount: 3, progress: 2 }), sound: comp(), spelling: comp() } });
    const a = cardRec(h(5), localCard);
    const b = cardRec(h(9), remoteCard);
    const ab = mergedCard(mergeSrsCard(a, b));
    const ba = mergedCard(mergeSrsCard(b, a));
    expect(ab).toEqual(ba);
  });

  it('is idempotent', () => {
    const a = cardRec(h(5), card({ deckId: 'deck-a', components: { meaning: comp({ lastReview: '2024-02-01T00:00:00.000Z', exploreCount: 2, progress: 1 }), sound: comp({ exploreCount: 8 }), spelling: comp() } }));
    const b = cardRec(h(9), card({ deckId: 'deck-b', components: { meaning: comp({ lastReview: '2024-01-01T00:00:00.000Z', exploreCount: 7, progress: 2 }), sound: comp({ exploreCount: 3 }), spelling: comp() } }));
    const first = mergeSrsCard(a, b);
    const second = mergeSrsCard(first, b);
    expect(second).toEqual(first);
  });

  it('returns the remote put when local is null', () => {
    const remote = cardRec(h(9), card());
    expect(mergeSrsCard(null, remote)).toBe(remote);
  });
});

describe('mergeSrsReviewEvent', () => {
  it('keeps put events (union by id) and resolves tombstones by HLC', () => {
    const a = rec({ dataClass: 'srsReviewEvent', key: 'reviewEvents:e1', hlc: h(5), value: { id: 'e1' } });
    const b = rec({ dataClass: 'srsReviewEvent', key: 'reviewEvents:e1', hlc: h(9), value: { id: 'e1' } });
    expect(mergeSrsReviewEvent(a, b)).toEqual(b);
    expect(mergeSrsReviewEvent(b, a)).toEqual(b);
    const tomb = rec({ dataClass: 'srsReviewEvent', key: 'reviewEvents:e1', op: 'delete', hlc: h(7) });
    expect(mergeSrsReviewEvent(b, tomb)).toEqual(b);
    const newerTomb = rec({ dataClass: 'srsReviewEvent', key: 'reviewEvents:e1', op: 'delete', hlc: h(11) });
    expect(mergeSrsReviewEvent(b, newerTomb)).toEqual(newerTomb);
    expect(mergeSrsReviewEvent(null, a)).toBe(a);
  });
});

describe('mergeReaderProgress', () => {
  it('merges position by LWW', () => {
    const a = rec({ dataClass: 'readerProgress', key: 'progress:b1/position', hlc: h(5), firstHlc: h(1), value: { paragraphIndex: 3, tokenIndex: 9, updatedAt: 'x' } });
    const b = rec({ dataClass: 'readerProgress', key: 'progress:b1/position', hlc: h(9), firstHlc: h(1), value: { paragraphIndex: 4, tokenIndex: 0, updatedAt: 'y' } });
    expect(mergeReaderProgress(a, b)).toEqual(b);
  });

  it('merges readTime grow-only as max within one lifetime regardless of HLC', () => {
    const local = rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', hlc: h(9), firstHlc: h(1), value: 100 });
    const remote = rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', hlc: h(5), firstHlc: h(1), value: 250 });
    expect(mergeReaderProgress(local, remote)).toEqual(remote);
    expect(mergeReaderProgress(remote, local)).toEqual(remote);
    const equal = rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', hlc: h(20), firstHlc: h(1), value: 250 });
    expect(mergeReaderProgress(remote, equal)).toEqual(equal);
  });

  it('a readTime put from a newer lifetime wins wholesale', () => {
    const local = rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', hlc: h(9), firstHlc: h(1), value: 900 });
    const remote = rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', hlc: h(6), firstHlc: h(5), value: 40 });
    expect(mergeReaderProgress(local, remote)).toEqual(remote);
  });

  it('resolves readTime tombstones by HLC', () => {
    const put = rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', hlc: h(5), value: 900 });
    const tomb = rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', op: 'delete', hlc: h(8) });
    expect(mergeReaderProgress(put, tomb)).toEqual(tomb);
    expect(
      mergeReaderProgress(
        tomb,
        rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', hlc: h(10), value: 5 }),
      ),
    ).toEqual(rec({ dataClass: 'readerProgress', key: 'progress:b1/readTime/dev1', hlc: h(10), value: 5 }));
  });
});

describe('apply order', () => {
  it('exports the spec apply order for data classes', () => {
    const expected: DataClass[] = [
      'syncDirectory', 'settings', 'secondaryKey', 'profileConfig',
      'studyConfig', 'srsCollection', 'srsNotetype', 'srsDeck', 'srsNote',
      'srsAudioAsset', 'srsImageAsset', 'srsCard', 'srsReviewEvent',
      'dictResource', 'wordStatus', 'readerBook', 'readerProgress',
    ];
    expect(DATA_CLASS_APPLY_ORDER).toEqual(expected);
  });

  it('sorts configs through review events in dependency order', () => {
    const order: DataClass[] = ['srsReviewEvent', 'srsCard', 'srsAudioAsset', 'srsNote', 'srsDeck', 'srsNotetype', 'srsCollection', 'studyConfig'];
    const records = order.map((dataClass, i) => rec({ dataClass, key: `k${i}`, hlc: h(i + 1) }));
    const sorted = sortRecordsForApply([...records].reverse());
    expect(sorted.map((r) => r.dataClass)).toEqual([
      'studyConfig', 'srsCollection', 'srsNotetype', 'srsDeck', 'srsNote', 'srsAudioAsset', 'srsCard', 'srsReviewEvent',
    ]);
  });

  it('orders dictionary content before its metadata fields', () => {
    const content = rec({ dataClass: 'dictResource', key: 'resource:hash1', hlc: h(1) });
    const name = rec({ dataClass: 'dictResource', key: 'resource:hash1/name', hlc: h(2) });
    const enabled = rec({ dataClass: 'dictResource', key: 'resource:hash1/enabled', hlc: h(3) });
    const sorted = sortRecordsForApply([enabled, name, content]);
    expect(sorted.map((r) => r.key)).toEqual(['resource:hash1', 'resource:hash1/enabled', 'resource:hash1/name']);
  });

  it('orders books before progress and profile existence before fields', () => {
    const progress = rec({ dataClass: 'readerProgress', key: 'progress:b1/position', hlc: h(1) });
    const book = rec({ dataClass: 'readerBook', key: 'book:b1', hlc: h(2) });
    expect(compareApplyOrder(book, progress)).toBeLessThan(0);
    const profile = rec({ dataClass: 'profileConfig', key: 'profile', hlc: h(1) });
    const field = rec({ dataClass: 'profileConfig', key: 'profile/native', hlc: h(2) });
    expect(compareApplyOrder(profile, field)).toBeLessThan(0);
    const bookField = rec({ dataClass: 'readerBook', key: 'book:b1/title', hlc: h(3) });
    expect(compareApplyOrder(book, bookField)).toBeLessThan(0);
  });
});
