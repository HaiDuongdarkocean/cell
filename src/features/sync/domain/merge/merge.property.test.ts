import { compareHlc } from '../hlc';
import type { ChangeRecord, DataClass, Hlc, Scope } from '../types';
import { mergeRecord } from './mergeRecord';
import type { MergeContext } from './mergeRecord';
import type { ProfileRecords } from './policies';

const makeRng = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const int = (r: () => number, n: number): number => Math.floor(r() * n);

const NODES = ['devA:ctx1', 'devB:ctx1', 'devC:ctx2'] as const;

const randomHlc = (r: () => number): Hlc => ({
  wall: int(r, 8) + 1,
  counter: int(r, 3),
  node: pick(r, NODES),
});

const KEYS: ReadonlyArray<readonly [DataClass, string]> = [
  ['settings', 'kv:settings/subtitlePreference'],
  ['settings', 'kv:settings/keyboardShortcuts'],
  ['secondaryKey', 'kv:themeMode/mode'],
  ['syncDirectory', 'connection:google-drive:acct'],
  ['syncDirectory', 'binding:en'],
  ['syncDirectory', 'systemConnection'],
  ['profileConfig', 'profile'],
  ['profileConfig', 'profile/native'],
  ['profileConfig', 'profile/audioLookupOrder'],
  ['studyConfig', 'studyConfigs:sc1'],
  ['srsCollection', 'collections:col1'],
  ['srsDeck', 'decks:d1'],
  ['srsNotetype', 'notetypes:nt1'],
  ['srsNote', 'notes:n1'],
  ['srsCard', 'cards:c1'],
  ['srsReviewEvent', 'reviewEvents:e1'],
  ['srsReviewEvent', 'reviewEvents:e2'],
  ['srsAudioAsset', 'audioAssets:a1'],
  ['srsImageAsset', 'imageAssets:i1'],
  ['dictResource', 'resource:hash1'],
  ['dictResource', 'resource:hash1/name'],
  ['dictResource', 'resource:hash1/enabled'],
  ['wordStatus', 'word:犬'],
  ['readerBook', 'book:b1'],
  ['readerBook', 'book:b1/title'],
  ['readerProgress', 'progress:b1/position'],
  ['readerProgress', 'progress:b1/readTime/devA'],
  ['readerProgress', 'progress:b1/readTime/devB'],
];

const scopeFor = (dataClass: DataClass): Scope =>
  dataClass === 'settings' || dataClass === 'secondaryKey' || dataClass === 'syncDirectory'
    ? 'global'
    : 'profile:en';

const randomComponent = (r: () => number, type: string): Record<string, unknown> => ({
  type,
  progress: int(r, 5),
  exploreCount: int(r, 4),
  reviewCount: int(r, 4),
  fsrsState: {
    due: `2024-01-0${int(r, 9) + 1}T00:00:00.000Z`,
    stability: int(r, 4),
    difficulty: int(r, 4),
    ...(r() < 0.7 ? { lastReview: `2024-02-0${int(r, 4) + 1}T00:00:00.000Z` } : {}),
  },
});

const randomCard = (r: () => number): Record<string, unknown> => ({
  id: 'c1',
  noteId: r() < 0.9 ? 'note1' : `note${int(r, 3)}`,
  deckId: `deck${int(r, 3)}`,
  createdAt: r() < 0.9 ? 1000 : int(r, 5000),
  components: {
    meaning: randomComponent(r, 'meaning'),
    sound: randomComponent(r, 'sound'),
    spelling: randomComponent(r, 'spelling'),
  },
  studyAgainDue: {
    meaning: r() < 0.3 ? '2024-03-01T00:00:00.000Z' : null,
    sound: r() < 0.3 ? '2024-03-02T00:00:00.000Z' : null,
    spelling: null,
  },
  nextDue: '2024-01-01T00:00:00.000Z',
  maintenanceMode: false,
});

const randomValue = (r: () => number, dataClass: DataClass, key: string): unknown => {
  if (dataClass === 'srsCard') return randomCard(r);
  if (dataClass === 'readerProgress') {
    return key.includes('/readTime/')
      ? int(r, 1000)
      : { paragraphIndex: int(r, 50), tokenIndex: int(r, 20), updatedAt: 't' };
  }
  if (dataClass === 'srsReviewEvent') return { id: key.split(':')[1], answeredAt: int(r, 10) };
  if (dataClass === 'dictResource') return { hash: 'hash1', name: `dict${int(r, 3)}` };
  return { v: int(r, 6) };
};

const CARD_LIFETIMES: readonly Hlc[] = [
  { wall: 1, counter: 0, node: 'genesis' },
  { wall: 5, counter: 0, node: 'reborn' },
];

type UsedHlc = Map<string, Set<string>>;

const hlcSig = (hlc: Hlc): string => `${hlc.wall}:${hlc.counter}:${hlc.node}`;

