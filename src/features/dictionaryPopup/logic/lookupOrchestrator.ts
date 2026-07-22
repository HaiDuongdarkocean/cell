// lookupOrchestrator — spec §4.6.3/§9.4: dictionary match (cụm dài → đơn)
// + plugin dispatch + result assembly.
//
// Flow:
// 1. Get the language plugin for langCode (from registry, fallback if unknown).
// 2. For English: run plugin.matchPhrase (ADR-037 phrase matcher). If a
//    phrase matches, use the phrase term for dictionary lookup. Otherwise
//    use the hovered word (plugin.tokenize + cursorOffset → target token).
// 3. For Chinese: run plugin.segment (FMM) to find the segment at the cursor
//    offset, then use that segment for dictionary lookup.
// 4. For fallback languages: use the hovered token verbatim.
// 5. Query IndexedDB: findDictionaryByTerm, findFrequencyByTerm, word status.
// 6. Assemble a LookupResult with definitions, reading, frequency, status,
//    detectedPhrase, matchSource.
//
// Supports AbortSignal for cancellation (spec §9.4). ≤1s budget on 4GB RAM.
//
// This is the host-side orchestrator (runs in the background script, not the
// worker). The worker handles phrase matching + LRU; this orchestrator
// handles dictionary DB queries + result assembly.

import type { LookupRequest, LookupResult, DefinitionEntry, MatchSource } from '../types';
import type { Token, TermProbe, LanguagePlugin } from '../plugins/languagePlugin';
import { pluginRegistry } from '../plugins/pluginRegistry';
import { findDictionaryByTerm } from '@/features/dictionary/repositories/dictionaryRepository';
import { findFrequencyByTerm } from '@/features/dictionary/repositories/frequencyRepository';
import { getAllResources } from '@/features/dictionary/repositories/resourceRepository';
import { getWordStatus } from '@/features/dictionaryPopup/services/wordStatusStore';
import {
  getAllPhraseIndexes,
} from '@/features/dictionary/repositories/phraseIndexRepository';
import {
  deserializePhraseIndex,
  type PhraseIndex,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import {
  matchPhraseAll,
  comparePhraseMatches,
  type PhraseMatch,
} from '@/features/dictionary/logic/phraseMatcher';
import { createChinesePlugin } from '../plugins/chinesePlugin';
import { createEnglishPlugin } from '../plugins/englishPlugin';
import { compilePhraseIndex } from '@/features/dictionary/logic/phraseIndexCompiler';

/** Check if an AbortSignal is aborted. */
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Lookup aborted');
}

/**
 * Split a multi-sense definition string into individual senses.
 *
 * Cambridge JSON dictionaries often store all senses in a single `definition`
 * field, separated by numbered markers like "1.(verb) ... 2.(verb) ...".
 * This function splits them so each sense becomes a separate DefinitionEntry
 * with its own checkbox in the popup.
 *
 * Returns the original text as a single entry if no numbered senses are found.
 */
function splitSenses(definition: string): { pos: string; text: string }[] {
  if (!definition) return [];
  // Strip <br> tags, normalize whitespace.
  const clean = definition.replace(/<br\s*\/?>/gi, '\n').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  // Match each sense boundary. Cambridge uses markers like:
  //   1.(noun) ...        — POS in parentheses immediately after the number.
  //   17.bring/call...    — idiom marker without parentheses, no whitespace.
  //   19.in question      — idiom marker with whitespace after the dot.
  // Boundaries are: start of string, or after a blank line (\n{2,}), and the
  // character after the dot must be "(" or a non-digit, non-whitespace char
  // to avoid false positives like "1.5 kg".
  const senseRegex = /(?:^|\n{2,})\s*(\d+)\.\s*(?:\(([^)]+)\)\s*)?([\s\S]*?)(?=(?:\n{2,}\s*\d+\.\s*(?:\(|[^\d\s])|$))/g;

  const senses: { pos: string; text: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = senseRegex.exec(clean)) !== null) {
    let pos = match[2]?.trim() ?? '';
    let text = match[3]?.trim() ?? '';
    if (!text) continue;

    // Cambridge idioms sometimes put the POS on the next line:
    //   "bring/call sth into question\n(noun) to express doubt..."
    // If we didn't find a leading POS, check for that pattern.
    if (!pos) {
      const linePos = text.match(/^([^\n]+)\n\s*\(([^)]+)\)\s*(.*)$/s);
      if (linePos) {
        pos = linePos[2]!.trim();
        text = `${linePos[1]!.trim()}\n\n${linePos[3]!.trim()}`;
      }
    }

    // Clean up: collapse runs of newlines and trim.
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    if (!text) continue;

    senses.push({ pos, text });
  }

  // If the text contained no numeric markers, return the whole thing as one sense.
  if (senses.length === 0) {
    return [{ pos: '', text: clean }];
  }
  return senses;
}

