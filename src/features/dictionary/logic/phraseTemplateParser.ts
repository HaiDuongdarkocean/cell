export type PhraseTemplateStatus =
  | 'supported'
  | 'unsupportedOpen'
  | 'unsupportedMalformed'
  | 'unsupportedLimit';

export type PhraseNode =
  | { readonly type: 'literal'; readonly value: string; readonly inflectableVerb: boolean }
  | { readonly type: 'optional'; readonly children: readonly PhraseNode[] }
  | { readonly type: 'alternative'; readonly branches: readonly (readonly PhraseNode[])[] }
  | { readonly type: 'slot'; readonly kind: 'object' | 'person' | 'possessive'; readonly maxTokens: number };

export interface PhraseTemplateParseOptions {
  readonly inflectableLiterals?: ReadonlySet<string>;
  readonly maxFixedTokens?: number;
  readonly maxSurfaceTokens?: number;
}

export interface ParsedPhraseTemplate {
  readonly sourceTerm: string;
  readonly normalizedTerm: string;
  readonly status: PhraseTemplateStatus;
  readonly nodes: readonly PhraseNode[];
  readonly fixedTokenCount: number;
  readonly minSurfaceTokens: number;
  readonly maxSurfaceTokens: number;
}

type Lexeme =
  | { readonly type: 'word'; readonly value: string }
  | { readonly type: 'slash' }
  | { readonly type: 'lparen' }
  | { readonly type: 'rparen' };

interface ParserState {
  readonly lexemes: readonly Lexeme[];
  index: number;
  malformed: boolean;
}

interface NodeStats {
  readonly sourceTokens: number;
  readonly minSurfaceTokens: number;
  readonly maxSurfaceTokens: number;
}

const DEFAULT_MAX_FIXED_TOKENS = 16;
const DEFAULT_MAX_SURFACE_TOKENS = 32;
const OPEN_PATTERN = /\.\.\.|(?:^|\s)etc\.?(?:$|\s|[!?.,])/i;
// Only "your" and "sb's" are generic possessive placeholders in dictionary
// templates (e.g. "be (right) under your nose" matches "under my nose").
// "his", "her", "their", "my", "our", "its" are always literal words in
// templates (e.g. "in his/her/their wisdom" = literally "in his wisdom"
// OR "in her wisdom" OR "in their wisdom"). Treating them as slots causes
// FP: "in his/her/their wisdom" matches "in the trash" (possessive slot
// consumes "the", then literal "wisdom" never matches).
const POSSESSIVE_PLACEHOLDERS = new Set(['your', "sb's"]);
type SlotKind = 'object' | 'person' | 'possessive';

interface SlotSpec { kind: SlotKind; maxTokens: number }

// `sth`/`sb` are abstract placeholders — can match noun phrases (≤3 tokens).
// `sb` (somebody) is more restrictive — a person noun phrase is usually
// ≤2 tokens ("the man", "my sister", "John Smith"). 3 would allow
// "you borrow them" (verb+object) which is not a person.
// ponytail: heuristic without POS tagging. Full fix requires POS tagging.
const SLOT_NAMES = new Map<string, SlotSpec>([
  ['sth', { kind: 'object', maxTokens: 3 }],
  ['something', { kind: 'object', maxTokens: 2 }],
  ['sb', { kind: 'person', maxTokens: 2 }],
  ['someone', { kind: 'person', maxTokens: 2 }],
  ['somebody', { kind: 'person', maxTokens: 2 }],
]);
const DETERMINERS = new Set([
  'a',
  'an',
  'the',
  'your',
  'my',
  'his',
  'her',
  'its',
  'our',
  'their',
  'one',
  'some',
  'any',
]);
const PREPOSITIONS = new Set(['of', 'in', 'on', 'for', 'to', 'with', 'from', 'by', 'at']);

/** Parse a Cambridge multiword term into bounded matching nodes. */
export function parsePhraseTemplate(
  sourceTerm: string,
  options: PhraseTemplateParseOptions = {},
): ParsedPhraseTemplate {
  const normalizedTerm = normalizePhraseSource(sourceTerm);
  const unsupported = createUnsupportedResult(sourceTerm, normalizedTerm);
  if (!normalizedTerm || OPEN_PATTERN.test(normalizedTerm)) return unsupported('unsupportedOpen');

  const state: ParserState = { lexemes: lex(normalizedTerm), index: 0, malformed: false };
  const nodes = parseSequence(state, false, options.inflectableLiterals ?? new Set<string>());
  if (state.malformed || state.index !== state.lexemes.length || nodes.length === 0) {
    return buildResult(sourceTerm, normalizedTerm, 'unsupportedMalformed', []);
  }

  const stats = getStats(nodes);
  const maxFixedTokens = options.maxFixedTokens ?? DEFAULT_MAX_FIXED_TOKENS;
  const maxSurfaceTokens = options.maxSurfaceTokens ?? DEFAULT_MAX_SURFACE_TOKENS;
  const status =
    stats.sourceTokens > maxFixedTokens || stats.maxSurfaceTokens > maxSurfaceTokens
      ? 'unsupportedLimit'
      : 'supported';
  return buildResult(sourceTerm, normalizedTerm, status, nodes);
}

