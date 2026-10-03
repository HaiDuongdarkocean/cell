import { useState } from 'react';

export type MockStatus = 'unknown' | 'tracking' | 'learning' | 'known' | 'ignore';

export const STATUS_ORDER: readonly MockStatus[] = ['unknown', 'tracking', 'learning', 'known', 'ignore'];

export interface MockAccent {
  label: 'ame' | 'bre';
  ipa: string;
}

export interface MockFreq {
  source: string;
  rank: number;
  total: number;
  genres: { label: string; value: number }[];
}

export interface MockSense {
  gloss: string;
  labels?: string[];
  examples?: string[];
}

export interface MockVariant {
  pos: string;
  label: string;
  accents: MockAccent[];
  freq: MockFreq | null;
  stars: number;
  status: MockStatus;
  inflections: { type: string; forms: string[] }[];
  senses: MockSense[];
  imageQuery: string;
}

export interface MockEntry {
  term: string;
  variants: MockVariant[];
}

export const ENTRIES: Record<string, MockEntry> = {
  present: {
    term: 'present',
    variants: [
      {
        pos: 'adjective',
        label: 'adjective',
        accents: [
          { label: 'ame', ipa: '/ˈprezənt/' },
          { label: 'bre', ipa: '/ˈprez(ə)nt/' },
        ],
        freq: {
          source: 'COCA',
          rank: 1334,
          total: 32520,
          genres: [
            { label: 'SPOK', value: 5201 },
            { label: 'FIC', value: 2641 },
            { label: 'MAG', value: 5410 },
            { label: 'NEWS', value: 5834 },
            { label: 'ACAD', value: 13434 },
          ],
        },
        stars: 3,
        status: 'unknown',
        inflections: [],
        senses: [
          { gloss: 'existing or happening now', examples: ['the present situation', 'at the present time'] },
          { gloss: 'being in a particular place', labels: ['not before noun'], examples: ['all those present at the meeting'] },
        ],
        imageQuery: 'present adjective',
      },
      {
        pos: 'verb',
        label: 'verb',
        accents: [
          { label: 'ame', ipa: '/prɪˈzent/' },
          { label: 'bre', ipa: '/prɪˈzent/' },
        ],
        freq: {
          source: 'COCA',
          rank: 818,
          total: 53923,
          genres: [
            { label: 'SPOK', value: 5790 },
            { label: 'FIC', value: 3258 },
            { label: 'MAG', value: 8275 },
            { label: 'NEWS', value: 8608 },
            { label: 'ACAD', value: 27992 },
          ],
        },
        stars: 3,
        status: 'learning',
        inflections: [
          { type: 'present', forms: ['present', 'presents'] },
          { type: 'past', forms: ['presented'] },
          { type: 'pres. part.', forms: ['presenting'] },
        ],
        senses: [
          { gloss: 'to give something to somebody, especially formally at a ceremony', examples: ['They presented him with an award.'] },
          { gloss: 'to show or introduce something to the public', examples: ['She presents a TV show.'] },
          { gloss: 'to cause a problem or difficulty', examples: ['The task presents a challenge.'] },
        ],
        imageQuery: 'present verb',
      },
      {
        pos: 'noun',
        label: 'noun',
        accents: [
          { label: 'ame', ipa: '/ˈprezənt/' },
          { label: 'bre', ipa: '/ˈprez(ə)nt/' },
        ],
        freq: {
          source: 'COCA',
          rank: 2259,
          total: 16657,
          genres: [
            { label: 'SPOK', value: 3901 },
            { label: 'FIC', value: 4120 },
            { label: 'MAG', value: 3410 },
            { label: 'NEWS', value: 2891 },
            { label: 'ACAD', value: 2335 },
          ],
        },
        stars: 3,
        status: 'unknown',
        inflections: [{ type: 'plural', forms: ['presents'] }],
        senses: [
          { gloss: 'something that you give to somebody; a gift', examples: ['birthday presents'] },
          { gloss: 'the time now', labels: ['the present'], examples: ['live in the present'] },
        ],
        imageQuery: 'present noun',
      },
    ],
  },
  well: {
    term: 'well',
    variants: [
      {
        pos: 'adverb',
        label: 'adverb',
        accents: [
          { label: 'ame', ipa: '/wel/' },
          { label: 'bre', ipa: '/wel/' },
        ],
        freq: { source: 'COCA', rank: 55, total: 498112, genres: [{ label: 'SPOK', value: 189012 }, { label: 'FIC', value: 88110 }, { label: 'MAG', value: 70120 }, { label: 'NEWS', value: 60870 }, { label: 'ACAD', value: 90000 }] },
        stars: 3,
        status: 'known',
        inflections: [],
        senses: [{ gloss: 'in a good or satisfactory way', examples: ['She sings well.'] }],
        imageQuery: 'well adverb',
      },
      {
        pos: 'interjection',
        label: 'interjection',
        accents: [{ label: 'ame', ipa: '/wel/' }],
        freq: null,
        stars: 0,
        status: 'unknown',
        inflections: [],
        senses: [{ gloss: 'used to express surprise or hesitation', examples: ['Well, I never!'] }],
        imageQuery: 'well interjection',
      },
      {
        pos: 'noun',
        label: 'noun',
        accents: [{ label: 'ame', ipa: '/wel/' }],
        freq: { source: 'COCA', rank: 1820, total: 24318, genres: [{ label: 'SPOK', value: 2104 }, { label: 'FIC', value: 4510 }, { label: 'MAG', value: 5012 }, { label: 'NEWS', value: 6201 }, { label: 'ACAD', value: 6491 }] },
        stars: 2,
        status: 'unknown',
        inflections: [{ type: 'plural', forms: ['wells'] }],
        senses: [{ gloss: 'a deep hole in the ground from which water is taken', examples: ['an old stone well'] }],
        imageQuery: 'water well',
      },
      {
        pos: '',
        label: 'other',
        accents: [],
        freq: null,
        stars: 0,
        status: 'unknown',
        inflections: [],
        senses: [{ gloss: '(unclassified sense from a secondary provider)' }],
        imageQuery: 'well',
      },
    ],
  },
  serendipity: {
    term: 'serendipity',
    variants: [
      {
        pos: 'noun',
        label: 'noun',
        accents: [{ label: 'ame', ipa: '/ˌserənˈdɪpəti/' }],
        freq: { source: 'COCA', rank: 18456, total: 1982, genres: [{ label: 'SPOK', value: 112 }, { label: 'FIC', value: 510 }, { label: 'MAG', value: 820 }, { label: 'NEWS', value: 340 }, { label: 'ACAD', value: 200 }] },
        stars: 1,
        status: 'tracking',
        inflections: [{ type: 'plural', forms: ['serendipities'] }],
        senses: [{ gloss: 'the fact of finding interesting things by chance', examples: ['a moment of pure serendipity'] }],
        imageQuery: 'serendipity noun',
      },
    ],
  },
};

