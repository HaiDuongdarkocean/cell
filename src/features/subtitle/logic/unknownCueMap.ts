import type { SrtCue } from '@/entities/media';
import type { UnknownScope, UnknownCueHit } from '@/entities/studyMode';
import type { WordStatus } from '@/entities/dictionary';
import { createTokenList, applyTokenListStatus, type Token } from '@/features/tokenize';
import { getWordStatuses, getFrequencyEntries } from '@/features/dictionary';

export interface UnknownCueResolver {
  readonly probe: (cueIndex: number) => UnknownCueHit | null;
  readonly findNext: (fromIndex: number) => number;
  readonly applyStatus: (term: string, status: WordStatus) => void;
  readonly destroy: () => void;
}

type CueTokens = ReadonlyMap<number, readonly Token[]>;

function firstPausableToken(
  tokens: readonly Token[],
  scope: UnknownScope,
  inFreqList: ReadonlySet<string>,
): Token | null {
  for (const token of tokens) {
    if (token.isSeparator) continue;
    if (token.status !== 'unknown' && token.status !== 'tracking') continue;
    if (scope === 'FREQ_LIST' && !inFreqList.has(token.term)) continue;
    return token;
  }
  return null;
}

function toUnknownMap(
  tokenMap: CueTokens,
  scope: UnknownScope,
  inFreqList: ReadonlySet<string>,
): Map<number, UnknownCueHit> {
  const map = new Map<number, UnknownCueHit>();
  for (const [cueIndex, tokens] of tokenMap) {
    const token = firstPausableToken(tokens, scope, inFreqList);
    if (token !== null) map.set(cueIndex, { term: token.term, offset: token.start });
  }
  return map;
}

export async function createUnknownCueResolver(
  cues: readonly SrtCue[],
  langCode: string,
  scope: UnknownScope,
): Promise<UnknownCueResolver> {
  let tokenMap = new Map<number, readonly Token[]>();
  cues.forEach((cue, i) => {
    tokenMap.set(i, createTokenList(cue.text, langCode));
  });

  const terms = new Set<string>();
  for (const tokens of tokenMap.values()) {
    for (const token of tokens) {
      if (!token.isSeparator) terms.add(token.term);
    }
  }

  let inFreqList: ReadonlySet<string> = new Set();
  if (terms.size > 0) {
    const termList = [...terms];
    try {
      const [statusMap, freqMaps] = await Promise.all([
        getWordStatuses(langCode, termList),
        getFrequencyEntries(langCode, termList),
      ]);
      inFreqList = new Set(
        termList.filter((term) => (freqMaps.get(term)?.length ?? 0) > 0),
      );
      const resolved = new Map<number, readonly Token[]>();
      for (const [cueIndex, tokens] of tokenMap) {
        resolved.set(
          cueIndex,
          tokens.map((token) =>
            token.isSeparator
              ? token
              : { ...token, status: statusMap.get(token.term) ?? 'unknown' },
          ),
        );
      }
      tokenMap = resolved;
    } catch {
      // Metadata unavailable (e.g. no resources) — unknownMap resolves below
      // from default 'unknown' statuses; FREQ_LIST scope yields no pauses.
    }
  }

  let unknownMap: Map<number, UnknownCueHit> = toUnknownMap(tokenMap, scope, inFreqList);

  return {
    probe: (cueIndex) => unknownMap.get(cueIndex) ?? null,

    findNext: (fromIndex) => {
      let best = -1;
      for (const cueIndex of unknownMap.keys()) {
        if (cueIndex <= fromIndex) continue;
        if (best === -1 || cueIndex < best) best = cueIndex;
      }
      return best;
    },

    applyStatus: (term, status) => {
      let changed = false;
      const next = new Map<number, readonly Token[]>();
      for (const [cueIndex, tokens] of tokenMap) {
        const updated = applyTokenListStatus(tokens, term, status);
        if (updated !== tokens) changed = true;
        next.set(cueIndex, updated);
      }
      if (!changed) return;
      tokenMap = next;
      unknownMap = toUnknownMap(tokenMap, scope, inFreqList);
    },

    destroy: () => {
      tokenMap = new Map();
      unknownMap = new Map();
      inFreqList = new Set();
    },
  };
}