function normalizePhraseSource(sourceTerm: string): string {
  return sourceTerm
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(/\s+/g, ' ');
}

function createUnsupportedResult(sourceTerm: string, normalizedTerm: string) {
  return (status: Exclude<PhraseTemplateStatus, 'supported'>): ParsedPhraseTemplate =>
    buildResult(sourceTerm, normalizedTerm, status, []);
}

function buildResult(
  sourceTerm: string,
  normalizedTerm: string,
  status: PhraseTemplateStatus,
  nodes: readonly PhraseNode[],
): ParsedPhraseTemplate {
  const stats = getStats(nodes);
  return {
    sourceTerm,
    normalizedTerm,
    status,
    nodes,
    fixedTokenCount: stats.sourceTokens,
    minSurfaceTokens: stats.minSurfaceTokens,
    maxSurfaceTokens: stats.maxSurfaceTokens,
  };
}

function lex(source: string): readonly Lexeme[] {
  const raw = source.match(/[()]|\x2F|[^\s()\x2F]+/g) ?? [];
  const lexemes: Lexeme[] = [];
  for (const value of raw) {
    if (value === '(') lexemes.push({ type: 'lparen' });
    else if (value === ')') lexemes.push({ type: 'rparen' });
    else if (value === '/') lexemes.push({ type: 'slash' });
    else {
      const cleaned = value.replace(/^[,!?;:]+|[,!?;:]+$/g, '');
      if (cleaned) lexemes.push({ type: 'word', value: cleaned });
    }
  }
  return lexemes;
}

function parseSequence(
  state: ParserState,
  stopAtRParen: boolean,
  inflectableLiterals: ReadonlySet<string>,
): PhraseNode[] {
  const nodes: PhraseNode[] = [];
  while (state.index < state.lexemes.length) {
    const current = state.lexemes[state.index];
    if (current?.type === 'rparen') {
      if (!stopAtRParen) state.malformed = true;
      return nodes;
    }
    if (current?.type === 'slash') {
      state.malformed = true;
      state.index++;
      continue;
    }

    const atom = parseAtom(state, inflectableLiterals);
    if (!atom) continue;
    if (state.lexemes[state.index]?.type === 'slash') {
      const group = parseSlashGroup(state, atom, inflectableLiterals);
      nodes.push(group.alternative, ...group.suffix);
    } else {
      nodes.push(atom);
    }
  }
  if (stopAtRParen) state.malformed = true;
  return nodes;
}

function parseAtom(state: ParserState, inflectableLiterals: ReadonlySet<string>): PhraseNode | null {
  const current = state.lexemes[state.index];
  if (!current) return null;
  if (current.type === 'lparen') {
    state.index++;
    const children = parseSequence(state, true, inflectableLiterals);
    if (state.lexemes[state.index]?.type !== 'rparen') {
      state.malformed = true;
      return null;
    }
    state.index++;
    return { type: 'optional', children };
  }
  if (current.type !== 'word') {
    state.malformed = true;
    state.index++;
    return null;
  }

  state.index++;
  if (isNumericSlash(state, current.value)) {
    const next = state.lexemes[state.index + 1];
    if (!next || next.type !== 'word') {
      state.malformed = true;
      return null;
    }
    state.index += 2;
    return { type: 'literal', value: `${current.value}/${next.value}`, inflectableVerb: false };
  }
  const slotSpec = SLOT_NAMES.get(current.value);
  if (slotSpec) return { type: 'slot', kind: slotSpec.kind, maxTokens: slotSpec.maxTokens };
  if (POSSESSIVE_PLACEHOLDERS.has(current.value)) {
    return { type: 'slot', kind: 'possessive', maxTokens: 2 };
  }
  return { type: 'literal', value: current.value, inflectableVerb: inflectableLiterals.has(current.value) };
}

function isNumericSlash(state: ParserState, value: string): boolean {
  return /^\d+$/.test(value) && state.lexemes[state.index]?.type === 'slash' && /^\d+$/.test((state.lexemes[state.index + 1] as { value?: string } | undefined)?.value ?? '');
}