/** Find the token at the cursor offset. */
function findTokenAtOffset(tokens: readonly Token[], cursorOffset: number): Token | undefined {
  return tokens.find((t) => cursorOffset >= t.start && cursorOffset < t.end);
}

/**
 * Create a dictionary-backed TermProbe by pre-loading all dictionary terms
 * into a Set. This is the correct approach for FMM — the probe needs
 * synchronous hasTerm() calls.
 *
 * For large dictionaries (120k CEDICT entries), loading into a Set is
 * ~10MB heap — acceptable for a Web Worker on 4GB RAM.
 */
export async function createDictionaryProbeAsync(langCode: string): Promise<TermProbe> {
  const resources = await getAllResources(langCode);
  const dictResources = resources.filter((r) => r.type === 'DICTIONARY');
  const terms = new Set<string>();

  // Load all dictionary terms. For CEDICT this is ~120k entries.
  // ponytail: loading all terms per lookup is expensive. Upgrade: cache
  // the Set in the worker and invalidate on import. For now, this is
  // correct but slow — the worker should hold the Set persistently.
  for (const r of dictResources) {
    if (r.id === undefined) continue;
    const { findDictionaryByResource } = await import(
      '@/features/dictionary/repositories/dictionaryRepository'
    );
    const entries = await findDictionaryByResource(langCode, r.id);
    for (const e of entries) {
      terms.add(e.term.trim().toLowerCase());
    }
  }

  return { hasTerm: (term: string) => terms.has(term.toLowerCase()) };
}

/**
 * Run a lookup: phrase match (EN) or FMM segment (ZH) → dictionary query
 * → result assembly.
 *
 * @param request The lookup request (term, langCode, sentence, cursor).
 * @param deps Plugin registry + optional pre-loaded phrase indexes.
 * @param signal Optional AbortSignal for cancellation.
 */
export async function lookupOrchestrator(
  request: LookupRequest,
  deps: {
    readonly pluginRegistry?: typeof pluginRegistry;
    readonly phraseIndexes?: ReadonlyMap<number, PhraseIndex>;
  } = {},
  signal?: AbortSignal,
): Promise<LookupResult> {
  const results = await lookupOrchestratorMulti(request, deps, signal);
  return results[0]!;
}

/**
 * Multi-candidate lookup: returns ALL phrase match candidates + winner.
 * Winner is first element; remaining are additional candidates sorted by priority.
 * Used by the popup to display multiple candidates progressively.
 */
