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
import {
  getAllPhraseIndexes,
} from '@/features/dictionary/repositories/phraseIndexRepository';
import {
  deserializePhraseIndex,
  type PhraseIndex,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import {
  matchPhrase,
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
  const clean = definition.replace(/<br\s*\/?>/gi, '\n').replace(/\r\n/g, '\n');
  // Match numbered senses: "1.(verb) text" or "1. text" or "1\n(verb) text"
  // Pattern: digit + dot + optional (pos) + text until next digit+dot or end.
  const senseRegex = /(\d+)\.\s*(?:\(([^)]+)\)\s*)?([\s\S]*?)(?=\d+\.\s*(?:\(|$)|$)/g;
  const senses: { pos: string; text: string }[] = [];
  let match: RegExpExecArray | null;
  let hasNumbered = false;
  while ((match = senseRegex.exec(clean)) !== null) {
    const num = match[1];
    const pos = match[2]?.trim() ?? '';
    let text = match[3]?.trim() ?? '';
    if (!text) continue;
    // Clean up: remove leading/trailing newlines, collapse multiple newlines.
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    if (num && parseInt(num, 10) > 0) hasNumbered = true;
    senses.push({ pos, text });
  }
  // If no numbered senses found, return the original as a single entry.
  if (!hasNumbered || senses.length === 0) {
    return [{ pos: '', text: clean.trim() }];
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

  // 2. Determine the lookup term: phrase match (EN), FMM segment (ZH),
  //    or hovered token (fallback).
  let lookupTerm = term;
  let detectedPhrase: PhraseMatch | null = null;
  let matchSource: MatchSource = 'dictionary';

  if (fallback) {
    // User selected text — use verbatim, no phrase match.
    matchSource = 'fallback';
  } else if (langCode === 'en') {
    // English: run phrase matcher with all phrase indexes (ADR-037).
    const phraseMatch = await tryEnglishPhraseMatch(langCode, contextSentence, cursorOffset, deps, signal);
    if (phraseMatch) {
      detectedPhrase = phraseMatch;
      lookupTerm = phraseMatch.dictionaryTerm;
      matchSource = 'plugin';
    } else {
      // Word fallback: find the hovered token.
      const tokens = plugin.tokenize(contextSentence);
      const target = findTokenAtOffset(tokens, cursorOffset);
      lookupTerm = target?.text ?? term;
    }
  } else if (langCode === 'zh') {
    // Chinese: FMM segmentation to find the segment at the cursor.
    const probe = await createDictionaryProbeAsync(langCode);
    checkAbort(signal);
    const tokens = plugin.segment!(contextSentence, probe);
    const target = findTokenAtOffset(tokens, cursorOffset);
    lookupTerm = target?.text ?? term;
    matchSource = 'plugin';
  } else {
    // Fallback plugin: use the hovered token.
    const tokens = plugin.tokenize(contextSentence);
    const target = findTokenAtOffset(tokens, cursorOffset);
    lookupTerm = target?.text ?? term;
  }

  checkAbort(signal);

  // 3. Query dictionary for definitions.
  const dictEntries = await findDictionaryByTerm(langCode, lookupTerm);
  checkAbort(signal);

  // 4. Query frequency.
  const freqEntries = await findFrequencyByTerm(langCode, lookupTerm);
  checkAbort(signal);

  // 5. Assemble definitions — split multi-sense entries into individual senses.
  //    Cambridge JSON often stores all senses in one `definition` field with
  //    numbered markers ("1.(verb) ... 2.(verb) ..."). Split so each sense
  //    gets its own checkbox in the popup (spec §4.6.3 A9).
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
        defaultSelected: defIdx === 0,
      });
      defIdx++;
    }
  }

  // 6. Assemble parts of speech.
  const partsOfSpeech = [...new Set(definitions.map((d) => d.pos).filter(Boolean))] as string[];

  // 7. Assemble reading (from first dict entry's reading field, or '').
  const reading = dictEntries[0]?.reading ?? '';

  // 8. Assemble frequency.
  const frequency =
    freqEntries.length > 0
      ? { rank: freqEntries[0]!.frequency, source: 'frequency' }
      : null;

  // 9. Word status — from word status store (Task 3.1). For now, 'unknown'.
  const status = 'unknown' as const;

  return {
    term: lookupTerm,
    langCode,
    reading,
    readingKind: plugin.readingKind,
    frequency,
    status,
    partsOfSpeech,
    definitions,
    detectedPhrase,
    matchSource,
  };
}

/**
 * Try English phrase match across all phrase indexes (multi-resource).
 * Returns the best match by (resourceId descending, comparePhraseMatches).
 */
async function tryEnglishPhraseMatch(
  langCode: string,
  sentence: string,
  cursorOffset: number,
  deps: { readonly phraseIndexes?: ReadonlyMap<number, PhraseIndex> },
  signal?: AbortSignal,
): Promise<PhraseMatch | null> {
  let indexes: { resourceId: number; index: PhraseIndex }[];

  if (deps.phraseIndexes && deps.phraseIndexes.size > 0) {
    indexes = [...deps.phraseIndexes.entries()].map(([resourceId, index]) => ({ resourceId, index }));
  } else {
    // Load from IndexedDB.
    const stored = await getAllPhraseIndexes(langCode).catch(() => []);
    if (stored.length === 0) return null;
    checkAbort(signal);
    indexes = stored.map((s) => ({
      resourceId: s.resourceId,
      index: deserializePhraseIndex(s.blob),
    }));
  }

  // Sort by resourceId descending (newest import wins).
  indexes.sort((a, b) => b.resourceId - a.resourceId);

  const candidates: { resourceId: number; match: PhraseMatch }[] = [];
  for (const { resourceId, index } of indexes) {
    checkAbort(signal);
    const match = matchPhrase({ sentence, cursorOffset }, index, resourceId);
    if (match) candidates.push({ resourceId, match });
  }

  if (candidates.length === 0) return null;

  // Pick winner: resourceId descending, then comparePhraseMatches.
  candidates.sort((a, b) => {
    const prioDiff = b.resourceId - a.resourceId;
    if (prioDiff !== 0) return prioDiff;
    return comparePhraseMatches(a.match, b.match);
  });

  return candidates[0]!.match;
}
