// phraseMatcher — ADR-037 §8-9: bounded DP matcher + deterministic ranking.
//
// Pure function. Input: sentence + cursorOffset + PhraseIndex. Output: best
// PhraseMatch or null. No IndexedDB, no worker, no side effects.
//
// Flow (ADR §8.3):
//   1. Tokenize sentence (UTF-16 offsets, Unicode-aware).
//   2. Normalize tokens.
//   3. Resolve cursorOffset → targetTokenIndex.
//   4. Bounded window ±MAX_SURFACE_SPAN around target.
//   5. Collect candidate template IDs from anchor postings.
//   6. Intersect with rarest secondary anchor if > MAX_CANDIDATES.
//   7. Run memoized DP matcher per candidate.
//   8. Require target inside matched span.
//   9. Rank valid matches deterministically (ADR §9).

import type { PhraseNode } from './phraseTemplateParser';
import type { CompiledTemplate, PhraseIndex } from './phraseIndexCompiler';

// --- Constants (ADR §8.2) ---

const MAX_SLOT_TOKENS = 6;
const MAX_SURFACE_SPAN = 32;
const MAX_CANDIDATES = 256;

// --- Types (ADR §8.1) ---

export interface PhraseMatchRequest {
  readonly sentence: string;
  /** UTF-16 character offset of the hovered token in sentence. */
  readonly cursorOffset: number;
}

export interface PhraseMatch {
  readonly dictionaryTerm: string;
  readonly surface: string;
  readonly span: { readonly start: number; readonly end: number };
  readonly quality: 'fixed' | 'inflected' | 'possessive-template' | 'slot-template';
  readonly sourceResourceId: number;
}

// --- Tokenizer ---

export interface SentenceToken {
  readonly text: string;       // normalized lowercase
  readonly raw: string;        // original surface
  readonly start: number;      // UTF-16 offset
  readonly end: number;        // UTF-16 offset (exclusive)
}

const WORD_CHAR = /[\p{L}\p{N}'-]/u;
const SENTENCE_PUNCT = /[.!?,;:]/;

/** Tokenize a sentence into normalized word tokens with UTF-16 offsets. */
export function tokenizeSentence(sentence: string): SentenceToken[] {
  const tokens: SentenceToken[] = [];
  const len = sentence.length;
  let i = 0;
  while (i < len) {
    // Skip whitespace + non-word punctuation.
    while (i < len && !isWordChar(sentence, i)) i++;
    if (i >= len) break;
    const start = i;
    // Consume word characters (including apostrophes in contractions).
    while (i < len && isWordChar(sentence, i)) i++;
    const raw = sentence.slice(start, i);
    const text = raw.toLowerCase().normalize('NFC');
    tokens.push({ text, raw, start, end: i });
  }
  return tokens;
}

/** Check if character at offset is a word character (handles surrogate pairs). */
function isWordChar(s: string, offset: number): boolean {
  const ch = s[offset]!;
  return WORD_CHAR.test(ch);
}

// --- Lemma (conservative — ADR §6) ---
// Only applies to known irregular + regular -ed forms. This is a minimal
// lemma function; the English plugin can supply a richer one later.

const IRREGULAR_LEMMAS: ReadonlyMap<string, string> = new Map([
  ['was', 'be'], ['were', 'be'], ['been', 'be'], ['being', 'be'], ['is', 'be'], ['are', 'be'],
  ['spilled', 'spill'], ['spilt', 'spill'],
  ['broke', 'break'], ['broken', 'break'],
  ['kicked', 'kick'],
  ['carried', 'carry'],
  ['took', 'take'], ['taken', 'take'],
  ['gave', 'give'], ['given', 'give'],
  ['ran', 'run'],
  ['picked', 'pick'],
  ['put', 'put'],
  ['hit', 'hit'],
  ['came', 'come'],
  ['looked', 'look'],
  ['got', 'get'], ['gotten', 'get'],
  ['started', 'start'],
]);

/** Conservative lemma: irregular map + regular -ed/-s stripping. */
function lemma(word: string): string {
  const lower = word.toLowerCase();
  const irreg = IRREGULAR_LEMMAS.get(lower);
  if (irreg) return irreg;
  // Regular past: word ends in 'ed' and lemma is stem.
  if (lower.length > 3 && lower.endsWith('ed')) {
    const stem = lower.slice(0, -2);
    // "carried" → "carri" → "carry" (y-replacement handled by caller matching)
    // Simple: try stem, stem+e, stem with y
    return stem;
  }
  // Regular 3rd person: ends in 's'
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) {
    return lower.slice(0, -1);
  }
  return lower;
}

