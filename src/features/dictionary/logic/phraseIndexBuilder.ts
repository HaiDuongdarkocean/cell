// phraseIndexBuilder — ADR-037 §7.2: build phrase index blob during import.
//
// Collects multiword terms from stored Cambridge dictionary entries, parses
// each into an AST, filters to supported templates, compiles a compact anchor
// index, and serializes the blob. Definitions/examples/media stay out of the
// blob — only AST + anchor postings.
//
// Called by importOrchestrator after the Cambridge strategy succeeds and
// before the resource is marked installationFinished=true. A builder failure
// rolls back the whole import (entries + blob + resource).

import { parsePhraseTemplate, type PhraseTemplateStatus } from './phraseTemplateParser';
import {
  compilePhraseIndex,
  serializePhraseIndex,
  type PhraseIndexInput,
} from './phraseIndexCompiler';
import { findDictionaryByResource } from '../repositories/dictionaryRepository';
import { putPhraseIndex } from '../repositories/phraseIndexRepository';

/**
 * Conservative set of English verbs whose literals should be marked inflectable
 * (so the matcher accepts inflected forms: take/took/taken/taking, run/ran/…).
 *
 * This set is NO LONGER the sole source of inflectable verbs — the builder
 * now auto-collects ALL first words from multiword terms and passes them as
 * inflectableLiterals (see buildPhraseIndexForResource). This set is kept
 * only for backward compatibility with tests that import it directly.
 *
 * Sourced from the most common Cambridge phrasal-verb heads. A literal not in
 * this set is matched verbatim — safer to under-approximate than to mark a
 * non-verb as inflectable.
 */
export const ENGLISH_INFLECTABLE_VERBS = new Set<string>([
  'be', 'spill', 'break', 'kick', 'carry', 'take', 'give', 'run', 'pick',
  'put', 'hit', 'come', 'look', 'get', 'start', 'go', 'make', 'do', 'have',
  'see', 'know', 'think', 'say', 'tell', 'find', 'call', 'try', 'ask', 'seem',
  'feel', 'leave', 'work', 'keep', 'let', 'begin', 'show', 'hear', 'play',
  'turn', 'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write',
  'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue',
  'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop',
  'create', 'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk',
  'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy', 'wait',
  'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach',
  'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'report', 'decide',
  'pull', 'return', 'explain', 'hope', 'develop', 'receive', 'agree', 'support',
  'produce', 'eat', 'cover', 'catch', 'draw', 'choose', 'point', 'save',
  'design', 'arrive', 'visit',
]);

/** Result of a phrase index build for one resource. */
export interface PhraseIndexBuildResult {
  readonly compilerVersion: number;
  readonly termCount: number;
  readonly unsupportedCount: number;
  /** Breakdown of why terms were excluded, keyed by PhraseTemplateStatus. */
  readonly unsupportedBreakdown: Readonly<Record<PhraseTemplateStatus, number>>;
}

/**
 * Build and persist the phrase index blob for a Cambridge dictionary resource.
 *
 * Reads stored dictionary entries, collects multiword terms, parses + compiles
 * the supported subset, and calls putPhraseIndex. Throws on any failure — the
 * caller (importOrchestrator) rolls back the import.
 */
export async function buildPhraseIndexForResource(
  langCode: string,
  resourceId: number,
): Promise<PhraseIndexBuildResult> {
  const entries = await findDictionaryByResource(langCode, resourceId);

  const seen = new Set<string>();
  const inputs: PhraseIndexInput[] = [];
  const breakdown: Record<PhraseTemplateStatus, number> = {
    supported: 0,
    unsupportedOpen: 0,
    unsupportedMalformed: 0,
    unsupportedLimit: 0,
  };
  let nextId = 0;

  // Pass 1: auto-collect first words from all multiword terms.
  // Data-driven inflectable set — any first word in a template is a potential
  // verb head (burn, steal, fly, …). This replaces the curated ~100-verb list
  // which missed thousands of Cambridge verbs. The lemmatizer only strips
  // -ed/-ing/-s, so non-verb first words (the, a, in) are harmless — they have
  // no suffix to strip and return [word] unchanged.
  // ponytail: marking non-verbs inflectable is safe because candidateLemmas
  // is over-generative by design — false candidates don't match any anchor.
  const firstWords = new Set<string>();
  for (const entry of entries) {
    const term = entry.term.trim().normalize('NFC').toLowerCase();
    if (!term || term.split(/\s+/).length < 2) continue;
    const firstWord = term.split(/\s+/)[0]!;
    firstWords.add(firstWord);
  }

  // Pass 2: parse each term with auto-collected inflectable set.
  for (const entry of entries) {
    const term = entry.term.trim().normalize('NFC').toLowerCase();
    // Only multiword terms (≥2 whitespace tokens) are phrase candidates.
    if (!term || term.split(/\s+/).length < 2) continue;
    if (seen.has(term)) continue;
    seen.add(term);

    const parsed = parsePhraseTemplate(term, { inflectableLiterals: firstWords });
    if (parsed.status !== 'supported') {
      breakdown[parsed.status]++;
      continue;
    }
    breakdown.supported++;
    inputs.push({
      templateId: nextId++,
      sourceTerm: parsed.sourceTerm,
      normalizedTerm: parsed.normalizedTerm,
      nodes: parsed.nodes,
      fixedTokenCount: parsed.fixedTokenCount,
      minSurfaceTokens: parsed.minSurfaceTokens,
      maxSurfaceTokens: parsed.maxSurfaceTokens,
      frequencyRank: 0,
    });
  }

  const unsupportedCount =
    breakdown.unsupportedOpen + breakdown.unsupportedMalformed + breakdown.unsupportedLimit;

  // An empty supported set is not an error — a Cambridge resource with no
  // multiword terms simply produces no phrase index. We still persist a blob
  // so the worker knows this resource has been processed.
  const index = compilePhraseIndex(inputs);
  const blob = serializePhraseIndex(index);

  await putPhraseIndex(langCode, resourceId, blob, {
    compilerVersion: index.compilerVersion,
    termCount: index.termCount,
  });

  return {
    compilerVersion: index.compilerVersion,
    termCount: index.termCount,
    unsupportedCount,
    unsupportedBreakdown: breakdown,
  };
}