export async function lookupOrchestratorMulti(
  request: LookupRequest,
  deps: {
    readonly pluginRegistry?: typeof pluginRegistry;
    readonly phraseIndexes?: ReadonlyMap<number, PhraseIndex>;
  } = {},
  signal?: AbortSignal,
): Promise<LookupResult[]> {
  checkAbort(signal);
  const { langCode, contextSentence, cursorOffset, term, fallback } = request;

  // 1. Resolve the language plugin.
  //    EN/ZH plugins are created on-the-fly (EN needs a PhraseIndex per
  //    resource; ZH is stateless). Other languages use the registry, which
  //    falls back to the minimal plugin for unregistered languages.
  const registry = deps.pluginRegistry ?? pluginRegistry;
  let plugin: LanguagePlugin;
  if (langCode === 'zh') {
    plugin = createChinesePlugin();
  } else if (langCode === 'en') {
    // English plugin with empty index — phrase matching is handled
    // separately by tryEnglishPhraseMatch (loads indexes from IDB).
    // The plugin provides tokenize + readingKind + lemma for word fallback.
    plugin = createEnglishPlugin(compilePhraseIndex([]));
  } else if (registry.has(langCode)) {
    plugin = registry.get(langCode);
  } else {
    plugin = registry.get(langCode); // returns fallback
  }

  // 2. Determine the surface token at the cursor and any phrase matches.
  //    The popup always shows the hovered surface token as a candidate, plus
  //    its origin lemma and any matched phrases (order: phrase → hover → origin).
  let surfaceTerm = term;
  if (!fallback) {
    const tokens = plugin.tokenize(contextSentence);
    const target = findTokenAtOffset(tokens, cursorOffset);
    surfaceTerm = target?.text ?? term;
  }

  let detectedPhrase: PhraseMatch | null = null;
  let matchSource: MatchSource = 'dictionary';
  let additionalPhraseMatches: PhraseMatch[] = [];

  if (fallback) {
    // User selected text — use verbatim, no phrase match.
    matchSource = 'fallback';
  } else if (langCode === 'en') {
    // English: run phrase matcher with all phrase indexes (ADR-037).
    const allMatches = await tryEnglishPhraseMatchAll(langCode, contextSentence, cursorOffset, deps, signal);
    if (allMatches.length > 0) {
      detectedPhrase = allMatches[0]!;
      matchSource = 'plugin';
      additionalPhraseMatches = allMatches.slice(1);
    }
  } else if (langCode === 'zh') {
    // Chinese: FMM segmentation to find the segment at the cursor.
    const probe = await createDictionaryProbeAsync(langCode);
    checkAbort(signal);
    const tokens = plugin.segment!(contextSentence, probe);
    const target = findTokenAtOffset(tokens, cursorOffset);
    surfaceTerm = target?.text ?? term;
    matchSource = 'plugin';
  } else {
    // Fallback plugin: use the hovered token.
    const tokens = plugin.tokenize(contextSentence);
    const target = findTokenAtOffset(tokens, cursorOffset);
    surfaceTerm = target?.text ?? term;
  }

  checkAbort(signal);

  // 2b. Determine origin/lemma of the hovered surface token for header display.
  const originTerm = (plugin.lemma && surfaceTerm !== plugin.lemma(surfaceTerm))
    ? plugin.lemma(surfaceTerm)
    : undefined;

  // 3. Build winner result: phrase match wins when valid; otherwise the surface
  //    token (with lemma fallback for definitions).
  const winnerResult = detectedPhrase
    ? await assembleLookupResult(langCode, detectedPhrase.dictionaryTerm, detectedPhrase, 'plugin', plugin, signal, undefined, surfaceTerm, originTerm)
    : await assembleLookupResult(langCode, surfaceTerm, null, matchSource, plugin, signal, surfaceTerm, surfaceTerm, originTerm);

  const additionalResults: LookupResult[] = [];
  const seen = new Set([winnerResult.term.toLowerCase()]);

  // 4. Add the hovered surface token as a candidate whenever it differs from
  //    the winner (e.g. phrase winner → hover word candidate, or origin winner
  //    already resolved to surfaceTerm).
  if (surfaceTerm.toLowerCase() !== winnerResult.term.toLowerCase()) {
    const surfaceResult = await assembleLookupResult(
      langCode, surfaceTerm, null, 'dictionary', plugin, signal, surfaceTerm,
    );
    if ((surfaceResult.definitions.length > 0 || surfaceResult.frequency) && !seen.has(surfaceResult.term.toLowerCase())) {
      seen.add(surfaceResult.term.toLowerCase());
      additionalResults.push(surfaceResult);
    }
  }

  // 5. Add origin/lemma candidates (ADR-041).
  if (plugin.lemmaCandidates) {
    for (const candidate of plugin.lemmaCandidates(surfaceTerm)) {
      if (seen.has(candidate.toLowerCase())) continue;
      checkAbort(signal);
      const lemmaResult = await assembleLookupResult(
        langCode, candidate, null, 'dictionary', plugin, signal,
      );
      if ((lemmaResult.definitions.length > 0 || lemmaResult.frequency) && !seen.has(lemmaResult.term.toLowerCase())) {
        seen.add(lemmaResult.term.toLowerCase());
        additionalResults.push(lemmaResult);
      }
    }
  } else if (plugin.lemma) {
    const lemma = plugin.lemma(surfaceTerm);
    if (lemma && !seen.has(lemma.toLowerCase())) {
      checkAbort(signal);
      const lemmaResult = await assembleLookupResult(
        langCode, lemma, null, 'dictionary', plugin, signal,
      );
      if ((lemmaResult.definitions.length > 0 || lemmaResult.frequency) && !seen.has(lemmaResult.term.toLowerCase())) {
        additionalResults.push(lemmaResult);
      }
    }
  }

  // 6. Add remaining phrase matches after surface/origin candidates.
  for (const match of additionalPhraseMatches) {
    if (seen.has(match.dictionaryTerm.toLowerCase())) continue;
    checkAbort(signal);
    const result = await assembleLookupResult(
      langCode, match.dictionaryTerm, match, 'plugin', plugin, signal,
    );
    if (!seen.has(result.term.toLowerCase())) {
      seen.add(result.term.toLowerCase());
      additionalResults.push(result);
    }
  }

  return [winnerResult, ...additionalResults];
}