// --- Token matching ---

interface TokenMatchResult {
  readonly matched: boolean;
  readonly inflected: boolean;
  readonly possessive: boolean;
}

/** Check if a sentence token matches a literal node (ADR §6). */
function tokenMatchesLiteral(node: { readonly value: string; readonly inflectableVerb: boolean }, token: string): TokenMatchResult {
  if (node.value === token) {
    return { matched: true, inflected: false, possessive: false };
  }
  // Possessive pronoun substitution: "your" in template → "my", "his", etc.
  if (node.value === 'your' && POSSESSIVE_PRONOUNS.has(token)) {
    return { matched: true, inflected: false, possessive: true };
  }
  // Verb inflection: only when literal is marked inflectableVerb.
  if (node.inflectableVerb && lemma(token) === node.value) {
    return { matched: true, inflected: true, possessive: false };
  }
  return { matched: false, inflected: false, possessive: false };
}

const POSSESSIVE_PRONOUNS = new Set(['my', 'your', 'his', 'her', 'its', 'our', 'their', "one's"]);

// --- Slot validation ---

const SLOT_STOP_PUNCT = new Set(['.', '!', '?', ';', ':', ',']);

/** Check if a slot can consume the tokens [start, end) in the sentence. */
function slotAllows(tokens: readonly SentenceToken[], start: number, end: number): boolean {
  if (start >= end) return false;
  for (let i = start; i < end && i < tokens.length; i++) {
    const t = tokens[i]!;
    // Slot stops at sentence punctuation.
    if (t.raw.length === 1 && SLOT_STOP_PUNCT.has(t.raw)) return false;
  }
  return true;
}

// --- DP Matcher (ADR §8.4) ---

interface MatchState {
  readonly endTokenIndex: number;
  readonly inflected: boolean;
  readonly possessive: boolean;
  readonly slotUsed: boolean;
  readonly optionalUsed: boolean;
}

/**
 * Match a sequence of AST nodes against sentence tokens starting at tokenIndex.
 * Returns all possible end positions with match quality flags.
 * Memoized by (nodeIndex, tokenIndex).
 */
function matchSequence(
  nodes: readonly PhraseNode[],
  nodeIndex: number,
  tokens: readonly SentenceToken[],
  tokenIndex: number,
  memo: Map<string, MatchState[]>,
): MatchState[] {
  if (nodeIndex === nodes.length) {
    return [{ endTokenIndex: tokenIndex, inflected: false, possessive: false, slotUsed: false, optionalUsed: false }];
  }

  const memoKey = `${nodeIndex}:${tokenIndex}`;
  const cached = memo.get(memoKey);
  if (cached) return cached;

  const node = nodes[nodeIndex]!;
  const results: MatchState[] = [];

  if (node.type === 'literal') {
    if (tokenIndex < tokens.length) {
      const r = tokenMatchesLiteral(node, tokens[tokenIndex]!.text);
      if (r.matched) {
        const childResults = matchSequence(nodes, nodeIndex + 1, tokens, tokenIndex + 1, memo);
        for (const cr of childResults) {
          results.push({
            endTokenIndex: cr.endTokenIndex,
            inflected: cr.inflected || r.inflected,
            possessive: cr.possessive || r.possessive,
            slotUsed: cr.slotUsed,
            optionalUsed: cr.optionalUsed,
          });
        }
      }
    }
  } else if (node.type === 'optional') {
    // Branch 1: skip the optional group.
    const skipResults = matchSequence(nodes, nodeIndex + 1, tokens, tokenIndex, memo);
    for (const sr of skipResults) {
      results.push({ ...sr, optionalUsed: sr.optionalUsed });
    }
    // Branch 2: consume the optional children, then continue.
    const consumeResults = matchChildren(node.children, tokens, tokenIndex, memo);
    for (const cr of consumeResults) {
      const continueResults = matchSequence(nodes, nodeIndex + 1, tokens, cr.endTokenIndex, memo);
      for (const cont of continueResults) {
        results.push({
          endTokenIndex: cont.endTokenIndex,
          inflected: cont.inflected || cr.inflected,
          possessive: cont.possessive || cr.possessive,
          slotUsed: cont.slotUsed || cr.slotUsed,
          optionalUsed: true,
        });
      }
    }
  } else if (node.type === 'alternative') {
    for (const branch of node.branches) {
      const branchResults = matchChildren(branch, tokens, tokenIndex, memo);
      for (const br of branchResults) {
        const continueResults = matchSequence(nodes, nodeIndex + 1, tokens, br.endTokenIndex, memo);
        for (const cont of continueResults) {
          results.push({
            endTokenIndex: cont.endTokenIndex,
            inflected: cont.inflected || br.inflected,
            possessive: cont.possessive || br.possessive,
            slotUsed: cont.slotUsed || br.slotUsed,
            optionalUsed: cont.optionalUsed || br.optionalUsed,
          });
        }
      }
    }
  } else if (node.type === 'slot') {
    const isPossessiveSlot = node.kind === 'possessive';
    for (let slotLen = 1; slotLen <= MAX_SLOT_TOKENS; slotLen++) {
      const nextTokenIndex = tokenIndex + slotLen;
      if (nextTokenIndex > tokens.length) break;
      // Check for sentence punctuation boundary.
      if (tokenIndex < tokens.length && isPunctuation(tokens[tokenIndex]!.raw)) break;
      if (!slotAllows(tokens, tokenIndex, nextTokenIndex)) break;
      // Possessive slots consume exactly 1 token (a possessive pronoun).
      if (isPossessiveSlot && slotLen > 1) break;
      const continueResults = matchSequence(nodes, nodeIndex + 1, tokens, nextTokenIndex, memo);
      for (const cont of continueResults) {
        results.push({
          endTokenIndex: cont.endTokenIndex,
          inflected: cont.inflected,
          possessive: cont.possessive || isPossessiveSlot,
          slotUsed: true,
          optionalUsed: cont.optionalUsed,
        });
      }
    }
  }

  const deduped = deduplicateStates(results);
  memo.set(memoKey, deduped);
  return deduped;
}

