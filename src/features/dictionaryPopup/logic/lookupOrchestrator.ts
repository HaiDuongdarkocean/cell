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
import {
  findDictionaryByTerm,
  findDictionaryByResource,
} from '@/features/dictionary/repositories/dictionaryRepository';
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
import { isDevMode } from '@/shared/lib/env/devMode';
import { saveLookupLog } from '../log/lookupLogStore';
import type {
  LookupLogEntry,
  LogToken,
  PhraseMatchTrace,
  MatchTraceData,
  CandidateMatchTrace,
  RankedCandidateTrace,
} from '../log/lookupLogTypes';
import { tokenizeSentence } from '@/features/dictionary/logic/phraseMatcher';
import { pickBestFrequencyEntry } from '@/shared/lib/frequencyBand';
import type { Settings } from '@/entities/settings';
import { getActiveProfileSettings } from '@/entities/settings';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { ResourceInfo } from '@/entities/dictionary';

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
 * Only splits on numbered markers (N.) — does NOT extract POS from
 * parentheses. The text after each marker stays intact, including "(noun)",
 * "(verb [ T ])", idiom markers, etc. POS extraction was overengineering
 * that stripped formatting the user expects to see.
 *
 * Returns the original text as a single entry if no numbered senses are found.
 */
function splitSenses(definition: string): { pos: string; text: string }[] {
  if (!definition) return [];
  // Strip <br> tags, normalize whitespace.
  const clean = definition.replace(/<br\s*\/?>/gi, '\n').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  // Match each sense boundary: start of string or after a blank line (\n{2,}),
  // followed by N. and then any non-digit, non-whitespace char (to avoid
  // false positives like "1.5 kg"). The text after N. stays intact.
  const senseRegex = /(?:^|\n{2,})\s*(\d+)\.\s*([\s\S]*?)(?=(?:\n{2,}\s*\d+\.|$))/g;

  const senses: { pos: string; text: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = senseRegex.exec(clean)) !== null) {
    const text = match[2]?.trim() ?? '';
    if (!text) continue;
    // Collapse runs of newlines and trim — no POS extraction, text stays intact.
    senses.push({ pos: '', text: text.replace(/\n{3,}/g, '\n\n').trim() });
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
 *
 * T23: Module-level probe cache — avoids reloading 120k terms per lookup.
 * OCR increases lookup frequency → cache is essential. Clear on dictionary import.
 */
const probeCache = new Map<string, TermProbe>();

/** T23: Clear the dictionary probe cache (call after dictionary import). */
export function clearDictionaryProbeCache(): void {
  probeCache.clear();
}

/** Runtime context for resource filtering + priority across a single lookup.
 *  Built once per lookup so every stage (probe, phrase indexes, frequency,
 *  dictionary entries) uses the same enabled/profile/priority view. */
type ResourceContext = {
  /** Settings snapshot used for this lookup. */
  readonly settings: Settings;
  /** Active language profile id, or null when no profile is selected. */
  readonly activeProfileId: string | null;
  /** All resources allowed by enabled + active profile filters. */
  readonly resources: readonly ResourceInfo[];
  /** DICTIONARY resources allowed for this lookup. */
  readonly dictionaryResources: readonly ResourceInfo[];
  /** Set of all allowed resource ids (dictionary + frequency). */
  readonly allowedResourceIds: ReadonlySet<number>;
  /** resourceId → explicit priority (lower = higher). Unprioritized omitted. */
  readonly priorityMap: ReadonlyMap<number, number>;
  /** Ordered list of allowed resource ids (highest priority first). */
  readonly resourcePriority: readonly number[];
};

/** Build a priority map from explicit resource priorities. Absent = unprioritized. */
function buildPriorityMap(resources: readonly ResourceInfo[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of resources) {
    if (r.id === undefined || r.priority === undefined) continue;
    map.set(r.id, r.priority);
  }
  return map;
}

/** Build the resource priority ordering: lower explicit priority first, then
 *  resourceId descending for unprioritized resources (newest import wins). */
function buildResourcePriority(resources: readonly ResourceInfo[]): number[] {
  return [...resources]
    .sort((a, b) => {
      const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
      const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return (b.id ?? 0) - (a.id ?? 0);
    })
    .map((r) => r.id)
    .filter((id): id is number => id !== undefined);
}

/** Load all resources for a lang and apply enabled + active profile filters.
 *  Returns a context shared by probe, phrase matching, and frequency lookup. */
async function buildResourceContext(langCode: string, settings: Settings): Promise<ResourceContext> {
  const allResources = await getAllResources(langCode);
  const activeProfile = getActiveProfileSettings(settings);
  const activeProfileId = activeProfile?.id ?? null;

  const isAllowed = (r: ResourceInfo): boolean => {
    if (r.enabled === false) return false;
    if (activeProfileId && r.profileIds && r.profileIds.length > 0) {
      return r.profileIds.includes(activeProfileId);
    }
    return true;
  };

  const resources = allResources.filter(isAllowed);
  const dictionaryResources = resources.filter((r) => r.type === 'DICTIONARY');

  const allowedResourceIds = new Set<number>();
  for (const r of resources) {
    if (r.id !== undefined) allowedResourceIds.add(r.id);
  }

  const priorityMap = buildPriorityMap(resources);
  const resourcePriority = buildResourcePriority(resources);

  return {
    settings,
    activeProfileId,
    resources,
    dictionaryResources,
    allowedResourceIds,
    priorityMap,
    resourcePriority,
  };
}

function sortByResourcePriority<T extends { resourceId: number }>(
  entries: readonly T[],
  priorityMap: ReadonlyMap<number, number>,
): T[] {
  return [...entries].sort((a, b) => {
    const pa = priorityMap.get(a.resourceId) ?? Number.MAX_SAFE_INTEGER;
    const pb = priorityMap.get(b.resourceId) ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return b.resourceId - a.resourceId;
  });
}

function buildResourceCacheKey(context: ResourceContext): string {
  const ids = context.dictionaryResources
    .map((r) => r.id)
    .filter((id): id is number => id !== undefined)
    .sort((a, b) => a - b)
    .join(',');
  return `${context.activeProfileId ?? 'none'}:${ids}`;
}

export async function createDictionaryProbeAsync(
  langCode: string,
  context?: ResourceContext,
): Promise<TermProbe> {
  const resolvedContext = context ?? await buildResourceContext(langCode, await loadSettings().catch(() => DEFAULT_SETTINGS));

  // T23: Return cached probe if available. Cache key includes active profile
  // and allowed dictionary resource ids so enabling/disabling resources or
  // switching profiles invalidates the cache.
  const cacheKey = buildResourceCacheKey(resolvedContext);
  const cached = probeCache.get(cacheKey);
  if (cached) return cached;

  const { dictionaryResources } = resolvedContext;
  const terms = new Set<string>();

  // Load all dictionary terms. For CEDICT this is ~120k entries.
  for (const r of dictionaryResources) {
    if (r.id === undefined) continue;
    const entries = await findDictionaryByResource(langCode, r.id);
    for (const e of entries) {
      terms.add(e.term.trim().toLowerCase());
    }
  }

  const probe = { hasTerm: (term: string) => terms.has(term.toLowerCase()) };
  probeCache.set(cacheKey, probe);
  return probe;
}

/**
 * Run a lookup: phrase match (EN) or FMM segment (ZH) → dictionary query
 * → result assembly.
 *
 * @param request The lookup request (term, langCode, sentence, cursor).
 * @param deps Plugin registry + optional pre-loaded phrase indexes + settings.
 * @param signal Optional AbortSignal for cancellation.
 */
export async function lookupOrchestrator(
  request: LookupRequest,
  deps: {
    readonly pluginRegistry?: typeof pluginRegistry;
    readonly phraseIndexes?: ReadonlyMap<number, PhraseIndex>;
    readonly settings?: Settings;
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
    readonly settings?: Settings;
  } = {},
  signal?: AbortSignal,
): Promise<LookupResult[]> {
  checkAbort(signal);
  const { langCode, contextSentence, cursorOffset, term, fallback } = request;

  // Resolve settings and build the resource context once per lookup.
  const settings = deps.settings ?? await loadSettings().catch(() => DEFAULT_SETTINGS);
  const resourceContext = await buildResourceContext(langCode, settings);

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
  let phraseTraces: MatchTraceData[] | null = null;

  if (fallback) {
    // User selected text — use verbatim, no phrase match.
    matchSource = 'fallback';
  } else if (langCode === 'en') {
    // English: run phrase matcher with all phrase indexes (ADR-037).
    const collectTrace = isDevMode;
    const allMatches = await tryEnglishPhraseMatchAll(
      langCode, contextSentence, cursorOffset, deps, resourceContext, signal,
      collectTrace ? (traces) => { phraseTraces = traces; } : undefined,
    );
    if (allMatches.length > 0) {
      detectedPhrase = allMatches[0]!;
      matchSource = 'plugin';
      additionalPhraseMatches = allMatches.slice(1);
    }
  } else if (langCode === 'zh') {
    // Chinese: FMM segmentation to find the segment at the cursor.
    const probe = await createDictionaryProbeAsync(langCode, resourceContext);
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

  // 3. Build winner result: phrase match wins when valid; otherwise the surface
  //    token (with lemma fallback for definitions).
  const winnerResult = detectedPhrase
    ? await assembleLookupResult(langCode, detectedPhrase.dictionaryTerm, detectedPhrase, 'plugin', plugin, resourceContext, signal)
    : await assembleLookupResult(langCode, surfaceTerm, null, matchSource, plugin, resourceContext, signal, surfaceTerm);

  const additionalResults: LookupResult[] = [];
  const seen = new Set([winnerResult.term.toLowerCase()]);

  // 4. Add the hovered surface token as a candidate whenever it differs from
  //    the winner (e.g. phrase winner → hover word candidate, or origin winner
  //    already resolved to surfaceTerm).
  if (surfaceTerm.toLowerCase() !== winnerResult.term.toLowerCase()) {
    const surfaceResult = await assembleLookupResult(
      langCode, surfaceTerm, null, 'dictionary', plugin, resourceContext, signal, surfaceTerm,
    );
    if ((surfaceResult.definitions.length > 0 || surfaceResult.frequency || surfaceResult.reading) && !seen.has(surfaceResult.term.toLowerCase())) {
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
        langCode, candidate, null, 'dictionary', plugin, resourceContext, signal,
      );
      if ((lemmaResult.definitions.length > 0 || lemmaResult.frequency || lemmaResult.reading) && !seen.has(lemmaResult.term.toLowerCase())) {
        seen.add(lemmaResult.term.toLowerCase());
        additionalResults.push(lemmaResult);
      }
    }
  } else if (plugin.lemma) {
    const lemma = plugin.lemma(surfaceTerm);
    if (lemma && !seen.has(lemma.toLowerCase())) {
      checkAbort(signal);
      const lemmaResult = await assembleLookupResult(
        langCode, lemma, null, 'dictionary', plugin, resourceContext, signal,
      );
      if ((lemmaResult.definitions.length > 0 || lemmaResult.frequency || lemmaResult.reading) && !seen.has(lemmaResult.term.toLowerCase())) {
        additionalResults.push(lemmaResult);
      }
    }
  }

  // 6. Add remaining phrase matches after surface/origin candidates.
  for (const match of additionalPhraseMatches) {
    if (seen.has(match.dictionaryTerm.toLowerCase())) continue;
    checkAbort(signal);
    const result = await assembleLookupResult(
      langCode, match.dictionaryTerm, match, 'plugin', plugin, resourceContext, signal,
    );
    if (!seen.has(result.term.toLowerCase())) {
      seen.add(result.term.toLowerCase());
      additionalResults.push(result);
    }
  }

  const allResults = [winnerResult, ...additionalResults];

  // Dev-only: build + persist lookup log entry for phrase-matching analysis.
  if (isDevMode) {
    const entry = buildLookupLogEntry(
      request, surfaceTerm, phraseTraces, allResults,
    );
    void saveLookupLog(entry);
  }

  return allResults;
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
  resourceContext: ResourceContext,
  signal?: AbortSignal,
  /** If provided, the result header shows this surface term (e.g. the hovered
   *  token "is") while definitions are resolved from lookupTerm/its lemma. */
  displayTerm?: string,
): Promise<LookupResult> {
  checkAbort(signal);

  const { allowedResourceIds, resourcePriority, priorityMap } = resourceContext;

  let dictEntries = sortByResourcePriority(
    (await findDictionaryByTerm(langCode, lookupTerm))
      .filter((e) => allowedResourceIds.has(e.resourceId)),
    priorityMap,
  );
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
      dictEntries = sortByResourcePriority(
        (await findDictionaryByTerm(langCode, candidate))
          .filter((e) => allowedResourceIds.has(e.resourceId)),
        priorityMap,
      );
      if (dictEntries.length > 0) {
        effectiveTerm = candidate;
        break;
      }
    }
  } else if (dictEntries.length === 0 && plugin.lemma) {
    // Backward compat: single-lemma fallback for plugins without lemmaCandidates.
    const lemma = plugin.lemma(lookupTerm);
    if (lemma && lemma.toLowerCase() !== lookupTerm.toLowerCase()) {
      dictEntries = sortByResourcePriority(
        (await findDictionaryByTerm(langCode, lemma))
          .filter((e) => allowedResourceIds.has(e.resourceId)),
        priorityMap,
      );
      checkAbort(signal);
      if (dictEntries.length > 0) {
        effectiveTerm = lemma;
      }
    }
  }

  const surfaceTerm = displayTerm ?? effectiveTerm;
  let freqEntries = (await findFrequencyByTerm(langCode, surfaceTerm))
    .filter((e) => allowedResourceIds.has(e.resourceId));
  if (freqEntries.length === 0 && surfaceTerm !== effectiveTerm) {
    freqEntries = (await findFrequencyByTerm(langCode, effectiveTerm))
      .filter((e) => allowedResourceIds.has(e.resourceId));
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

  // Pick the rank from the highest-priority allowed frequency list that
  // contains the term; fall back to the best (lowest) rank when no priority
  // order is configured.
  const bestFreq = pickBestFrequencyEntry(freqEntries, resourcePriority);
  const frequency = bestFreq ? { rank: bestFreq.frequency, source: 'frequency' } : null;

  // Status is looked up for the displayed surface term (phrase or hover word).
  const status = await getWordStatus(langCode, surfaceTerm);

  return {
    term: surfaceTerm,
    langCode,
    reading,
    readingKind: plugin.readingKind,
    frequency,
    status,
    partsOfSpeech,
    definitions,
    rawDefinitions: dictEntries.map((e) => e.definition),
    detectedPhrase,
    matchSource,
  };
}