const freshHlc = (r: () => number, used: Set<string>, born: Hlc | undefined): Hlc => {
  for (let i = 0; i < 64; i += 1) {
    const base = randomHlc(r);
    const wall = born !== undefined && born.wall > base.wall ? born.wall + 1 : base.wall;
    const cand: Hlc = { ...base, wall };
    const sig = hlcSig(cand);
    if (!used.has(sig)) {
      used.add(sig);
      return cand;
    }
  }
  const fallback: Hlc = { wall: 9000 + used.size, counter: 0, node: 'uniquifier' };
  used.add(hlcSig(fallback));
  return fallback;
};

const randomRecordFor = (
  r: () => number,
  dataClass: DataClass,
  key: string,
  usedByKey: UsedHlc,
): ChangeRecord => {
  let used = usedByKey.get(key);
  if (used === undefined) {
    used = new Set<string>();
    usedByKey.set(key, used);
  }
  const op = r() < 0.25 ? 'delete' : 'put';
  const lifetimeAware = dataClass === 'srsCard' || key.includes('/readTime/');
  let firstHlc: Hlc | undefined;
  if (lifetimeAware && r() < 0.7) {
    firstHlc = pick(r, CARD_LIFETIMES);
  } else if (r() < 0.5) {
    firstHlc = { wall: int(r, 8) + 1, counter: int(r, 3), node: pick(r, NODES) };
  }
  const hlc = freshHlc(r, used, op === 'put' ? firstHlc : undefined);
  return {
    scope: scopeFor(dataClass),
    dataClass,
    key,
    op,
    ...(op === 'put' ? { value: randomValue(r, dataClass, key) } : {}),
    hlc,
    ...(firstHlc === undefined ? {} : { firstHlc }),
  };
};

const randomRecord = (r: () => number, usedByKey: UsedHlc): ChangeRecord => {
  const [dataClass, key] = pick(r, KEYS);
  return randomRecordFor(r, dataClass, key, usedByKey);
};

const sameKeyPair = (r: () => number, usedByKey: UsedHlc): [ChangeRecord, ChangeRecord] => {
  const [dataClass, key] = pick(r, KEYS);
  return [
    randomRecordFor(r, dataClass, key, usedByKey),
    randomRecordFor(r, dataClass, key, usedByKey),
  ];
};

const profileCtx = (records: readonly ChangeRecord[]): ProfileRecords => {
  let put: ChangeRecord | null = null;
  let tombstone: ChangeRecord | null = null;
  for (const record of records) {
    if (record.key !== 'profile') continue;
    if (record.op === 'put' && (put === null || compareHlc(record.hlc, put.hlc) > 0)) put = record;
    if (record.op === 'delete' && (tombstone === null || compareHlc(record.hlc, tombstone.hlc) > 0)) {
      tombstone = record;
    }
  }
  return { put, tombstone };
};

const tombstonesByKey = (records: readonly ChangeRecord[]): Map<string, ChangeRecord> => {
  const out = new Map<string, ChangeRecord>();
  for (const record of records) {
    if (record.op !== 'delete') continue;
    const cur = out.get(record.key);
    if (cur === undefined || compareHlc(record.hlc, cur.hlc) > 0) out.set(record.key, record);
  }
  return out;
};

const ctxFor = (
  records: readonly ChangeRecord[],
  tombstones: Map<string, ChangeRecord>,
): ((record: ChangeRecord) => MergeContext) => {
  const profile = profileCtx(records);
  return (record) => ({ profile, keyTombstone: tombstones.get(record.key) ?? null });
};

const shuffle = <T>(r: () => number, xs: readonly T[]): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