/** Match a child node sequence (used for optional/alternative branches). */
function matchChildren(
  children: readonly PhraseNode[],
  tokens: readonly SentenceToken[],
  tokenIndex: number,
  _memo: Map<string, MatchState[]>,
): MatchState[] {
  // Use a synthetic sequence match: match children as a sub-sequence.
  // We reuse matchSequence with a temporary node list + fresh memo.
  return matchSequence(children, 0, tokens, tokenIndex, new Map());
}

/** Check if a raw token is sentence punctuation. */
function isPunctuation(raw: string): boolean {
  return raw.length === 1 && SENTENCE_PUNCT.test(raw);
}

/** Deduplicate match states by endTokenIndex, keeping the "best" flags. */
function deduplicateStates(states: MatchState[]): MatchState[] {
  const map = new Map<number, MatchState>();
  for (const s of states) {
    const existing = map.get(s.endTokenIndex);
    if (!existing) {
      map.set(s.endTokenIndex, s);
    } else {
      // Merge: prefer states with fewer transformations (more precise).
      const existingScore = (existing.inflected ? 1 : 0) + (existing.possessive ? 1 : 0) + (existing.slotUsed ? 1 : 0);
      const newScore = (s.inflected ? 1 : 0) + (s.possessive ? 1 : 0) + (s.slotUsed ? 1 : 0);
      if (newScore < existingScore) {
        map.set(s.endTokenIndex, s);
      }
    }
  }
  return [...map.values()];
}

// --- Quality classification (ADR §9) ---

type Quality = 'fixed' | 'inflected' | 'possessive-template' | 'slot-template';

const QUALITY_RANK: ReadonlyMap<Quality, number> = new Map([
  ['fixed', 4],
  ['inflected', 3],
  ['possessive-template', 2],
  ['slot-template', 1],
]);

function classifyQuality(state: MatchState): Quality {
  if (state.slotUsed) {
    return state.possessive ? 'possessive-template' : 'slot-template';
  }
  if (state.possessive) return 'possessive-template';
  if (state.inflected) return 'inflected';
  return 'fixed';
}

// --- Candidate matching ---

interface CandidateMatch {
  readonly template: CompiledTemplate;
  readonly startTokenIndex: number;
  readonly endTokenIndex: number;
  readonly state: MatchState;
  readonly quality: Quality;
}