/**
 * Assemble a single LookupResult for a term: query dictionary + frequency,
 * split senses, build definitions, reading, parts of speech.
 *
 * If the raw term returns no dictionary entries and the plugin provides a
 * lemma function, retries with the lemma form (inflectional morphology
 * fallback: "easiest" → "easy", "better" → "good").
 */
async function assembleLookupResult(
  langCode: string,
  lookupTerm: string,
  detectedPhrase: PhraseMatch | null,
  matchSource: MatchSource,
  plugin: LanguagePlugin,
  signal?: AbortSignal,
  /** If provided, the result header shows this surface term (e.g. the hovered
   *  token "is") while definitions are resolved from lookupTerm/its lemma. */
  displayTerm?: string,
  /** Exact token the user hovered over (for header display when phrase matched). */
  hoverTerm?: string,
  /** Resolved lemma/origin of the hovered token (for header display). */
  originTerm?: string,
): Promise<LookupResult> {
  checkAbort(signal);

  let dictEntries = await findDictionaryByTerm(langCode, lookupTerm);
  checkAbort(signal);

  // Inflectional morphology fallback (ADR-041): if raw term not in dictionary,
  // try ALL lemma candidates from the shared multi-candidate lemma module.
  // This handles CVC doubling (bigger→big), silent-e (nicest→nice), irregular
  // plurals (children→child), possessive (cat's→cat), etc.
  let effectiveTerm = lookupTerm;
  if (dictEntries.length === 0 && plugin.lemmaCandidates) {
    const candidates = plugin.lemmaCandidates(lookupTerm);
    for (const candidate of candidates) {
      if (candidate.toLowerCase() === lookupTerm.toLowerCase()) continue;
      checkAbort(signal);
      dictEntries = await findDictionaryByTerm(langCode, candidate);
      if (dictEntries.length > 0) {
        effectiveTerm = candidate;
        break;
      }
    }
  } else if (dictEntries.length === 0 && plugin.lemma) {
    // Backward compat: single-lemma fallback for plugins without lemmaCandidates.
    const lemma = plugin.lemma(lookupTerm);
    if (lemma && lemma.toLowerCase() !== lookupTerm.toLowerCase()) {
      dictEntries = await findDictionaryByTerm(langCode, lemma);
      checkAbort(signal);
      if (dictEntries.length > 0) {
        effectiveTerm = lemma;
      }
    }
  }

  const surfaceTerm = displayTerm ?? effectiveTerm;
  let freqEntries = await findFrequencyByTerm(langCode, surfaceTerm);
  if (freqEntries.length === 0 && surfaceTerm !== effectiveTerm) {
    freqEntries = await findFrequencyByTerm(langCode, effectiveTerm);
  }
  checkAbort(signal);

  const definitions: DefinitionEntry[] = [];
  let defIdx = 0;
  for (const e of dictEntries) {
    const senses = splitSenses(e.definition);
    const examples = e.examples ? e.examples.split('\n').filter(Boolean) : [];
    for (const sense of senses) {
      definitions.push({
        id: `def-${defIdx}`,
        pos: sense.pos || e.pos || undefined,
        text: sense.text,
        examples,
        source: 'Cambridge',
        defaultSelected: false,
      });
      defIdx++;
    }
  }

  const partsOfSpeech = [...new Set(definitions.map((d) => d.pos).filter(Boolean))] as string[];

  const rawReading = dictEntries[0]?.pronunciation || dictEntries[0]?.reading || '';
  const reading = rawReading && rawReading.toLowerCase() === effectiveTerm.toLowerCase()
    ? ''
    : rawReading;

  const frequency =
    freqEntries.length > 0
      ? { rank: freqEntries[0]!.frequency, source: 'frequency' }
      : null;

  // Status is a property of the hovered word, not a phrase. When a phrase
  // matched, surfaceTerm is the phrase surface; use hoverTerm for status lookup.
  const statusTerm = hoverTerm ?? surfaceTerm;
  const status = await getWordStatus(langCode, statusTerm);

  return {
    term: surfaceTerm,
    langCode,
    reading,
    readingKind: plugin.readingKind,
    frequency,
    status,
    partsOfSpeech,
    definitions,
    detectedPhrase,
    matchSource,
    hoverTerm,
    originTerm,
  };
}

