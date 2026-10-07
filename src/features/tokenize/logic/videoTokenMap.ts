import type { WordStatus } from '@/entities/dictionary';
import type { Token, TokenFrequencyBand } from '@/features/tokenize/types';
import { tokenizeTextBlock } from '@/features/tokenize/logic/textTokenizer';

export interface PreparedCue {
  readonly text: string;
  readonly tokens: readonly Token[];
  readonly metadataResolved: boolean;
  readonly termSet: ReadonlySet<string>;
}

export interface VideoTokenMap {
  readonly langCode: string;
  readonly prepare: (cueIndex: number, text: string) => void;
  readonly get: (cueIndex: number) => PreparedCue | undefined;
  readonly resolveMetadata: (
    cueIndex: number,
    statuses: ReadonlyMap<string, WordStatus>,
    frequencies: ReadonlyMap<string, TokenFrequencyBand>,
    readings?: ReadonlyMap<string, string> | null,
    glosses?: ReadonlyMap<string, string> | null,
  ) => void;
  readonly resolveTerms: (
    terms: ReadonlySet<string>,
    statuses: ReadonlyMap<string, WordStatus>,
    frequencies: ReadonlyMap<string, TokenFrequencyBand>,
    readings?: ReadonlyMap<string, string> | null,
    glosses?: ReadonlyMap<string, string> | null,
  ) => void;
  /** Drop cached glosses (native-language change). Tokens keep their current
   *  gloss until the next resolve overwrites it — stale hint beats blank. */
  readonly clearGlosses: () => void;
  readonly applyStatus: (term: string, status: WordStatus) => boolean;
  readonly terms: () => ReadonlySet<string>;
  readonly onUpdate: (listener: (cueIndex: number) => void) => () => void;
  readonly clear: () => void;
}