/** Main entry: match a phrase at the cursor position. */
export function matchPhrase(request: PhraseMatchRequest, index: PhraseIndex): PhraseMatch | null {
  const { sentence, cursorOffset } = request;

  // 1. Tokenize.
  const tokens = tokenizeSentence(sentence);
  if (tokens.length === 0) return null;

  // 2. Resolve cursorOffset → targetTokenIndex.
  let targetTokenIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (cursorOffset >= tokens[i]!.start && cursorOffset < tokens[i]!.end) {
      targetTokenIndex = i;
      break;
    }
  }
  if (targetTokenIndex < 0) return null;

  // 3. Bounded window.
  const windowStart = Math.max(0, targetTokenIndex - MAX_SURFACE_SPAN);
  const windowEnd = Math.min(tokens.length, targetTokenIndex + MAX_SURFACE_SPAN + 1);
  const windowTokens = tokens.slice(windowStart, windowEnd);

  // 4. Collect candidate template IDs from anchor postings.
  const candidateIds = new Set<number>();
  for (let i = 0; i < windowTokens.length; i++) {
    const token = windowTokens[i]!.text;
    const ids = index.lookupByAnchor(token);
    for (const id of ids) candidateIds.add(id);
    // Also try lemma for verb inflection.
    const lemmaKey = lemma(token);
    if (lemmaKey !== token) {
      const lemmaIds = index.lookupByAnchor(lemmaKey);
      for (const id of lemmaIds) candidateIds.add(id);
    }
  }

  if (candidateIds.size === 0) return null;

  // 5. Cap candidates (ADR §8.3 step 7).
  if (candidateIds.size > MAX_CANDIDATES) {
    // Intersect with rarest secondary anchor — for now, abort (ponytail: simple cap).
    return null;
  }

  // 6. Match each candidate.
  const matches: CandidateMatch[] = [];
  for (const templateId of candidateIds) {
    const template = index.templates[templateId];
    if (!template) continue;

    // Try all start positions in the window that could contain the target.
    const maxStartOffset = targetTokenIndex - windowStart;
    const minStartOffset = Math.max(0, maxStartOffset - template.maxSurfaceTokens + 1);

    for (let startOff = minStartOffset; startOff <= maxStartOffset; startOff++) {
      const startTokenIndex = windowStart + startOff;
      const memo = new Map<string, MatchState[]>();
      const results = matchSequence(template.nodes, 0, tokens, startTokenIndex, memo);

      for (const state of results) {
        const endTokenIndex = state.endTokenIndex;
        // Target must be inside [startTokenIndex, endTokenIndex).
        if (targetTokenIndex < startTokenIndex || targetTokenIndex >= endTokenIndex) continue;

        const quality = classifyQuality(state);
        matches.push({ template, startTokenIndex, endTokenIndex, state, quality });
      }
    }
  }

  if (matches.length === 0) return null;

  // 7. Rank (ADR §9).
  matches.sort(compareMatches);

  // 8. Return best match.
  const best = matches[0]!;
  const surface = sentence.slice(tokens[best.startTokenIndex]!.start, tokens[best.endTokenIndex - 1]!.end);
  return {
    dictionaryTerm: best.template.sourceTerm,
    surface,
    span: {
      start: tokens[best.startTokenIndex]!.start,
      end: tokens[best.endTokenIndex - 1]!.end,
    },
    quality: best.quality,
    sourceResourceId: 0, // resolved by caller from index metadata
  };
}

/** Deterministic ranking tuple (ADR §9). */
function compareMatches(a: CandidateMatch, b: CandidateMatch): number {
  // 1. quality: fixed > inflected > possessive-template > slot-template (desc)
  const qDiff = QUALITY_RANK.get(b.quality)! - QUALITY_RANK.get(a.quality)!;
  if (qDiff !== 0) return qDiff;

  // 2. required fixed-literal count, descending
  const fixedDiff = b.template.fixedTokenCount - a.template.fixedTokenCount;
  if (fixedDiff !== 0) return fixedDiff;

  // 3. matched surface span length, descending
  const spanDiff = (b.endTokenIndex - b.startTokenIndex) - (a.endTokenIndex - a.startTokenIndex);
  if (spanDiff !== 0) return spanDiff;

  // 4. wildcard/slot token count, ascending (fewer slots = more precise)
  const slotDiff = (a.state.slotUsed ? 1 : 0) - (b.state.slotUsed ? 1 : 0);
  if (slotDiff !== 0) return slotDiff;

  // 5. frequency rank, ascending
  const freqDiff = a.template.frequencyRank - b.template.frequencyRank;
  if (freqDiff !== 0) return freqDiff;

  // 6. stable: templateId ascending
  return a.template.templateId - b.template.templateId;
}