/**
 * Try English phrase match across all phrase indexes (multi-resource).
 * Returns ALL matches sorted by (resourceId descending, comparePhraseMatches).
 * The first element is the winner; remaining are additional candidates.
 */
async function tryEnglishPhraseMatchAll(
  langCode: string,
  sentence: string,
  cursorOffset: number,
  deps: { readonly phraseIndexes?: ReadonlyMap<number, PhraseIndex> },
  signal?: AbortSignal,
): Promise<PhraseMatch[]> {
  let indexes: { resourceId: number; index: PhraseIndex }[];

  if (deps.phraseIndexes && deps.phraseIndexes.size > 0) {
    indexes = [...deps.phraseIndexes.entries()].map(([resourceId, index]) => ({ resourceId, index }));
  } else {
    // Load from IndexedDB.
    const stored = await getAllPhraseIndexes(langCode).catch(() => []);
    if (stored.length === 0) return [];
    checkAbort(signal);
    // Deserialize each blob — skip corrupted/version-mismatched blobs
    // and fall back to word-level lookup for those resources.
    indexes = [];
    for (const s of stored) {
      try {
        indexes.push({ resourceId: s.resourceId, index: deserializePhraseIndex(s.blob) });
      } catch {
        // Version mismatch or corrupt blob — skip, word fallback handles it.
      }
    }
    if (indexes.length === 0) return [];
  }

  // Sort by resourceId descending (newest import wins).
  indexes.sort((a, b) => b.resourceId - a.resourceId);

  const candidates: { resourceId: number; match: PhraseMatch }[] = [];
  for (const { resourceId, index } of indexes) {
    checkAbort(signal);
    // matchPhraseAll returns ALL matches at cursor (not just winner).
    const allMatches = matchPhraseAll({ sentence, cursorOffset }, index, resourceId);
    for (const match of allMatches) {
      candidates.push({ resourceId, match });
    }
  }

  if (candidates.length === 0) return [];

  // Sort: resourceId descending, then comparePhraseMatches.
  candidates.sort((a, b) => {
    const prioDiff = b.resourceId - a.resourceId;
    if (prioDiff !== 0) return prioDiff;
    return comparePhraseMatches(a.match, b.match);
  });

  // Deduplicate by dictionaryTerm — same term from different resources
  // is the same candidate, keep the highest-priority one.
  const seen = new Set<string>();
  const unique: PhraseMatch[] = [];
  for (const { match } of candidates) {
    if (seen.has(match.dictionaryTerm)) continue;
    seen.add(match.dictionaryTerm);
    unique.push(match);
  }

  return unique;
}
