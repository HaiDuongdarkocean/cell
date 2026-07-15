// phraseMatchService — ADR-037 §8.3 steps 10-11: phrase match + fallback.
//
// Public API: matchPhraseRequest(request) → PhraseMatchResult | null.
// Loads phrase index from IndexedDB, runs matchPhrase, resolves definition
// from dictionary store. Falls back to single-word lookup when no phrase
// matches. Supports AbortSignal for request cancellation.

import {
  getAllPhraseIndexes,
} from '../repositories/phraseIndexRepository';
import {
  findDictionaryByTerm,
} from '../repositories/dictionaryRepository';
import {
  matchPhrase,
  tokenizeSentence,
  comparePhraseMatches,
  type PhraseMatchRequest,
  type PhraseMatch,
} from './phraseMatcher';
import {
  deserializePhraseIndex,
  type PhraseIndex,
} from './phraseIndexCompiler';

/** Request for the phrase match service. */
export interface PhraseMatchServiceRequest extends PhraseMatchRequest {
  readonly langCode: string;
  readonly signal?: AbortSignal;
}

/** Result of a phrase match request. */
export interface PhraseMatchResult {
  readonly type: 'phrase' | 'word';
  readonly dictionaryTerm: string;
  readonly surface: string;
  readonly definition: string;
  readonly quality: PhraseMatch['quality'] | 'word';
  readonly span: { readonly start: number; readonly end: number };
  readonly resourceId: number;
}

/** Match a phrase at the cursor, falling back to single-word lookup. */
export async function matchPhraseRequest(
  request: PhraseMatchServiceRequest,
): Promise<PhraseMatchResult | null> {
  const { langCode, sentence, cursorOffset, signal } = request;

  checkAbort(signal);

  // 1. Try phrase match.
  const phraseResult = await tryPhraseMatch(langCode, sentence, cursorOffset, signal);
  if (phraseResult) return phraseResult;

  // 2. Fall back to single-word lookup.
  checkAbort(signal);
  return tryWordLookup(langCode, sentence, cursorOffset);
}

/** Try to match a phrase using stored phrase indexes. */
async function tryPhraseMatch(
  langCode: string,
  sentence: string,
  cursorOffset: number,
  signal?: AbortSignal,
): Promise<PhraseMatchResult | null> {
  checkAbort(signal);

  // Load all phrase indexes for this lang (usually 1 per dictionary resource).
  const allIndexes = await getAllPhraseIndexes(langCode).catch(() => []);
  if (allIndexes.length === 0) return null;

  checkAbort(signal);

  // Sort by resourceId descending (newest import wins) for deterministic
  // multi-resource priority. Collect the best match per resource, then pick
  // the overall winner by (resource priority, comparePhraseMatches).
  const sorted = [...allIndexes].sort((a, b) => b.resourceId - a.resourceId);
  const candidates: { resourceId: number; match: PhraseMatch }[] = [];

  for (const stored of sorted) {
    checkAbort(signal);
    const index: PhraseIndex = deserializePhraseIndex(stored.blob);
    const match = matchPhrase({ sentence, cursorOffset }, index, stored.resourceId);
    if (match) candidates.push({ resourceId: stored.resourceId, match });
  }

  if (candidates.length === 0) return null;

  // Pick the winner: highest resourceId first, then comparePhraseMatches.
  candidates.sort((a, b) => {
    const prioDiff = b.resourceId - a.resourceId;
    if (prioDiff !== 0) return prioDiff;
    return comparePhraseMatches(a.match, b.match);
  });
  const winner = candidates[0]!;
  const match = winner.match;

  // Resolve definition from dictionary store using the winning resource.
  const entries = await findDictionaryByTerm(langCode, match.dictionaryTerm);
  const definition = entries.length > 0 ? entries[0]!.definition : '';

  return {
    type: 'phrase',
    dictionaryTerm: match.dictionaryTerm,
    surface: match.surface,
    definition,
    quality: match.quality,
    span: match.span,
    resourceId: winner.resourceId,
  };
}

/** Fall back to single-word dictionary lookup. */
async function tryWordLookup(
  langCode: string,
  sentence: string,
  cursorOffset: number,
): Promise<PhraseMatchResult | null> {
  const tokens = tokenizeSentence(sentence);
  const target = tokens.find((t) => cursorOffset >= t.start && cursorOffset < t.end);
  if (!target) return null;

  const entries = await findDictionaryByTerm(langCode, target.text);
  if (entries.length === 0) return null;

  const entry = entries[0]!;
  return {
    type: 'word',
    dictionaryTerm: entry.term,
    surface: target.raw,
    definition: entry.definition,
    quality: 'word',
    span: { start: target.start, end: target.end },
    resourceId: entry.resourceId,
  };
}

/** Throw if the signal is aborted. */
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Phrase match request aborted');
}
