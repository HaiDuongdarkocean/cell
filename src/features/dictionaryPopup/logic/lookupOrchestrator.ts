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

import type { LookupRequest, LookupResult, DefinitionEntry, MatchSource } from '@/entities/dictionary';
import type { Token, TermProbe, LanguagePlugin } from '../plugins/languagePlugin';
import { pluginRegistry } from '../plugins/pluginRegistry';
import {
  findDictionaryByTerm,
  findDictionaryByResource,
} from '@/features/dictionary/repositories/dictionaryRepository';
import { findFrequencyByTerm } from '@/features/dictionary/repositories/frequencyRepository';
import { getAllResources } from '@/features/dictionary/repositories/resourceRepository';
import { getWordStatus } from '@/features/dictionary/services/wordStatusStore';
import {
  getPhraseIndex,
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
} from '@/features/dictionary/logic/lookupLogTypes';
import { tokenizeSentence } from '@/features/dictionary/logic/phraseMatcher';
import { pickBestFrequencyEntry } from '@/shared/lib/frequencyBand';
import { getActiveProfileSettings, type Settings } from '@/entities/settings';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { ResourceInfo } from '@/entities/dictionary';
import { lineToCanonicalText, buildPhraseIndexForResource, toCanonicalDefinition } from '@/features/dictionary';
import type { SenseLine, SenseBlock, RelatedEntry, EtymologyBlock, InflectionGroup } from '@/entities/dictionary';

const EMPTY_COMPONENT_SET: ReadonlySet<string> = new Set();

/** Check if an AbortSignal is aborted. */
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Lookup aborted');
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

/** Deserialized phrase indexes keyed langCode → resourceId. null = the
 *  resource has no (readable) index so we don't re-read it per lookup. */
const phraseIndexCache = new Map<string, Map<number, PhraseIndex | null>>();

const phraseIndexRebuilds = new Set<string>();

/** Clear lookup caches (probe + phrase indexes) after resource mutations. */
export function clearDictionaryProbeCache(): void {
  probeCache.clear();
  phraseIndexCache.clear();
  phraseIndexRebuilds.clear();
}

function schedulePhraseIndexRebuild(langCode: string, resourceId: number): void {
  const key = `${langCode}:${resourceId}`;
  if (phraseIndexRebuilds.has(key)) return;
  phraseIndexRebuilds.add(key);
  void buildPhraseIndexForResource(langCode, resourceId).catch(() => undefined);
}

/** Runtime context for resource filtering + priority across a single lookup.
 *  Built once per lookup so every stage (probe, phrase indexes, frequency,
 *  dictionary entries) uses the same enabled/priority view. */