describe('merge properties', () => {
  it('is commutative for two records on the same key', () => {
    const r = makeRng(20240101);
    const usedByKey: UsedHlc = new Map();
    for (let i = 0; i < 800; i += 1) {
      const [a, b] = sameKeyPair(r, usedByKey);
      const tombstones = tombstonesByKey([a, b]);
      expect(mergeRecord(a, b, ctxFor([a, b], tombstones)(a))).toEqual(
        mergeRecord(b, a, ctxFor([a, b], tombstones)(a)),
      );
    }
  });

  it('is idempotent: merging the winner against the same remote is a no-op', () => {
    const r = makeRng(777);
    const usedByKey: UsedHlc = new Map();
    for (let i = 0; i < 800; i += 1) {
      const [a, b] = sameKeyPair(r, usedByKey);
      const tombstones = tombstonesByKey([a, b]);
      const ctx = ctxFor([a, b], tombstones)(b);
      const winner = mergeRecord(a, b, ctx);
      expect(mergeRecord(winner, b, ctx)).toEqual(winner);
    }
  });

  it('resolves tombstone vs put by HLC', () => {
    const r = makeRng(42);
    const usedByKey: UsedHlc = new Map();
    for (let i = 0; i < 400; i += 1) {
      const [a, b] = sameKeyPair(r, usedByKey);
      const put = a.op === 'put' ? a : { ...a, op: 'put' as const, value: { v: 1 } };
      const tombstone = { ...b, op: 'delete' as const, value: undefined };
      const winner = mergeRecord(put, tombstone);
      expect(winner).not.toBeNull();
      const expected = compareHlc(put.hlc, tombstone.hlc) >= 0 ? put : tombstone;
      if (winner !== null) {
        expect(compareHlc(winner.hlc, expected.hlc)).toBe(0);
        expect(winner.op).toBe(expected.op);
      }
    }
  });

  it('converges: three devices folding the same record set in different orders agree', () => {
    const r = makeRng(999);
    for (let iter = 0; iter < 300; iter += 1) {
      const usedByKey: UsedHlc = new Map();
      const records = Array.from({ length: 40 }, () => randomRecord(r, usedByKey));
      const tombstones = tombstonesByKey(records);
      const ctx = ctxFor(records, tombstones);
      const devices: Array<Map<string, ChangeRecord | null>> = [];
      for (let d = 0; d < 3; d += 1) {
        const state = new Map<string, ChangeRecord | null>();
        for (const record of shuffle(r, records)) {
          const local = state.get(record.key) ?? null;
          state.set(record.key, mergeRecord(local, record, ctx(record)));
        }
        devices.push(state);
      }
      for (const [key] of devices[0]) {
        const expected = devices[0].get(key);
        expect(devices[1].get(key)).toEqual(expected);
        expect(devices[2].get(key)).toEqual(expected);
      }
      const lwwClasses = new Set<DataClass>([
        'settings', 'secondaryKey', 'syncDirectory', 'studyConfig', 'srsCollection',
        'srsNotetype', 'srsDeck', 'srsNote', 'srsAudioAsset', 'srsImageAsset',
        'dictResource', 'wordStatus', 'readerBook', 'srsReviewEvent',
      ]);
      for (const [key, winner] of devices[0]) {
        const classOfKey = records.find((rec) => rec.key === key)?.dataClass;
        if (classOfKey === undefined || !lwwClasses.has(classOfKey) || winner === null) continue;
        const max = records
          .filter((rec) => rec.key === key)
          .reduce((acc, rec) => (compareHlc(rec.hlc, acc.hlc) > 0 ? rec : acc));
        expect(winner.hlc).toEqual(max.hlc);
      }
    }
  });

  it('profile field suppression is commutative, idempotent and convergent under one tombstone', () => {
    const r = makeRng(555);
    const usedByKey: UsedHlc = new Map();
    const tombstone: ChangeRecord = {
      scope: 'profile:en',
      dataClass: 'profileConfig',
      key: 'profile',
      op: 'delete',
      hlc: { wall: 5, counter: 0, node: 'devA:ctx1' },
    };
    const ctx: MergeContext = { profile: { tombstone } };
    for (let i = 0; i < 400; i += 1) {
      const a = randomRecordFor(r, 'profileConfig', 'profile/native', usedByKey);
      const b = randomRecordFor(r, 'profileConfig', 'profile/native', usedByKey);
      expect(mergeRecord(a, b, ctx)).toEqual(mergeRecord(b, a, ctx));
      const winner = mergeRecord(a, b, ctx);
      expect(mergeRecord(winner, b, ctx)).toEqual(winner);
      const devices: Array<ChangeRecord | null> = [];
      for (const order of [[a, b], [b, a]] as const) {
        let state: ChangeRecord | null = null;
        for (const record of order) state = mergeRecord(state, record, ctx);
        devices.push(state);
      }
      expect(devices[1]).toEqual(devices[0]);
    }
  });

  it('a tombstone newer than all puts wins on every device', () => {
    const r = makeRng(31337);
    for (let iter = 0; iter < 200; iter += 1) {
      const usedByKey: UsedHlc = new Map();
      const records = Array.from({ length: 20 }, () => randomRecord(r, usedByKey));
      const target = pick(r, KEYS);
      const tombstone: ChangeRecord = {
        scope: scopeFor(target[0]),
        dataClass: target[0],
        key: target[1],
        op: 'delete',
        hlc: { wall: 99999, counter: 0, node: 'devZ:ctx' },
      };
      const all = [...records, tombstone];
      const tombstones = tombstonesByKey(all);
      const ctx = ctxFor(all, tombstones);
      for (let d = 0; d < 3; d += 1) {
        const state = new Map<string, ChangeRecord | null>();
        for (const record of shuffle(r, all)) {
          state.set(record.key, mergeRecord(state.get(record.key) ?? null, record, ctx(record)));
        }
        const winner = state.get(tombstone.key);
        expect(winner).toEqual(tombstone);
      }
    }
  });
});
