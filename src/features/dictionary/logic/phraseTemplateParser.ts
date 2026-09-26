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
// Literals that can occupy an argument position, so they may alternate with a
// slot ("make/prove your/a point" → (make|prove) (your|a) point) or with each
// other ("have/take a/one look" → (have|take) (a|one) look).
const SLOT_ALTERNATION_LITERALS = new Set([
  ...DETERMINERS,
  'it',
  'them',
  'him',
  'her',
  'me',
  'us',
  'you',
  'this',
  'that',
]);
const PREPOSITIONS = new Set(['of', 'in', 'on', 'for', 'to', 'with', 'from', 'by', 'at']);

/** Parse an entry-object multiword term into bounded matching nodes. */
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
  // A bare slot as one alternative among literal-bearing branches is only safe
  // when other literals guard it ("be the pride of somewhere/sth"). As the
  // WHOLE template ("go-to-somebody/something", "my/your/their") the slot
  // branch consumes any 1-2 tokens with nothing else required — reject it.
  if (nodes.length === 1 && nodes[0]!.type === 'alternative') {
    const branches = nodes[0]!.branches;
    if (
      branches.some((branch) => branch.length === 1 && branch[0]!.type === 'slot') &&
      branches.some((branch) => branch.some((node) => node.type === 'literal'))
    ) {
      return buildResult(sourceTerm, normalizedTerm, 'unsupportedMalformed', []);
    }
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
  // should become [of], [about] + suffix alternative([sb], [sth]) — NOT a
  // standalone [sth] branch that matches "think sth" without the preposition,
  // and NOT [of, sth] / [about, sb, sth] which attaches the slot to one branch
  // only (e.g. "have/be nothing to do with somebody/something" would then match
  // "have to work" as "have sth"). The segment's first atom is the branch
  // alternative; the words between it and the trailing slot are shared suffix.
  // ponytail: this is a heuristic — doesn't handle 3+ independent slash groups,
  // but dictionary templates rarely have more than 2.
  if (
    final.length === 1 &&
    final[0].type === 'slot' &&
    segments.length >= 2 &&
    segments[0].length === 1 &&
    segments[0][0].type === 'literal'
  ) {
    const lastSegment = segments[segments.length - 1]!;
    const lastAtom = lastSegment[lastSegment.length - 1]!;
    if (lastAtom.type === 'slot' && lastSegment[0]!.type === 'literal') {
      const tailAlt: PhraseNode = { type: 'alternative', branches: [[lastAtom], [final[0]]] };
      return {
        alternative: { type: 'alternative', branches: [...segments.slice(0, -1), [lastSegment[0]!]] },
        suffix: [...lastSegment.slice(1, -1), tailAlt],
      };
    }
    for (const branch of segments) {
      branch.push(final[0]);
    }
    return { alternative: { type: 'alternative', branches: segments }, suffix: [] };
  }

  // Slot-led groups ("somebody/something ... somebody/something") are
  // pairwise placeholder alternations — greedy grouping would leave a
  // bare-slot branch that matches any 1-2 sentence tokens.
  if (firstBranch.type === 'slot') {
    const all = [...segments, final];
    const branches: PhraseNode[][] = [all[0]!, [all[1]![0]!]];
    const suffix: PhraseNode[] = [...all[1]!.slice(1)];
    for (let i = 2; i < all.length; i++) {
      const segment = all[i]!;
      const last = suffix.pop();
      if (last) {
        suffix.push({ type: 'alternative', branches: [[last], [segment[0]!]] });
      } else {
        // Suffix empty: the segment is a second alternation at the tail
        // position ("take sth up/on" → take + sth + (up|on)), not a new branch
        // that would match a bare "on" or leave a bare slot behind.
        const prevBranch = branches[branches.length - 1]!;
        if (segment.length === 1 && prevBranch.length === 1 && prevBranch[0]!.type === 'literal') {
          branches.pop();
          suffix.push({ type: 'alternative', branches: [prevBranch, segment] });
        } else {
          branches.push([segment[0]!]);
        }
      }
      suffix.push(...segment.slice(1));
    }
    const alternative: PhraseNode =
      branches.length === 1 && branches[0]!.length === 1
        ? branches[0]![0]!
        : { type: 'alternative', branches };
    return { alternative, suffix };
  }

  // A single-atom final segment after a multi-atom segment is a trailing
  // alternative for that segment's last atom ("go/come to sb's rescue/aid" →
  // (go | come to sb's) (rescue | aid)) — not a standalone branch that would
  // match any bare occurrence of the word.
  if (segments.length >= 1 && final.length === 1 && segments[segments.length - 1]!.length >= 2) {
    const prev = segments[segments.length - 1]!;
    const popped = prev[prev.length - 1]!;
    const trimmed = prev.slice(0, -1);
    const tailAlt: PhraseNode = { type: 'alternative', branches: [[popped], [final[0]!]] };
    return {
      alternative: { type: 'alternative', branches: [...segments.slice(0, -1), trimmed] },
      suffix: [tailAlt],
    };
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
  // A single-atom slot segment is allowed the same way ("our/your/their
  // differences" → (our | your | their) + differences) — the slot stays
  // guarded by the shared suffix instead of becoming a bare branch.
  // The final segment may also lead with a slot ("i/you/somebody for one" →
  // (i | you | sb) for one): slot-led groups never reach here — they are
  // handled by the slot-led branch above.
  if (
    final.length > 1 &&
    segments.length >= 1 &&
    segments.every(
      (segment) =>
        segment.length === 1 &&
        (segment[0]!.type === 'literal' || segment[0]!.type === 'slot')
    )
  ) {
    const lastAlternative = final[0];
    const sharedSuffix = final.slice(1);
    segments.push([lastAlternative]);
    return { alternative: { type: 'alternative', branches: segments }, suffix: sharedSuffix };
  }

  // The last segment's head is the branch alternative; decide whether its
  // trailing atom pairs with the final segment's first atom as one alternation
  // position ("get/put somebody/something out of your mind" → (get|put)
  // (sb|sth) out of your mind; "make/prove your/a point" → (make|prove)
  // (your|a) point) or everything after the head is shared suffix
  // ("put/set sth in motion" → (put|set) sth in motion). Atoms pair only when
  // both can fill the same argument position — slot↔slot, slot↔determiner/
  // pronoun; never a slot with a preposition like "in".
  const lastSegment = segments[segments.length - 1];
  const lastAtom = lastSegment?.[lastSegment.length - 1];
  const head = lastSegment?.[0];
  if (
    lastSegment &&
    lastAtom &&
    head?.type === 'literal' &&
    lastSegment.length >= 2 &&
    segments.slice(0, -1).every((segment) => segment.length === 1)
  ) {
    const firstOfFinal = final[0];
    if (firstOfFinal && isAlternationPartner(lastAtom) && isAlternationPartner(firstOfFinal)) {
      const tailAlt: PhraseNode = { type: 'alternative', branches: [[lastAtom], [firstOfFinal]] };
      return {
        alternative: { type: 'alternative', branches: [...segments.slice(0, -1), [head]] },
        suffix: [...lastSegment.slice(1, -1), tailAlt, ...final.slice(1)],
      };
    }
    return {
      alternative: { type: 'alternative', branches: [...segments.slice(0, -1), [head]] },
      suffix: [...lastSegment.slice(1), ...final],
    };
  }

  // Fallback for shapes no heuristic understood. A lone-atom branch beside
  // multiword branches lost its shared context ("i / you / somebody for one"
  // used to keep a bare [you] matching any "you") — reject instead of
  // producing a branch that matches a single word anywhere.
  segments.push(final);
  if (
    segments.some((segment) => segment.length === 1) &&
    segments.some((segment) => segment.length > 1)
  ) {
    state.malformed = true;
  }
  return { alternative: { type: 'alternative', branches: segments }, suffix: [] };
}

function isAlternationPartner(node: PhraseNode): boolean {
  return (
    node.type === 'slot' ||
    (node.type === 'literal' && SLOT_ALTERNATION_LITERALS.has(node.value))
  );
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