export function createVideoTokenMap(langCode: string): VideoTokenMap {
  const cues = new Map<number, PreparedCue>();
  const termToCues = new Map<string, Set<number>>();
  const resolvedTerms = new Set<string>();
  const termStatusCache = new Map<string, WordStatus>();
  const termFrequencyCache = new Map<string, TokenFrequencyBand>();
  const termReadingCache = new Map<string, string>();
  const termGlossCache = new Map<string, string>();
  const listeners = new Set<(cueIndex: number) => void>();

  function emit(cueIndex: number): void {
    for (const listener of [...listeners]) {
      listener(cueIndex);
    }
  }

  function buildTermIndex(tokens: readonly Token[]): Set<string> {
    const terms = new Set<string>();
    for (const token of tokens) {
      if (!token.isSeparator) {
        terms.add(token.term);
      }
    }
    return terms;
  }

  function updateTermIndex(cueIndex: number, terms: ReadonlySet<string>): void {
    for (const term of terms) {
      let set = termToCues.get(term);
      if (!set) {
        set = new Set<number>();
        termToCues.set(term, set);
      }
      set.add(cueIndex);
    }
  }

  function removeFromTermIndex(cueIndex: number, terms: ReadonlySet<string>): void {
    for (const term of terms) {
      const set = termToCues.get(term);
      if (set) {
        set.delete(cueIndex);
        if (set.size === 0) {
          termToCues.delete(term);
        }
      }
    }
  }

  function resolveCue(
    cueIndex: number,
    statuses: ReadonlyMap<string, WordStatus>,
    frequencies: ReadonlyMap<string, TokenFrequencyBand>,
    readings?: ReadonlyMap<string, string> | null,
    glosses?: ReadonlyMap<string, string> | null,
  ): void {
    const cue = cues.get(cueIndex);
    if (!cue) return;

    let changed = false;
    const tokens = cue.tokens.map((token) => {
      if (token.isSeparator) return token;
      const status = statuses.get(token.term) ?? termStatusCache.get(token.term) ?? 'unknown';
      const frequencyBand = frequencies.get(token.term) ?? termFrequencyCache.get(token.term) ?? 'none';
      // readings === undefined → leg skipped/failed: keep the existing value.
      // A provided map is authoritative only for terms it covers (the caller
      // marks covered-but-empty terms with '') — chunked resolve passes must
      // not wipe readings fetched by an earlier chunk.
      let reading = token.reading;
      if (readings?.has(token.term)) {
        reading = readings.get(token.term) || undefined;
        if (reading) termReadingCache.set(token.term, reading);
        else termReadingCache.delete(token.term);
      }
      // glosses follows the readings contract: undefined/null = leg skipped or
      // failed (keep existing); a provided map is authoritative per term.
      let gloss = token.gloss;
      if (glosses?.has(token.term)) {
        gloss = glosses.get(token.term) || undefined;
        if (gloss) termGlossCache.set(token.term, gloss);
        else termGlossCache.delete(token.term);
      }
      if (status !== token.status || frequencyBand !== token.frequencyBand || reading !== token.reading || gloss !== token.gloss) {
        changed = true;
      }
      if (!token.isSeparator) {
        termStatusCache.set(token.term, status);
        termFrequencyCache.set(token.term, frequencyBand);
        resolvedTerms.add(token.term);
      }
      return { ...token, status, frequencyBand, reading, gloss };
    });
    const allResolved = tokens.every(
      (token) => token.isSeparator || resolvedTerms.has(token.term),
    );
    cues.set(cueIndex, { ...cue, tokens, metadataResolved: allResolved });
    if (changed) emit(cueIndex);
  }

  function resolveTermsInCues(
    terms: ReadonlySet<string>,
    statuses: ReadonlyMap<string, WordStatus>,
    frequencies: ReadonlyMap<string, TokenFrequencyBand>,
    readings?: ReadonlyMap<string, string> | null,
    glosses?: ReadonlyMap<string, string> | null,
  ): void {
    const affected = new Set<number>();
    for (const term of terms) {
      const cueSet = termToCues.get(term);
      if (!cueSet) continue;
      for (const cueIndex of cueSet) {
        affected.add(cueIndex);
      }
    }
    for (const cueIndex of affected) {
      resolveCue(cueIndex, statuses, frequencies, readings, glosses);
    }
  }

  return {
    langCode,

    prepare(cueIndex: number, text: string): void {
      const tokens = tokenizeTextBlock(text, langCode).map((token) => ({
        ...token,
        status: (termStatusCache.get(token.term) ?? 'unknown') as Token['status'],
        frequencyBand: (termFrequencyCache.get(token.term) ?? 'none') as Token['frequencyBand'],
        reading: termReadingCache.get(token.term),
        gloss: termGlossCache.get(token.term),
      }));
      const termSet = buildTermIndex(tokens);
      removeFromTermIndex(cueIndex, cues.get(cueIndex)?.termSet ?? new Set());
      cues.set(cueIndex, {
        text,
        tokens,
        metadataResolved: false,
        termSet,
      });
      updateTermIndex(cueIndex, termSet);
      emit(cueIndex);
    },

    get(cueIndex: number): PreparedCue | undefined {
      return cues.get(cueIndex);
    },

    resolveMetadata(
      cueIndex: number,
      statuses: ReadonlyMap<string, WordStatus>,
      frequencies: ReadonlyMap<string, TokenFrequencyBand>,
      readings?: ReadonlyMap<string, string> | null,
      glosses?: ReadonlyMap<string, string> | null,
    ): void {
      resolveCue(cueIndex, statuses, frequencies, readings, glosses);
    },

    resolveTerms: resolveTermsInCues,

    clearGlosses(): void {
      termGlossCache.clear();
    },

    applyStatus(term: string, status: WordStatus): boolean {
      termStatusCache.set(term, status);
      const cueSet = termToCues.get(term);
      if (!cueSet || cueSet.size === 0) return false;

      let changed = false;
      for (const cueIndex of cueSet) {
        const cue = cues.get(cueIndex);
        if (!cue) continue;
        const tokens = cue.tokens.map((token) =>
          token.isSeparator || token.term !== term || token.status === status
            ? token
            : { ...token, status },
        );
        const nextChanged = tokens.some((token, i) => token !== cue.tokens[i]);
        if (nextChanged) {
          cues.set(cueIndex, { ...cue, tokens });
          changed = true;
          emit(cueIndex);
        }
      }
      return changed;
    },

    terms(): ReadonlySet<string> {
      return new Set(termToCues.keys());
    },

    onUpdate(listener: (cueIndex: number) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    clear(): void {
      cues.clear();
      termToCues.clear();
      resolvedTerms.clear();
      termStatusCache.clear();
      termFrequencyCache.clear();
      termReadingCache.clear();
      termGlossCache.clear();
    },
  };
}