function parseSlashGroup(
  state: ParserState,
  firstBranch: PhraseNode,
  inflectableLiterals: ReadonlySet<string>,
): { alternative: PhraseNode; suffix: PhraseNode[] } {
  const segments: PhraseNode[][] = [[firstBranch]];
  while (state.lexemes[state.index]?.type === 'slash') {
    state.index++;
    const segment: PhraseNode[] = [];
    while (
      state.index < state.lexemes.length &&
      state.lexemes[state.index]?.type !== 'slash' &&
      state.lexemes[state.index]?.type !== 'rparen'
    ) {
      const atom = parseAtom(state, inflectableLiterals);
      if (atom) segment.push(atom);
      else break;
    }
    if (segment.length === 0) {
      state.malformed = true;
      break;
    }
    segments.push(segment);
  }

  const final = segments.pop()!;

  // When the final segment is a single slot and the first segment is a single
  // literal, the final is likely a separate alternative group.
  // E.g. "of/about sb/sth" → branches [of], [about, sb] + final [sth]
  // should become [of, sth], [about, sb, sth] — NOT a standalone [sth] branch
  // that matches "think sth" without the required preposition.
  // ponytail: this is a heuristic — doesn't handle 3+ independent slash groups,
  // but dictionary templates rarely have more than 2.
  if (
    final.length === 1 &&
    final[0].type === 'slot' &&
    segments.length >= 2 &&
    segments[0].length === 1 &&
    segments[0][0].type === 'literal'
  ) {
    for (const branch of segments) {
      branch.push(final[0]);
    }
    return { alternative: { type: 'alternative', branches: segments }, suffix: [] };
  }

  const split = splitFinalAlternative(final, segments.length === 1);
  if (split) {
    segments.push(split.branch);
    return {
      alternative: { type: 'alternative', branches: segments },
      suffix: split.suffix,
    };
  }

  // Multi-slash alternatives with a shared trailing suffix.
  // E.g. "be/come/arrive late to the party" should become
  // alternative([be], [come], [arrive]) + suffix [late, to, the, party],
  // not a degenerate [be] branch that can match "is" by itself.
  // ponytail: we only split when all preceding segments are single literals
  // of the same type as the first token of the final segment. This avoids
  // accidentally splitting slot groups like "sb/sth through something".
  if (
    final.length > 1 &&
    segments.length >= 1 &&
    final[0].type === 'literal' &&
    segments.every((segment) => segment.length === 1 && segment[0]!.type === 'literal')
  ) {
    const lastAlternative = final[0];
    const sharedSuffix = final.slice(1);
    segments.push([lastAlternative]);
    return { alternative: { type: 'alternative', branches: segments }, suffix: sharedSuffix };
  }

  segments.push(final);
  return { alternative: { type: 'alternative', branches: segments }, suffix: [] };
}

function splitFinalAlternative(
  segment: PhraseNode[],
  onlyOneSlash: boolean,
): { branch: PhraseNode[]; suffix: PhraseNode[] } | null {
  if (segment.length <= 1) return null;
  const words = segment.map((node) => (node.type === 'literal' ? node.value : ''));
  const first = words[0];
  const second = words[1];
  if (onlyOneSlash && first !== 'out') {
    return { branch: [segment[0]], suffix: segment.slice(1) };
  }
  if (words.some((word) => !word)) return null;
  if (first === 'out' && second === 'of') {
    const determinerIndex = words.findIndex((word, index) => index >= 2 && DETERMINERS.has(word));
    if (determinerIndex > 1) return { branch: segment.slice(0, determinerIndex), suffix: segment.slice(determinerIndex) };
  }

  if (PREPOSITIONS.has(second) || DETERMINERS.has(second)) {
    return { branch: [segment[0]], suffix: segment.slice(1) };
  }

  if (onlyOneSlash && PREPOSITIONS.has(first)) {
    return { branch: [segment[0]], suffix: segment.slice(1) };
  }

  return null;
}

function getStats(nodes: readonly PhraseNode[]): NodeStats {
  return nodes.reduce<NodeStats>(
    (total, node) => {
      const stats = getNodeStats(node);
      return {
        sourceTokens: total.sourceTokens + stats.sourceTokens,
        minSurfaceTokens: total.minSurfaceTokens + stats.minSurfaceTokens,
        maxSurfaceTokens: total.maxSurfaceTokens + stats.maxSurfaceTokens,
      };
    },
    { sourceTokens: 0, minSurfaceTokens: 0, maxSurfaceTokens: 0 },
  );
}

function getNodeStats(node: PhraseNode): NodeStats {
  switch (node.type) {
    case 'literal':
      return { sourceTokens: 1, minSurfaceTokens: 1, maxSurfaceTokens: 1 };
    case 'slot':
      return {
        sourceTokens: 1,
        minSurfaceTokens: 1,
        maxSurfaceTokens: node.maxTokens,
      };
    case 'optional': {
      const stats = getStats(node.children);
      return { sourceTokens: stats.sourceTokens, minSurfaceTokens: 0, maxSurfaceTokens: stats.maxSurfaceTokens };
    }
    case 'alternative': {
      const stats = node.branches.map(getStats);
      return {
        sourceTokens: Math.max(...stats.map((item) => item.sourceTokens)),
        minSurfaceTokens: Math.min(...stats.map((item) => item.minSurfaceTokens)),
        maxSurfaceTokens: Math.max(...stats.map((item) => item.maxSurfaceTokens)),
      };
    }
  }
}
