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
import { englishLemmaCandidates } from '@/features/dictionaryPopup/logic/englishLemma';
import { serializeNodes } from '@/features/dictionaryPopup/log/serializeNodes';
import type {
  MatchTraceData,
  CandidateMatchTrace,
  RankedCandidateTrace,
} from '@/features/dictionaryPopup/log/lookupLogTypes';

// --- Constants (ADR §8.2) ---

const MAX_SLOT_TOKENS = 6;
const MAX_SURFACE_SPAN = 32;
const MAX_CANDIDATES = 4096;

// Object-slot templates whose final node is a slot need at least this many fixed
// literals matched to avoid matching arbitrary sentence fragments (e.g. "is the body"
// wrongly matching "be (really) something"). Person/possessive slots keep the looser
// default because they are more constrained by the kind of word they consume.
const MIN_OBJECT_SLOT_FIXED_LITERALS = 2;

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
  /** True if sentence-ending punctuation (., !, ?) appears before this token. */
  readonly precededBySentencePunct: boolean;
  /** True if a clause boundary (comma, semicolon, colon, dash) appears before this token. */
  readonly precededByClausePunct: boolean;
}

const WORD_RUN_RE = /[\p{L}\p{N}'-]+/gu;
const SENTENCE_PUNCT = /[.!?,;:]/;

const SENTENCE_END_PUNCT_RE = /[.!?]/;
const CLAUSE_PUNCT_RE = /[,;:-]/;

/** Tokenize a sentence into normalized word tokens with UTF-16 offsets.
 *
 *  Uses a single regex pass over the sentence instead of a per-character loop,
 *  then strips leading hyphens (SRT dialogue markers) and classifies the gap
 *  before each token. The Unicode-aware run still lets language-specific
 *  filtering drop non-target words (e.g. Vietnamese diacritics) downstream.
 */
export function tokenizeSentence(sentence: string): SentenceToken[] {
  // Normalize curly apostrophe (U+2019) to straight (U+0027) so contractions,
  // possessives, and clitics are treated as a single English token and later
  // lookup can expand them. Both characters are one UTF-16 code unit, so
  // cursor offsets from the DOM stay valid.
  sentence = sentence.replaceAll('’', "'");
  const tokens: SentenceToken[] = [];
  let lastEnd = -1;
  WORD_RUN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RUN_RE.exec(sentence)) !== null) {
    const matchStart = match.index;
    let start = matchStart;
    let raw = match[0];
    // Strip leading hyphens (SRT dialogue markers like "-Where'd").
    // Intra-word hyphens ("scaredy-cat", "self-defense") are preserved
    // because `-` is in WORD_RUN_RE — only LEADING hyphens are skipped here.
    while (raw.length > 0 && raw[0] === '-') {
      start++;
      raw = raw.slice(1);
    }
    if (raw.length === 0) continue;

    let precededBySentencePunct = false;
    let precededByClausePunct = false;
    if (lastEnd >= 0) {
      const gap = sentence.slice(lastEnd, start);
      if (SENTENCE_END_PUNCT_RE.test(gap)) precededBySentencePunct = true;
      if (CLAUSE_PUNCT_RE.test(gap)) precededByClausePunct = true;
    }

    const text = raw.toLowerCase().normalize('NFC');
    tokens.push({ text, raw, start, end: start + raw.length, precededBySentencePunct, precededByClausePunct });
    lastEnd = start + raw.length;
  }
  return tokens;
}

// --- Lemma (ADR §6 / ADR-041) ---
// Multi-candidate lemma: delegates to the shared `englishLemmaCandidates`
// module (ADR-041) which covers ALL 8 English inflectional suffixes +
// irregular forms. Returns multiple candidates so the matcher can try all —
// false-positive candidates (e.g. "pul" from "pulling") are harmless because
// no template anchor matches them.
//
// ponytail: the shared module is a pure function with no I/O. This is O(1)
// per token and bounded to ≤6 candidates per rule.