/**
 * Try English phrase match across all phrase indexes (multi-resource).
 * Returns ALL matches sorted by (priority, resourceId descending, comparePhraseMatches).
 * The first element is the winner; remaining are additional candidates.
 */
async function tryEnglishPhraseMatchAll(
  langCode: string,
  sentence: string,
  cursorOffset: number,
  deps: { readonly phraseIndexes?: ReadonlyMap<number, PhraseIndex> },
  resourceContext: ResourceContext,
  signal?: AbortSignal,
  /** Dev-only: nhận trace data từ mỗi matchPhraseAll call (per-resource). */
  traceCollector?: (traces: MatchTraceData[]) => void,
): Promise<PhraseMatch[]> {
  const dictionaryResourceIds = new Set(
    resourceContext.dictionaryResources
      .map((r) => r.id)
      .filter((id): id is number => id !== undefined),
  );

  let indexes: { resourceId: number; index: PhraseIndex }[];

  if (deps.phraseIndexes && deps.phraseIndexes.size > 0) {
    indexes = [...deps.phraseIndexes.entries()]
      .filter(([resourceId]) => dictionaryResourceIds.has(resourceId))
      .map(([resourceId, index]) => ({ resourceId, index }));
  } else {
    const stored = await getAllPhraseIndexes(langCode).catch(() => []);
    if (stored.length === 0) return [];
    checkAbort(signal);
    // Deserialize each blob — skip corrupted/version-mismatched blobs
    // and fall back to word-level lookup for those resources.
    indexes = [];
    for (const s of stored) {
      if (!dictionaryResourceIds.has(s.resourceId)) continue;
      try {
        indexes.push({ resourceId: s.resourceId, index: deserializePhraseIndex(s.blob) });
      } catch {
        // Version mismatch or corrupt blob — skip, word fallback handles it.
      }
    }
    if (indexes.length === 0) return [];
  }

  // Sort by priority, then resourceId descending (newest import wins).
  const { priorityMap } = resourceContext;
  indexes.sort((a, b) => {
    const pa = priorityMap.get(a.resourceId) ?? Number.MAX_SAFE_INTEGER;
    const pb = priorityMap.get(b.resourceId) ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return b.resourceId - a.resourceId;
  });

  const traces: MatchTraceData[] = [];
  const candidates: { resourceId: number; match: PhraseMatch }[] = [];
  for (const { resourceId, index } of indexes) {
    checkAbort(signal);
    // matchPhraseAll returns ALL matches at cursor (not just winner).
    const allMatches = matchPhraseAll(
      { sentence, cursorOffset },
      index,
      resourceId,
      traceCollector ? (trace) => traces.push(trace) : undefined,
    );
    for (const match of allMatches) {
      candidates.push({ resourceId, match });
    }
  }

  if (traceCollector) traceCollector(traces);

  if (candidates.length === 0) return [];

  // Sort: priority, then resourceId descending, then comparePhraseMatches.
  candidates.sort((a, b) => {
    const pa = priorityMap.get(a.resourceId) ?? Number.MAX_SAFE_INTEGER;
    const pb = priorityMap.get(b.resourceId) ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
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

// --- Dev-only lookup logging (ADR-037 phrase matching analysis) ---

/** Build a LookupLogEntry from the lookup flow data. Dev-only. */
function buildLookupLogEntry(
  request: LookupRequest,
  surfaceTerm: string,
  phraseTraces: MatchTraceData[] | null,
  results: readonly LookupResult[],
): LookupLogEntry {
  const tokens = tokenizeSentence(request.contextSentence);
  const logTokens: LogToken[] = tokens.map((t) => ({
    text: t.text, raw: t.raw, start: t.start, end: t.end,
  }));
  let targetTokenIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (request.cursorOffset >= tokens[i]!.start && request.cursorOffset < tokens[i]!.end) {
      targetTokenIndex = i;
      break;
    }
  }

  const phraseMatch = phraseTraces && phraseTraces.length > 0
    ? buildPhraseMatchTrace(phraseTraces)
    : undefined;

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    request: {
      term: request.term,
      langCode: request.langCode,
      contextSentence: request.contextSentence,
      cursorOffset: request.cursorOffset,
      fallback: request.fallback ?? false,
    },
    tokens: logTokens,
    targetTokenIndex,
    surfaceTerm,
    phraseMatch,
    results: results.map((r) => ({
      term: r.term,
      detectedPhrase: r.detectedPhrase
        ? {
          dictionaryTerm: r.detectedPhrase.dictionaryTerm,
          surface: r.detectedPhrase.surface,
          quality: r.detectedPhrase.quality,
          sourceResourceId: r.detectedPhrase.sourceResourceId,
        }
        : null,
      matchSource: r.matchSource,
      hasDefinitions: r.definitions.length > 0,
    })),
  };
}

/** Aggregate per-resource MatchTraceData[] into a single PhraseMatchTrace. */
function buildPhraseMatchTrace(traces: MatchTraceData[]): PhraseMatchTrace {
  const resourcesScanned = traces.flatMap((t) => t.resourcesScanned);
  const candidateTemplateIds = [...new Set(traces.flatMap((t) => t.candidateTemplateIds))];
  const anchorHits: Record<string, number[]> = {};
  for (const t of traces) {
    for (const [token, ids] of Object.entries(t.anchorHits)) {
      (anchorHits[token] ??= []).push(...ids);
    }
  }
  const perCandidate: CandidateMatchTrace[] = traces.flatMap((t) => t.perCandidate);

  // Merge ranked from all resources, re-sort by ranking tuple (quality → fixed
  // → fixedMatched → spanLen → slot → freq → templateId), assign rank.
  const allRanked: RankedCandidateTrace[] = traces.flatMap((t) => t.ranked);
  allRanked.sort((a, b) => {
    const q = b.rankingTuple.qualityRank - a.rankingTuple.qualityRank;
    if (q !== 0) return q;
    const f = b.rankingTuple.fixedTokenCount - a.rankingTuple.fixedTokenCount;
    if (f !== 0) return f;
    const fm = b.rankingTuple.fixedMatched - a.rankingTuple.fixedMatched;
    if (fm !== 0) return fm;
    const s = b.rankingTuple.spanLen - a.rankingTuple.spanLen;
    if (s !== 0) return s;
    const sl = (a.rankingTuple.slotUsed ? 1 : 0) - (b.rankingTuple.slotUsed ? 1 : 0);
    if (sl !== 0) return sl;
    const fr = a.rankingTuple.frequencyRank - b.rankingTuple.frequencyRank;
    if (fr !== 0) return fr;
    return a.rankingTuple.templateId - b.rankingTuple.templateId;
  });
  const ranked = allRanked.map((r, i) => ({ ...r, rank: i }));

  const winner = ranked[0];
  const runnerUp = ranked[1];
  const beatRunnerUpBy = winner && runnerUp
    ? describeRankingDiff(winner.rankingTuple, runnerUp.rankingTuple)
    : winner ? 'no runner-up — only 1 candidate matched' : 'no match';

  return {
    resourcesScanned,
    candidateTemplateIds,
    anchorHits,
    perCandidate,
    ranked,
    winner: winner
      ? { dictionaryTerm: winner.dictionaryTerm, surface: winner.surface, resourceId: winner.resourceId, beatRunnerUpBy }
      : { dictionaryTerm: '', surface: '', resourceId: 0, beatRunnerUpBy: beatRunnerUpBy },
  };
}

/** Human-readable: vì sao winner thắng runner-up theo ranking tuple. */
function describeRankingDiff(
  winner: RankedCandidateTrace['rankingTuple'],
  runnerUp: RankedCandidateTrace['rankingTuple'],
): string {
  if (winner.qualityRank !== runnerUp.qualityRank) {
    const names: Record<number, string> = { 4: 'fixed', 3: 'inflected', 2: 'possessive-template', 1: 'slot-template' };
    return `quality (${names[winner.qualityRank]} > ${names[runnerUp.qualityRank]})`;
  }
  if (winner.fixedTokenCount !== runnerUp.fixedTokenCount) {
    return `fixedTokenCount (${winner.fixedTokenCount} > ${runnerUp.fixedTokenCount})`;
  }
  if (winner.fixedMatched !== runnerUp.fixedMatched) {
    return `fixedMatched (${winner.fixedMatched} > ${runnerUp.fixedMatched})`;
  }
  if (winner.spanLen !== runnerUp.spanLen) {
    return `spanLen (${winner.spanLen} > ${runnerUp.spanLen})`;
  }
  if (winner.slotUsed !== runnerUp.slotUsed) {
    return `slotUsed (winner: ${winner.slotUsed}, runner: ${runnerUp.slotUsed})`;
  }
  if (winner.frequencyRank !== runnerUp.frequencyRank) {
    return `frequencyRank (${winner.frequencyRank} < ${runnerUp.frequencyRank})`;
  }
  return `templateId (${winner.templateId} < ${runnerUp.templateId})`;
}