export const ENTRY_LIST = Object.keys(ENTRIES);

export interface VariantState {
  vIdx: number;
  selectVariant: (i: number) => void;
  accentIdx: number;
  cycleAccent: () => void;
  selectAccent: (i: number) => void;
  status: MockStatus;
  cycleStatus: () => void;
  checked: Record<number, boolean>;
  toggleSense: (i: number) => void;
}

export function useVariantState(entry: MockEntry): VariantState {
  const [vIdx, setVIdx] = useState(0);
  const [accentByVariant, setAccentByVariant] = useState<Record<number, number>>({});
  const [statusByVariant, setStatusByVariant] = useState<Record<number, MockStatus>>(
    () => Object.fromEntries(entry.variants.map((v, i) => [i, v.status])),
  );
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const accentIdx = accentByVariant[vIdx] ?? 0;
  const accents = entry.variants[vIdx]?.accents ?? [];

  return {
    vIdx,
    selectVariant: setVIdx,
    accentIdx,
    cycleAccent: () => {
      if (accents.length < 2) return;
      setAccentByVariant((m) => ({ ...m, [vIdx]: ((m[vIdx] ?? 0) + 1) % accents.length }));
    },
    selectAccent: (i) => setAccentByVariant((m) => ({ ...m, [vIdx]: i })),
    status: statusByVariant[vIdx] ?? 'unknown',
    cycleStatus: () =>
      setStatusByVariant((m) => {
        const cur = m[vIdx] ?? 'unknown';
        return { ...m, [vIdx]: STATUS_ORDER[(STATUS_ORDER.indexOf(cur) + 1) % STATUS_ORDER.length] };
      }),
    checked,
    toggleSense: (i) => setChecked((c) => ({ ...c, [i]: !c[i] })),
  };
}

export function fmtGenres(freq: MockFreq): string {
  return freq.genres.map((g) => `${g.label} ${g.value.toLocaleString()}`).join(' · ');
}