/**
 * Return all possible lemmas for a word (ADR §6 / ADR-041).
 * Delegates to the shared `englishLemmaCandidates` module which covers ALL
 * 8 English inflectional suffixes + irregular forms. The first candidate is
 * the most likely lemma; others are fallbacks the matcher tries if the first
 * doesn't match a template anchor. The original word is included as the last
 * candidate so the matcher can fall back to exact token matching.
 */
function candidateLemmas(word: string): string[] {
  return englishLemmaCandidates(word);
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
  if (node.inflectableVerb && candidateLemmas(token).includes(node.value)) {
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
    // Slot stops at sentence punctuation (raw token is punctuation — legacy check).
    if (t.raw.length === 1 && SLOT_STOP_PUNCT.has(t.raw)) return false;
    // Slot stops at sentence-ending punctuation that appeared before any token
    // in the slot range (e.g. "is. It's my" → slot can't cross the "." boundary).
    if (t.precededBySentencePunct) return false;
    // Slot stops at clause boundary (comma, semicolon, colon, dash) that appeared
    // before any token in the slot range (e.g. "a door, and now" → slot can't
    // cross the "," boundary). This prevents FP like "kick in sth" matching
    // "kick in a door, and now my leg" (slot would consume 6 tokens across comma).
    if (t.precededByClausePunct) return false;
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
  /** Number of fixed (non-slot, non-optional) literals actually matched. */
  readonly fixedMatched: number;
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
    return [{ endTokenIndex: tokenIndex, inflected: false, possessive: false, slotUsed: false, optionalUsed: false, fixedMatched: 0 }];
  }

  const memoKey = `${nodeIndex}:${tokenIndex}`;
  const cached = memo.get(memoKey);
  if (cached) return cached;

  const node = nodes[nodeIndex]!;
  const results: MatchState[] = [];

  if (node.type === 'literal') {
    if (tokenIndex < tokens.length) {
      const tok = tokens[tokenIndex]!;
      // A literal can't match a token that follows sentence-ending punctuation
      // (e.g. "mind. You" → "You" can't be part of the same phrase as "mind").
      if (tok.precededBySentencePunct) {
        // Only the FIRST token in the sequence is allowed to have precededBySentencePunct
        // (it's the anchor — the user hovered over it). Subsequent tokens can't cross.
        if (nodeIndex > 0) {
          const deduped = deduplicateStates(results);
          memo.set(memoKey, deduped);
          return deduped;
        }
      }
      const r = tokenMatchesLiteral(node, tok.text);
      if (r.matched) {
        const childResults = matchSequence(nodes, nodeIndex + 1, tokens, tokenIndex + 1, memo);
        for (const cr of childResults) {
          results.push({
            endTokenIndex: cr.endTokenIndex,
            inflected: cr.inflected || r.inflected,
            possessive: cr.possessive || r.possessive,
            slotUsed: cr.slotUsed,
            optionalUsed: cr.optionalUsed,
            fixedMatched: cr.fixedMatched + 1,
          });
        }
      }
    }
  } else if (node.type === 'optional') {
    // Branch 1: skip the optional group.
    const skipResults = matchSequence(nodes, nodeIndex + 1, tokens, tokenIndex, memo);
    for (const sr of skipResults) {
      results.push({ ...sr, optionalUsed: sr.optionalUsed, fixedMatched: sr.fixedMatched });
    }
    // Branch 2: consume the optional children, then continue.
    // But only if the current token doesn't follow sentence-ending punctuation
    // (e.g. "mind. You" → optional "(you)" can't match "You" after ".").
    if (tokenIndex < tokens.length && !tokens[tokenIndex]!.precededBySentencePunct) {
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
            fixedMatched: cont.fixedMatched + cr.fixedMatched,
          });
        }
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
            fixedMatched: cont.fixedMatched + br.fixedMatched,
          });
        }
      }
    }
  } else if (node.type === 'slot') {
    const isPossessiveSlot = node.kind === 'possessive';
    const maxSlotLen = Math.min(MAX_SLOT_TOKENS, node.maxTokens);
    for (let slotLen = 1; slotLen <= maxSlotLen; slotLen++) {
      const nextTokenIndex = tokenIndex + slotLen;
      if (nextTokenIndex > tokens.length) break;
      // Check for sentence punctuation boundary.
      if (tokenIndex < tokens.length && isPunctuation(tokens[tokenIndex]!.raw)) break;
      if (!slotAllows(tokens, tokenIndex, nextTokenIndex)) break;
      // Possessive slots consume 1-2 tokens: the possessive pronoun plus an
      // optional intensifier (e.g. "your damn mind", "my fucking car").
      // ponytail: allowing 2 tokens risks false positives where a non-possessive
      // word is consumed, but the DP matcher tries slotLen=1 first and the
      // ranking prefers shorter slots (fewer slotUsed tokens). The ceiling is
      // idioms with 2+ intensifiers ("your whole damn mind") which are rare.
      if (isPossessiveSlot && slotLen > 2) break;
      const continueResults = matchSequence(nodes, nodeIndex + 1, tokens, nextTokenIndex, memo);
      for (const cont of continueResults) {
        results.push({
          endTokenIndex: cont.endTokenIndex,
          inflected: cont.inflected,
          possessive: cont.possessive || isPossessiveSlot,
          slotUsed: true,
          optionalUsed: cont.optionalUsed,
          fixedMatched: cont.fixedMatched,
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
      // Merge: prefer states with fewer transformations (more precise); tie-break
      // by more fixed literals matched (more concrete).
      const existingScore = (existing.inflected ? 1 : 0) + (existing.possessive ? 1 : 0) + (existing.slotUsed ? 1 : 0);
      const newScore = (s.inflected ? 1 : 0) + (s.possessive ? 1 : 0) + (s.slotUsed ? 1 : 0);
      if (newScore < existingScore || (newScore === existingScore && s.fixedMatched > existing.fixedMatched)) {
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

/** Check whether the last concrete (non-optional) node of a template is an object slot.
 *  Optional groups at the end are unwrapped.
 */
function finalNodeIsObjectSlot(nodes: readonly PhraseNode[]): boolean {
  if (nodes.length === 0) return false;
  const last = nodes[nodes.length - 1]!;
  if (last.type === 'slot') return last.kind === 'object';
  if (last.type === 'optional' && last.children.length > 0) {
    return finalNodeIsObjectSlot(last.children);
  }
  return false;
}

/** Reject low-precision object-slot matches: a template ending in an object slot
 *  must have at least MIN_OBJECT_SLOT_FIXED_LITERALS fixed literals matched.
 *  This stops idioms like "be (really) something" from swallowing arbitrary objects
 *  when the optional is skipped (e.g. "is the body").
 */
function isValidObjectSlotMatch(template: CompiledTemplate, state: MatchState): boolean {
  if (!finalNodeIsObjectSlot(template.nodes)) return true;
  return state.fixedMatched >= MIN_OBJECT_SLOT_FIXED_LITERALS;
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
export function matchPhrase(
  request: PhraseMatchRequest,
  index: PhraseIndex,
  /** Real resourceId for the index — embedded in the returned PhraseMatch so
   *  callers never see a sentinel zero. Defaults to 0 only for tests that
   *  exercise matching logic without resource identity. */
  sourceResourceId: number = 0,
): PhraseMatch | null {
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
    // Also try all candidate lemmas for verb inflection.
    for (const lemmaKey of candidateLemmas(token)) {
      if (lemmaKey !== token) {
        const lemmaIds = index.lookupByAnchor(lemmaKey);
        for (const id of lemmaIds) candidateIds.add(id);
      }
    }
  }

  if (candidateIds.size === 0) return null;

  // 5. Cap candidates (ADR §8.3 step 7): if too many, keep the top
  //    MAX_CANDIDATES by anchor-overlap count (how many of the template's
  //    anchors appear in the window). This prioritizes templates with the
  //    most evidence in the sentence — a template whose only window anchor
  //    is 'the' (1137 postings) is deprioritized vs one whose anchors 'take'
  //    + 'off' both appear. O(candidates × anchors) but anchors are ≤8 per
  //    template, so this is cheap.
  if (candidateIds.size > MAX_CANDIDATES) {
    const windowTokenSet = new Set<string>();
    for (const wt of windowTokens) {
      windowTokenSet.add(wt.text);
      for (const lk of candidateLemmas(wt.text)) {
        if (lk !== wt.text) windowTokenSet.add(lk);
      }
    }
    const scored = [...candidateIds].map((id) => {
      const template = index.templates[id];
      if (!template) return { id, score: 0 };
      let score = 0;
      for (const a of template.anchors) {
        if (windowTokenSet.has(a)) score++;
      }
      return { id, score };
    });
    scored.sort((a, b) => b.score - a.score || a.id - b.id);
    candidateIds.clear();
    for (let i = 0; i < Math.min(MAX_CANDIDATES, scored.length); i++) {
      candidateIds.add(scored[i]!.id);
    }
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

        // Tighten object-slot templates: require enough fixed literals matched.
        if (!isValidObjectSlotMatch(template, state)) continue;

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
    sourceResourceId,
  };
}

/**
 * Match ALL phrase templates at the cursor position — returns every match
 * sorted by the deterministic ranking tuple (ADR §9). Used by the multi-
 * candidate popup to display all interpretations of the hovered word.
 *
 * Deduplicates by dictionaryTerm so the same phrase from different match
 * positions only appears once (highest-ranked position wins).
 */
export function matchPhraseAll(
  request: PhraseMatchRequest,
  index: PhraseIndex,
  sourceResourceId: number = 0,
  /** Dev-only: nếu truyền, nhận trace data (candidate states, ranking, anchors).
   *  No-op khi không truyền — existing callers không bị ảnh hưởng. */
  traceSink?: (trace: MatchTraceData) => void,
): PhraseMatch[] {
  const { sentence, cursorOffset } = request;

  // Reuse matchPhrase logic but collect all matches instead of just winner.
  // ponytail: duplicate the matching logic to avoid refactoring matchPhrase's
  // return type (backward compat). If this diverges, extract shared core.
  const tokens = tokenizeSentence(sentence);
  if (tokens.length === 0) return [];

  let targetTokenIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (cursorOffset >= tokens[i]!.start && cursorOffset < tokens[i]!.end) {
      targetTokenIndex = i;
      break;
    }
  }
  if (targetTokenIndex < 0) return [];

  const windowStart = Math.max(0, targetTokenIndex - MAX_SURFACE_SPAN);
  const windowEnd = Math.min(tokens.length, targetTokenIndex + MAX_SURFACE_SPAN + 1);
  const windowTokens = tokens.slice(windowStart, windowEnd);

  const candidateIds = new Set<number>();
  const anchorHits: Record<string, number[]> = {};
  for (let i = 0; i < windowTokens.length; i++) {
    const token = windowTokens[i]!.text;
    const ids = index.lookupByAnchor(token);
    if (ids.length > 0) {
      (anchorHits[token] ??= []).push(...ids);
    }
    for (const id of ids) candidateIds.add(id);
    for (const lemmaKey of candidateLemmas(token)) {
      if (lemmaKey !== token) {
        const lemmaIds = index.lookupByAnchor(lemmaKey);
        if (lemmaIds.length > 0) {
          (anchorHits[lemmaKey] ??= []).push(...lemmaIds);
        }
        for (const id of lemmaIds) candidateIds.add(id);
      }
    }
  }

  if (candidateIds.size === 0) {
    emitTrace(traceSink, index, sourceResourceId, candidateIds, anchorHits, []);
    return [];
  }

  if (candidateIds.size > MAX_CANDIDATES) {
    const windowTokenSet = new Set<string>();
    for (const wt of windowTokens) {
      windowTokenSet.add(wt.text);
      for (const lk of candidateLemmas(wt.text)) {
        if (lk !== wt.text) windowTokenSet.add(lk);
      }
    }
    const scored = [...candidateIds].map((id) => {
      const template = index.templates[id];
      if (!template) return { id, score: 0 };
      let score = 0;
      for (const a of template.anchors) {
        if (windowTokenSet.has(a)) score++;
      }
      return { id, score };
    });
    scored.sort((a, b) => b.score - a.score || a.id - b.id);
    candidateIds.clear();
    for (let i = 0; i < Math.min(MAX_CANDIDATES, scored.length); i++) {
      candidateIds.add(scored[i]!.id);
    }
  }

  const matches: CandidateMatch[] = [];
  const perCandidateTraces: CandidateMatchTrace[] = [];
  for (const templateId of candidateIds) {
    const template = index.templates[templateId];
    if (!template) continue;

    const maxStartOffset = targetTokenIndex - windowStart;
    const minStartOffset = Math.max(0, maxStartOffset - template.maxSurfaceTokens + 1);

    for (let startOff = minStartOffset; startOff <= maxStartOffset; startOff++) {
      const startTokenIndex = windowStart + startOff;
      const memo = new Map<string, MatchState[]>();
      const results = matchSequence(template.nodes, 0, tokens, startTokenIndex, memo);

      for (const state of results) {
        const endTokenIndex = state.endTokenIndex;
        if (targetTokenIndex < startTokenIndex || targetTokenIndex >= endTokenIndex) continue;

        const quality = classifyQuality(state);
        const rankingTuple = {
          qualityRank: QUALITY_RANK.get(quality)!,
          fixedTokenCount: template.fixedTokenCount,
          fixedMatched: state.fixedMatched,
          spanLen: endTokenIndex - startTokenIndex,
          slotUsed: state.slotUsed,
          frequencyRank: template.frequencyRank,
          templateId,
        };

        // Tighten object-slot templates: require enough fixed literals matched.
        if (!isValidObjectSlotMatch(template, state)) {
          perCandidateTraces.push({
            templateId,
            sourceTerm: template.sourceTerm,
            normalizedTerm: template.normalizedTerm,
            nodesStructure: serializeNodes(template.nodes),
            startTokenIndex,
            endTokenIndex,
            state: {
              inflected: state.inflected,
              possessive: state.possessive,
              slotUsed: state.slotUsed,
              fixedMatched: state.fixedMatched,
            },
            quality,
            rejected: `object-slot min literals (need ${MIN_OBJECT_SLOT_FIXED_LITERALS}, got ${state.fixedMatched})`,
            rankingTuple,
          });
          continue;
        }

        matches.push({ template, startTokenIndex, endTokenIndex, state, quality });
        perCandidateTraces.push({
          templateId,
          sourceTerm: template.sourceTerm,
          normalizedTerm: template.normalizedTerm,
          nodesStructure: serializeNodes(template.nodes),
          startTokenIndex,
          endTokenIndex,
          state: {
            inflected: state.inflected,
            possessive: state.possessive,
            slotUsed: state.slotUsed,
            fixedMatched: state.fixedMatched,
          },
          quality,
          rejected: null,
          rankingTuple,
        });
      }
    }
  }

  if (matches.length === 0) {
    emitTrace(traceSink, index, sourceResourceId, candidateIds, anchorHits, perCandidateTraces);
    return [];
  }

  matches.sort(compareMatches);

  // Build ranked trace (trước dedup) — mỗi entry là 1 match position.
  const ranked: RankedCandidateTrace[] = matches.map((m, rank) => ({
    rank,
    dictionaryTerm: m.template.sourceTerm,
    surface: sentence.slice(tokens[m.startTokenIndex]!.start, tokens[m.endTokenIndex - 1]!.end),
    quality: m.quality,
    resourceId: sourceResourceId,
    rankingTuple: {
      qualityRank: QUALITY_RANK.get(m.quality)!,
      fixedTokenCount: m.template.fixedTokenCount,
      fixedMatched: m.state.fixedMatched,
      spanLen: m.endTokenIndex - m.startTokenIndex,
      slotUsed: m.state.slotUsed,
      frequencyRank: m.template.frequencyRank,
      templateId: m.template.templateId,
    },
  }));

  emitTrace(traceSink, index, sourceResourceId, candidateIds, anchorHits, perCandidateTraces, ranked);

  // Build PhraseMatch[] + deduplicate by dictionaryTerm.
  const seen = new Set<string>();
  const result: PhraseMatch[] = [];
  for (const best of matches) {
    if (seen.has(best.template.sourceTerm)) continue;
    seen.add(best.template.sourceTerm);
    const surface = sentence.slice(tokens[best.startTokenIndex]!.start, tokens[best.endTokenIndex - 1]!.end);
    result.push({
      dictionaryTerm: best.template.sourceTerm,
      surface,
      span: {
        start: tokens[best.startTokenIndex]!.start,
        end: tokens[best.endTokenIndex - 1]!.end,
      },
      quality: best.quality,
      sourceResourceId,
    });
  }
  return result;
}

/** Build + emit trace data via traceSink (no-op khi traceSink undefined). */
function emitTrace(
  traceSink: ((trace: MatchTraceData) => void) | undefined,
  index: PhraseIndex,
  sourceResourceId: number,
  candidateIds: Set<number>,
  anchorHits: Record<string, number[]>,
  perCandidate: CandidateMatchTrace[],
  ranked?: RankedCandidateTrace[],
): void {
  if (!traceSink) return;
  traceSink({
    resourcesScanned: [{ resourceId: sourceResourceId, termCount: index.termCount }],
    candidateTemplateIds: [...candidateIds],
    anchorHits,
    perCandidate,
    ranked: ranked ?? [],
  });
}

/**
 * Compare two PhraseMatches by the deterministic ranking tuple (ADR §9),
 * adapted for the cross-resource case. Used by the lookup orchestrator to
 * pick the winner when the same phrase matches in multiple resources.
 *
 * Tuple: quality desc → span length desc → dictionaryTerm ascending (stable).
 * Resource priority is applied BEFORE this comparison by the caller (the
 * caller sorts resources by priority, then breaks ties with this function).
 */
export function comparePhraseMatches(a: PhraseMatch, b: PhraseMatch): number {
  const QUALITY_ORDER: Record<PhraseMatch['quality'], number> = {
    fixed: 4,
    inflected: 3,
    'possessive-template': 2,
    'slot-template': 1,
  };
  const qDiff = QUALITY_ORDER[b.quality] - QUALITY_ORDER[a.quality];
  if (qDiff !== 0) return qDiff;

  const aLen = a.span.end - a.span.start;
  const bLen = b.span.end - b.span.start;
  const spanDiff = bLen - aLen;
  if (spanDiff !== 0) return spanDiff;

  // Stable: dictionaryTerm ascending (deterministic lexical tie-break).
  return a.dictionaryTerm < b.dictionaryTerm ? -1 : a.dictionaryTerm > b.dictionaryTerm ? 1 : 0;
}

/** Deterministic ranking tuple (ADR §9). */
function compareMatches(a: CandidateMatch, b: CandidateMatch): number {
  // 1. quality: fixed > inflected > possessive-template > slot-template (desc)
  const qDiff = QUALITY_RANK.get(b.quality)! - QUALITY_RANK.get(a.quality)!;
  if (qDiff !== 0) return qDiff;

  // 2. required fixed-literal count, descending
  const fixedDiff = b.template.fixedTokenCount - a.template.fixedTokenCount;
  if (fixedDiff !== 0) return fixedDiff;

  // 3. actual fixed literals matched, descending (tightens low-precision slots)
  const fixedMatchedDiff = b.state.fixedMatched - a.state.fixedMatched;
  if (fixedMatchedDiff !== 0) return fixedMatchedDiff;

  // 4. matched surface span length, descending
  const spanDiff = (b.endTokenIndex - b.startTokenIndex) - (a.endTokenIndex - a.startTokenIndex);
  if (spanDiff !== 0) return spanDiff;

  // 5. wildcard/slot token count, ascending (fewer slots = more precise)
  const slotDiff = (a.state.slotUsed ? 1 : 0) - (b.state.slotUsed ? 1 : 0);
  if (slotDiff !== 0) return slotDiff;

  // 5. frequency rank, ascending
  const freqDiff = a.template.frequencyRank - b.template.frequencyRank;
  if (freqDiff !== 0) return freqDiff;

  // 6. stable: templateId ascending
  return a.template.templateId - b.template.templateId;
}