type ResourceContext = {
  /** Settings snapshot used for this lookup. */
  readonly settings: Settings;
  /** All resources allowed by the enabled filter. */
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

/** Load all resources for a lang and apply the enabled filter. Returns a
 *  context shared by probe, phrase matching, and frequency lookup. */
async function buildResourceContext(langCode: string, settings: Settings): Promise<ResourceContext> {
  const allResources = await getAllResources(langCode);

  const isAllowed = (r: ResourceInfo): boolean => {
    if (r.installationFinished === false) return false;
    if (r.enabled === false) return false;
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
  return ids;
}

export async function createDictionaryProbeAsync(
  langCode: string,
  context?: ResourceContext,
): Promise<TermProbe> {
  const resolvedContext = context ?? await buildResourceContext(langCode, await loadSettings().catch(() => DEFAULT_SETTINGS));

  // T23: Return cached probe if available. The cache key is the set of
  // allowed dictionary resource ids so enabling/disabling resources
  // invalidates the cache.
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
  const { contextSentence, cursorOffset, term, fallback } = request;

  // Resolve settings and build the resource context once per lookup.
  const settings = deps.settings ?? await loadSettings().catch(() => DEFAULT_SETTINGS);
  const langCode = getActiveProfileSettings(settings)?.resourceLangCode ?? request.langCode;
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
  let phraseIndexPending = false;

  if (fallback) {
    // User selected text — use verbatim, no phrase match.
    matchSource = 'fallback';
  } else if (langCode === 'en') {
    // English: run phrase matcher with all phrase indexes (ADR-037).
    const collectTrace = isDevMode;
    const outcome = await tryEnglishPhraseMatchAll(
      langCode, contextSentence, cursorOffset, deps, resourceContext, signal,
      collectTrace ? (traces) => { phraseTraces = traces; } : undefined,
    );
    phraseIndexPending = outcome.pending;
    const allMatches = outcome.matches;
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

  const allResults: LookupResult[] = [
    phraseIndexPending ? { ...winnerResult, phraseIndexPending: true } : winnerResult,
    ...additionalResults,
  ];

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

  const initialSurface = displayTerm ?? lookupTerm;
  const [dictRaw, freqRaw, statusInit] = await Promise.all([
    findDictionaryByTerm(langCode, lookupTerm),
    findFrequencyByTerm(langCode, initialSurface),
    getWordStatus(langCode, initialSurface),
  ]);
  let dictEntries = sortByResourcePriority(
    dictRaw.filter((e) => allowedResourceIds.has(e.resourceId)),
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
      // Skip only the exact string already queried — the by_term index is
      // case-sensitive, so a lowercase candidate differing only by case
      // (e.g. "i take it" for "I take it") must still be tried.
      if (candidate === lookupTerm) continue;
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
    if (lemma && lemma !== lookupTerm) {
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
  let freqEntries = surfaceTerm === initialSurface
    ? freqRaw.filter((e) => allowedResourceIds.has(e.resourceId))
    : (await findFrequencyByTerm(langCode, surfaceTerm))
      .filter((e) => allowedResourceIds.has(e.resourceId));
  if (freqEntries.length === 0 && surfaceTerm !== effectiveTerm) {
    freqEntries = (await findFrequencyByTerm(langCode, effectiveTerm))
      .filter((e) => allowedResourceIds.has(e.resourceId));
  }
  checkAbort(signal);

  const resourceNameById = new Map<number, string>();
  const disabledByResource = new Map<number, ReadonlySet<string>>();
  for (const r of resourceContext.resources) {
    if (r.id !== undefined) {
      resourceNameById.set(r.id, r.name.replace(/\.(json|zip|db|gz|txt)+$/i, ''));
      if (r.disabledComponents?.length) {
        disabledByResource.set(r.id, new Set(r.disabledComponents));
      }
    }
  }
  const disabledOf = (resourceId: number): ReadonlySet<string> =>
    disabledByResource.get(resourceId) ?? EMPTY_COMPONENT_SET;

  const definitions: DefinitionEntry[] = [];
  const relatedMap = new Map<string, RelatedEntry>();
  let inflections: InflectionGroup[] | undefined;
  const derivedTermsSet = new Set<string>();
  const wfSets = { nouns: new Set<string>(), verbs: new Set<string>(), adjectives: new Set<string>(), adverbs: new Set<string>() };
  const wnSets = { synset: new Set<string>(), hypernyms: new Set<string>() };
  let hasWordFamily = false;
  let hasWordNet = false;
  let level: string | undefined;
  let frequencyStars: number | undefined;
  let etymology: EtymologyBlock | undefined;
  let etymologySource: string | undefined;
  const etyExtraVariants: { text: string; source?: string }[] = [];
  let defIdx = 0;
  for (const e of dictEntries) {
    const disabled = disabledOf(e.resourceId);
    const entryExamples: SenseLine[] = !disabled.has('examples') && e.examples
      ? e.examples.split('\n').filter(Boolean).map((t) => ({ role: 'example' as const, text: t }))
      : [];
    const source = resourceNameById.get(e.resourceId) ?? 'dictionary';
    // Structured senses (new imports) are used verbatim; legacy rows (no
    // `senses`) go through the same import-time canonical normalizer so both
    // paths produce identical SenseBlock IR. `lines` carries roles +
    // translations for the UI; `text` stays the line-joined body for
    // Anki/legacy consumers.
    const senseBlocks: readonly SenseBlock[] = disabled.has('definitions')
      ? []
      : e.senses?.length
        ? e.senses
        : toCanonicalDefinition({ term: e.term, definition: e.definition }).senses;
    const senses = senseBlocks.map((s) => ({
      pos: s.pos ?? '',
      labels: s.labels,
      level: s.level,
      lines: s.lines
        .map((l) => disabled.has('translations') ? { ...l, translation: undefined } : l),
      subsenses: s.subsenses,
      synonyms: disabled.has('synonyms') ? undefined : s.synonyms,
      antonyms: disabled.has('synonyms') ? undefined : s.antonyms,
    }));
    for (const sense of senses) {
      const glossLines = sense.lines.filter((l) => l.role !== 'example');
      const senseExamples = disabled.has('examples') ? [] : sense.lines.filter((l) => l.role === 'example');
      definitions.push({
        id: `def-${defIdx}`,
        pos: sense.pos || e.pos || undefined,
        labels: sense.labels,
        level: sense.level,
        text: glossLines.map(lineToCanonicalText).join('\n'),
        lines: glossLines,
        subsenses: sense.subsenses,
        synonyms: sense.synonyms,
        antonyms: sense.antonyms,
        examples: [...senseExamples, ...entryExamples],
        source,
        defaultSelected: false,
      });
      defIdx++;
    }

    // Entry-level merge — dictEntries is already sorted by resource priority.
    // Singletons (word forms, IPA, stars, level) are first-wins so a disabled
    // component falls through to the next dictionary; lists union+dedupe;
    // etymology chains after the first become checkable variants.
    if (!disabled.has('related')) {
      for (const r of e.related ?? []) {
        const key = r.term.toLowerCase().replace(/^to\s+/, '');
        if (!relatedMap.has(key)) relatedMap.set(key, r);
      }
    }
    if (!inflections?.length && !disabled.has('inflections') && e.inflections?.length) {
      inflections = [...e.inflections];
    }
    if (!disabled.has('derivedTerms')) {
      for (const t of e.derivedTerms ?? []) derivedTermsSet.add(t);
    }
    if (e.wordFamily && !disabled.has('wordFamily')) {
      for (const t of e.wordFamily.nouns ?? []) wfSets.nouns.add(t);
      for (const t of e.wordFamily.verbs ?? []) wfSets.verbs.add(t);
      for (const t of e.wordFamily.adjectives ?? []) wfSets.adjectives.add(t);
      for (const t of e.wordFamily.adverbs ?? []) wfSets.adverbs.add(t);
      hasWordFamily = true;
    }
    if (e.wordNet && !disabled.has('wordNet')) {
      for (const t of e.wordNet.synset ?? []) wnSets.synset.add(t);
      for (const t of e.wordNet.hypernyms ?? []) wnSets.hypernyms.add(t);
      hasWordNet = true;
    }
    if (!disabled.has('level')) level ??= e.level;
    if (!disabled.has('frequencyStars')) frequencyStars ??= e.frequencyStars;
    if (e.etymology && !disabled.has('etymology')) {
      if (!etymology) {
        etymology = { chain: e.etymology.chain, firstKnownUse: e.etymology.firstKnownUse, variants: e.etymology.variants };
        etymologySource = source;
      } else {
        etyExtraVariants.push({ text: e.etymology.chain, source }, ...(e.etymology.variants ?? []));
      }
    }
  }

  const mergedEtymology = etymology
    ? { ...etymology, variants: [...(etymology.variants ?? []), ...etyExtraVariants] }
    : undefined;

  // Word origin is selectable content like senses — emit it as labeled
  // definition rows so it flows through the same check/card path.
  if (mergedEtymology) {
    const rows = [
      mergedEtymology.firstKnownUse
        ? `${mergedEtymology.chain} · first known use: ${mergedEtymology.firstKnownUse}`
        : mergedEtymology.chain,
      ...(mergedEtymology.variants ?? []).map((v) => (v.source ? `${v.text} [${v.source}]` : v.text)),
    ];
    for (const text of rows) {
      definitions.push({
        id: `def-${defIdx}`,
        labels: ['word origin'],
        text,
        lines: [{ role: 'gloss', text }],
        examples: [],
        source: etymologySource ?? 'dictionary',
        defaultSelected: false,
      });
      defIdx++;
    }
  }
  const partsOfSpeech = [...new Set(definitions.map((d) => d.pos).filter(Boolean))] as string[];

  const pronEntry = dictEntries.find(
    (e) => !disabledOf(e.resourceId).has('pronunciation')
      && (e.pronunciation || (e.reading && e.reading.toLowerCase() !== effectiveTerm.toLowerCase())),
  );
  const rawReading = pronEntry?.pronunciation || pronEntry?.reading || '';
  const reading = rawReading && rawReading.toLowerCase() === effectiveTerm.toLowerCase()
    ? ''
    : rawReading;

  // Pick the rank from the highest-priority allowed frequency list that
  // contains the term; fall back to the best (lowest) rank when no priority
  // order is configured.
  const bestFreq = pickBestFrequencyEntry(freqEntries, resourcePriority);
  const frequency = bestFreq ? { rank: bestFreq.frequency, source: 'frequency' } : null;

  // Status is looked up for the displayed surface term (phrase or hover word).
  const status = surfaceTerm === initialSurface
    ? statusInit
    : await getWordStatus(langCode, surfaceTerm);

  return {
    term: surfaceTerm,
    langCode,
    reading,
    readingKind: plugin.readingKind,
    frequency,
    status,
    partsOfSpeech,
    definitions,
    rawDefinitions: dictEntries
      .filter((e) => !disabledOf(e.resourceId).has('definitions'))
      .map((e) => e.definition),
    detectedPhrase,
    related: relatedMap.size > 0 ? [...relatedMap.values()] : undefined,
    inflections,
    level,
    frequencyStars,
    etymology: mergedEtymology,
    wordFamily: hasWordFamily ? {
      nouns: [...wfSets.nouns],
      verbs: [...wfSets.verbs],
      adjectives: [...wfSets.adjectives],
      adverbs: [...wfSets.adverbs],
    } : undefined,
    wordNet: hasWordNet ? {
      synset: [...wnSets.synset],
      hypernyms: [...wnSets.hypernyms],
    } : undefined,
    derivedTerms: derivedTermsSet.size > 0 ? [...derivedTermsSet] : undefined,
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
): Promise<{ matches: PhraseMatch[]; pending: boolean }> {
  const dictionaryResourceIds = new Set(
    resourceContext.dictionaryResources
      .map((r) => r.id)
      .filter((id): id is number => id !== undefined),
  );

  let indexes: { resourceId: number; index: PhraseIndex }[];
  let pending = false;

  if (deps.phraseIndexes && deps.phraseIndexes.size > 0) {
    indexes = [...deps.phraseIndexes.entries()]
      .filter(([resourceId]) => dictionaryResourceIds.has(resourceId))
      .map(([resourceId, index]) => ({ resourceId, index }));
  } else {
    let langCache = phraseIndexCache.get(langCode);
    if (!langCache) {
      langCache = new Map<number, PhraseIndex | null>();
      phraseIndexCache.set(langCode, langCache);
    }
    indexes = [];
    const missing: number[] = [];
    for (const resourceId of dictionaryResourceIds) {
      const cached = langCache.get(resourceId);
      if (cached) indexes.push({ resourceId, index: cached });
      else if (cached === undefined) missing.push(resourceId);
    }
    if (missing.length > 0) {
      checkAbort(signal);
      const stored = await Promise.all(
        missing.map((rid) => getPhraseIndex(langCode, rid).catch(() => undefined)),
      );
      for (let i = 0; i < missing.length; i++) {
        const rid = missing[i]!;
        const s = stored[i];
        if (!s) {
          schedulePhraseIndexRebuild(langCode, rid);
          pending = true;
          continue;
        }
        try {
          const index = deserializePhraseIndex(s.blob);
          langCache.set(rid, index);
          indexes.push({ resourceId: rid, index });
        } catch {
          schedulePhraseIndexRebuild(langCode, rid);
          pending = true;
        }
      }
    }
    if (indexes.length === 0) return { matches: [], pending };
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

  if (candidates.length === 0) return { matches: [], pending };

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

  return { matches: unique, pending };
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
