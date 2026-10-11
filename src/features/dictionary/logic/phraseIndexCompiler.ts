// phraseIndexCompiler — ADR-037 §7: compile parsed phrase templates into a
// compact anchor inverted index + serialized template table.
//
// Pure functions only. No IndexedDB, no worker. The blob is an ArrayBuffer
// that the worker owns after transfer.
//
// Binary layout (little-endian):
//   magic "PIXL" (4) + version u32 + termCount u32 + anchorCount u32
//   tokenTable: tokenCount u32 + (len u16 + utf8)*
//   templateTable: per template — sourceTerm(len u16+utf8) + normalizedTerm(len u16+utf8)
//     + fixed u8 + minSurface u8 + maxSurface u8 + freqRank i32
//     + anchorCount u8 + anchorId u32* + nodeBytes u32 + nodeBytes
//   anchorTable: per anchor — tokenId u32 + postingCount u32 + templateId u32*

import type { PhraseNode } from './phraseTemplateParser';

const MAGIC = 0x4c584950; // "PIXL" little-endian
const COMPILER_VERSION = 7;
const MAX_ANCHORS = 3;

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

const NODE_LITERAL = 0;
const NODE_OPTIONAL = 1;
const NODE_ALTERNATIVE = 2;
const NODE_SLOT = 3;

const SLOT_OBJECT = 0;
const SLOT_PERSON = 1;
const SLOT_POSSESSIVE = 2;

/**
 * Particles that frequently participate in separable phrasal verbs.
 * When a dictionary template is "verb + particle + sth/sb" (object after
 * particle), we also compile "verb + sth/sb + particle" so the matcher can
 * catch sentences like "put the gun down" from an entry "put down sth".
 * This is safe over-generation: the variant only matches when the particle
 * appears later in the sentence, and ranking prefers longer spans.
 */
const SEPARABLE_PARTICLES = new Set<string>([
  'up', 'down', 'off', 'on', 'out', 'away', 'back', 'in', 'over', 'through',
  'around', 'along', 'by', 'forward', 'ahead', 'apart', 'together', 'aside',
]);

/** Stopwords excluded from anchor preference (kept conservative). */
export const STOPWORDS = new Set<string>([
  'a', 'an', 'the', 'of', 'in', 'on', 'for', 'to', 'with', 'from', 'by', 'at',
  'and', 'or', 'but', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'this', 'that', 'these', 'those', 'it', 'its', 'his', 'her', 'your', 'my',
  'our', 'their', "one's",
  // Common phrasal-verb particles + short function words that produce
  // oversized posting lists. Excluded from anchor selection so the rarest
  // content word wins.
  'up', 'out', 'off', 'down', 'over', 'away', 'back', 'through', 'about',
  'around', 'along', 'into', 'onto', 'upon', 'off',
]);

/** Input template record for the compiler. */
export interface PhraseIndexInput {
  readonly templateId: number;
  readonly sourceTerm: string;
  readonly normalizedTerm: string;
  readonly nodes: readonly PhraseNode[];
  readonly fixedTokenCount: number;
  readonly minSurfaceTokens: number;
  readonly maxSurfaceTokens: number;
  readonly frequencyRank: number;
}

/** Compiled template record. */
export interface CompiledTemplate {
  readonly templateId: number;
  readonly sourceTerm: string;
  readonly normalizedTerm: string;
  readonly nodes: readonly PhraseNode[];
  readonly fixedTokenCount: number;
  readonly minSurfaceTokens: number;
  readonly maxSurfaceTokens: number;
  readonly frequencyRank: number;
  readonly anchors: readonly string[];
}

/** In-memory phrase index with anchor lookup. */
export interface PhraseIndex {
  readonly compilerVersion: number;
  readonly termCount: number;
  readonly templates: readonly CompiledTemplate[];
  readonly anchorKeys: readonly string[];
  readonly anchorCount: number;
  lookupByAnchor(token: string): readonly number[];
  readonly byteSize: number;
}

/**
 * Generate the separable-object variant for a phrasal-verb template.
 *
 * Input pattern: [literal verb, literal particle, slot] (e.g. put down sth).
 * Output pattern: [literal verb, slot, literal particle] (e.g. put sth down).
 * Returns null when the template does not match the pattern.
 */
function makeSeparableVariant(input: PhraseIndexInput): PhraseIndexInput | null {
  const nodes = input.nodes;
  if (nodes.length !== 3) return null;
  const [verb, particle, slot] = nodes;
  if (verb.type !== 'literal' || particle.type !== 'literal' || slot.type !== 'slot') {
    return null;
  }
  if (!SEPARABLE_PARTICLES.has(particle.value)) return null;
  const slotLabel = slot.kind === 'person' ? 'sb' : 'sth';
  const variantNodes: readonly PhraseNode[] = [verb, slot, particle];
  return {
    ...input,
    normalizedTerm: `${verb.value} ${slotLabel} ${particle.value}`,
    nodes: variantNodes,
  };
}

/** Expand inputs with separable phrasal-verb variants and renumber IDs. */
function expandInputs(inputs: readonly PhraseIndexInput[]): PhraseIndexInput[] {
  const expanded: PhraseIndexInput[] = [];
  for (const input of inputs) {
    expanded.push(input);
    const variant = makeSeparableVariant(input);
    if (variant) expanded.push(variant);
  }
  return expanded.map((input, i) => ({ ...input, templateId: i }));
}

function collectLiterals(nodes: readonly PhraseNode[], out: string[]): string[] {
  for (const node of nodes) {
    if (node.type === 'literal') out.push(node.value);
    else if (node.type === 'optional') collectLiterals(node.children, out);
    else if (node.type === 'alternative') for (const branch of node.branches) collectLiterals(branch, out);
  }
  return out;
}

/**
 * A template whose only fixed words are stopwords has no discriminating anchor:
 * "sth to" matches any sentence with a "to", "be sb" any sentence with an "is".
 * Such fragment headwords are not phrases — skip them instead of letting them
 * match arbitrary text. Templates with two or more fixed words are kept even if
 * every one of them is a stopword ("be in for sth"), because the frame itself
 * is the signal.
 */
function isIndexable(nodes: readonly PhraseNode[]): boolean {
  const literals = collectLiterals(nodes, []);
  if (literals.length >= 2) return true;
  return literals.some((value) => !STOPWORDS.has(value));
}

/** Compile parsed templates into an in-memory phrase index. */
export function compilePhraseIndex(inputs: readonly PhraseIndexInput[]): PhraseIndex {
  // Filter BEFORE expandInputs renumbers templateIds — templateId must equal
  // the template's index in the filtered array or anchor postings point at the
  // wrong template. Separable variants keep ≥2 literals so they are always
  // indexable; non-indexable inputs (≤1 stopword literal) never produce one.
  const expanded = expandInputs(inputs.filter((input) => isIndexable(input.nodes)));
  const templates: CompiledTemplate[] = expanded.map((input, i) => ({
    templateId: i,
    sourceTerm: input.sourceTerm,
    normalizedTerm: input.normalizedTerm,
    nodes: input.nodes,
    fixedTokenCount: input.fixedTokenCount,
    minSurfaceTokens: input.minSurfaceTokens,
    maxSurfaceTokens: input.maxSurfaceTokens,
    frequencyRank: input.frequencyRank,
    anchors: [],
  }));

  // First pass: collect candidate literals per template + global posting counts.
  const postingCounts = new Map<string, number>();
  const candidatesPerTemplate: string[][] = [];
  for (const t of templates) {
    const cands = collectAnchorCandidates(t.nodes);
    candidatesPerTemplate.push(cands);
    for (const c of new Set(cands)) {
      postingCounts.set(c, (postingCounts.get(c) ?? 0) + 1);
    }
  }

  // Second pass: assign anchors.
  const postings = new Map<string, number[]>();
  const totalTemplates = templates.length;
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i]!;
    const cands = candidatesPerTemplate[i]!;
    const anchors = selectAnchors(cands, postingCounts, totalTemplates);
    templates[i] = { ...t, anchors };
    for (const a of anchors) {
      if (!postings.has(a)) postings.set(a, []);
      postings.get(a)!.push(t.templateId);
    }
  }

  const anchorKeys = [...postings.keys()].sort();
  const lookup = (token: string): readonly number[] => postings.get(token) ?? [];
  return {
    compilerVersion: COMPILER_VERSION,
    termCount: templates.length,
    templates,
    anchorKeys,
    anchorCount: anchorKeys.length,
    lookupByAnchor: lookup,
    byteSize: 0, // filled by serialize
  };
}

/** Serialize a PhraseIndex to a compact ArrayBuffer. */
export function serializePhraseIndex(index: PhraseIndex): ArrayBuffer {
  // Intern table for tokens used in nodes + anchors.
  const tokenTable = new Map<string, number>();
  const tokenList: string[] = [];
  function intern(token: string): number {
    let id = tokenTable.get(token);
    if (id === undefined) {
      id = tokenList.length;
      tokenTable.set(token, id);
      tokenList.push(token);
    }
    return id;
  }

  // Pre-intern all tokens to know the table size.
  for (const t of index.templates) {
    for (const a of t.anchors) intern(a);
    internNodes(t.nodes, intern);
  }

  const w = createWriter(1024 * 1024);

  // Header: magic + version + termCount + anchorCount
  writeU32(w, MAGIC);
  writeU32(w, index.compilerVersion);
  writeU32(w, index.termCount);
  writeU32(w, index.anchorCount);

  // Token table: count + (len + utf8)*
  writeU32(w, tokenList.length);
  for (const token of tokenList) {
    writeString(w, token);
  }

  // Template table.
  for (const t of index.templates) {
    writeString(w, t.sourceTerm);
    writeString(w, t.normalizedTerm);
    writeU8(w, t.fixedTokenCount);
    writeU8(w, t.minSurfaceTokens);
    writeU8(w, t.maxSurfaceTokens);
    writeI32(w, t.frequencyRank);
    writeU8(w, t.anchors.length);
    for (const a of t.anchors) writeU32(w, intern(a));
    const nodeBytes = serializeNodes(t.nodes, intern);
    writeU32(w, nodeBytes.length);
    writeBytes(w, nodeBytes);
  }

  // Anchor table: per anchor — tokenId + postingCount + templateIds
  for (const key of index.anchorKeys) {
    writeU32(w, intern(key));
    const ids = index.lookupByAnchor(key);
    writeU32(w, ids.length);
    for (const id of ids) writeU32(w, id);
  }

  const buffer = w.bytes.slice(0, w.offset).buffer;
  (index as { byteSize: number }).byteSize = buffer.byteLength;
  return buffer;
}

/** Deserialize an ArrayBuffer back into a PhraseIndex. */
export function deserializePhraseIndex(buffer: ArrayBuffer): PhraseIndex {
  const view = new Uint8Array(buffer);
  let offset = 0;
  const magic = readU32(view, offset); offset += 4;
  if (magic !== MAGIC) throw new Error('phraseIndex: bad magic');
  const version = readU32(view, offset); offset += 4;
  if (version !== COMPILER_VERSION) {
    throw new Error(`phraseIndex: version mismatch (expected ${COMPILER_VERSION}, got ${version}). Re-import the dictionary to rebuild the phrase index.`);
  }
  const termCount = readU32(view, offset); offset += 4;
  const anchorCount = readU32(view, offset); offset += 4;

  // Token table.
  const tokenCount = readU32(view, offset); offset += 4;
  const tokens: string[] = [];
  for (let i = 0; i < tokenCount; i++) {
    const len = readU16(view, offset); offset += 2;
    tokens.push(utf8String(view.subarray(offset, offset + len)));
    offset += len;
  }

  // Template table.
  const templates: CompiledTemplate[] = new Array(termCount);
  for (let i = 0; i < termCount; i++) {
    const sourceTerm = readString(view, offset); offset += skipString(view, offset);
    const normalizedTerm = readString(view, offset); offset += skipString(view, offset);
    const fixedTokenCount = view[offset]!; offset += 1;
    const minSurfaceTokens = view[offset]!; offset += 1;
    const maxSurfaceTokens = view[offset]!; offset += 1;
    const frequencyRank = readI32(view, offset); offset += 4;
    const anchorN = view[offset]!; offset += 1;
    const anchorIds: number[] = [];
    for (let a = 0; a < anchorN; a++) {
      anchorIds.push(readU32(view, offset)); offset += 4;
    }
    const nodeBytesLen = readU32(view, offset); offset += 4;
    const nodesEnd = offset + nodeBytesLen;
    const nodes = deserializeNodes(view, offset, nodesEnd, tokens);
    offset = nodesEnd;
    const anchors = anchorIds.map((id) => tokens[id]!);
    templates[i] = {
      templateId: i,
      sourceTerm,
      normalizedTerm,
      nodes,
      fixedTokenCount,
      minSurfaceTokens,
      maxSurfaceTokens,
      frequencyRank,
      anchors,
    };
  }

  // Anchor table.
  const anchorKeys: string[] = new Array(anchorCount);
  const postings = new Map<string, number[]>();
  for (let i = 0; i < anchorCount; i++) {
    const tokenId = readU32(view, offset); offset += 4;
    const postingN = readU32(view, offset); offset += 4;
    const key = tokens[tokenId]!;
    anchorKeys[i] = key;
    const ids: number[] = [];
    for (let p = 0; p < postingN; p++) {
      ids.push(readU32(view, offset)); offset += 4;
    }
    postings.set(key, ids);
  }

  return {
    compilerVersion: version,
    termCount,
    templates,
    anchorKeys,
    anchorCount,
    lookupByAnchor: (token: string) => postings.get(token) ?? [],
    byteSize: buffer.byteLength,
  };
}

// --- Anchor selection ---

function collectAnchorCandidates(nodes: readonly PhraseNode[]): string[] {
  const cands: string[] = [];
  walkLiterals(nodes, (lit) => {
    if (lit.value.includes('/')) return;
    cands.push(lit.value);
  });
  return cands;
}

function walkLiterals(nodes: readonly PhraseNode[], visit: (node: { value: string; inflectableVerb: boolean }) => void): void {
  for (const n of nodes) {
    if (n.type === 'literal') visit(n);
    else if (n.type === 'optional') walkLiterals(n.children, visit);
    else if (n.type === 'alternative') {
      for (const branch of n.branches) walkLiterals(branch, visit);
    }
  }
}

function selectAnchors(candidates: string[], postingCounts: Map<string, number>, totalTemplates: number): string[] {
  // Deduplicate.
  const unique = [...new Set(candidates)];

  // Dynamic threshold: a word appearing in >1% of all templates is too common
  // to be a discriminative anchor. Skip it unless no better option remains.
  const commonThreshold = Math.max(50, Math.ceil(totalTemplates * 0.01));

  const scored = unique.map((c) => ({
    token: c,
    isStop: STOPWORDS.has(c) ? 1 : 0,
    isCommon: (postingCounts.get(c) ?? 0) > commonThreshold ? 1 : 0,
    postings: postingCounts.get(c) ?? 0,
    len: -c.length,
  }));

  // Sort: non-stopword → non-common → smallest posting → longest → alphabetical.
  scored.sort((a, b) =>
    a.isStop - b.isStop ||
    a.isCommon - b.isCommon ||
    a.postings - b.postings ||
    a.len - b.len ||
    a.token.localeCompare(b.token),
  );

  return scored.slice(0, MAX_ANCHORS).map((s) => s.token);
}

// --- Node serialization ---

function serializeNodes(nodes: readonly PhraseNode[], intern: (s: string) => number): Uint8Array {
  const w = createWriter(64);
  writeU16(w, nodes.length);
  for (const n of nodes) serializeNode(n, w, intern);
  return w.bytes.subarray(0, w.offset);
}

function serializeNode(node: PhraseNode, w: ByteWriter, intern: (s: string) => number): void {
  switch (node.type) {
    case 'literal':
      writeU8(w, NODE_LITERAL);
      writeU32(w, intern(node.value));
      writeU8(w, node.inflectableVerb ? 1 : 0);
      break;
    case 'optional':
      writeU8(w, NODE_OPTIONAL);
      writeU16(w, node.children.length);
      for (const c of node.children) serializeNode(c, w, intern);
      break;
    case 'alternative':
      writeU8(w, NODE_ALTERNATIVE);
      writeU16(w, node.branches.length);
      for (const branch of node.branches) {
        writeU16(w, branch.length);
        for (const c of branch) serializeNode(c, w, intern);
      }
      break;
    case 'slot':
      writeU8(w, NODE_SLOT);
      writeU8(w, node.kind === 'object' ? SLOT_OBJECT : node.kind === 'person' ? SLOT_PERSON : SLOT_POSSESSIVE);
      writeU8(w, node.maxTokens);
      break;
  }
}

function internNodes(nodes: readonly PhraseNode[], intern: (s: string) => number): void {
  walkLiterals(nodes, (lit) => intern(lit.value));
}

function deserializeNodes(view: Uint8Array, start: number, end: number, tokens: string[]): PhraseNode[] {
  let offset = start;
  const count = readU16(view, offset); offset += 2;
  const nodes: PhraseNode[] = [];
  for (let i = 0; i < count; i++) {
    offset = deserializeNode(view, offset, end, nodes, tokens);
  }
  return nodes;
}

function deserializeNode(view: Uint8Array, offset: number, end: number, out: PhraseNode[], tokens: string[]): number {
  const type = view[offset]!; offset += 1;
  switch (type) {
    case NODE_LITERAL: {
      const tokenId = readU32(view, offset); offset += 4;
      const inflectable = view[offset]! === 1; offset += 1;
      out.push({ type: 'literal', value: tokens[tokenId]!, inflectableVerb: inflectable });
      return offset;
    }
    case NODE_OPTIONAL: {
      const childCount = readU16(view, offset); offset += 2;
      const children: PhraseNode[] = [];
      for (let i = 0; i < childCount; i++) {
        offset = deserializeNode(view, offset, end, children, tokens);
      }
      out.push({ type: 'optional', children });
      return offset;
    }
    case NODE_ALTERNATIVE: {
      const branchCount = readU16(view, offset); offset += 2;
      const branches: PhraseNode[][] = [];
      for (let i = 0; i < branchCount; i++) {
        const bCount = readU16(view, offset); offset += 2;
        const branch: PhraseNode[] = [];
        for (let j = 0; j < bCount; j++) {
          offset = deserializeNode(view, offset, end, branch, tokens);
        }
        branches.push(branch);
      }
      out.push({ type: 'alternative', branches });
      return offset;
    }
    case NODE_SLOT: {
      const kind = view[offset]!; offset += 1;
      const maxTokens = view[offset]! || 6; offset += 1;
      out.push({
        type: 'slot',
        kind: kind === SLOT_OBJECT ? 'object' : kind === SLOT_PERSON ? 'person' : 'possessive',
        maxTokens,
      });
      return offset;
    }
    default:
      throw new Error(`phraseIndex: unknown node type ${type} at offset ${offset - 1}`);
  }
}

// --- Binary helpers ---

interface ByteWriter {
  bytes: Uint8Array;
  offset: number;
}

function createWriter(capacity: number): ByteWriter {
  return { bytes: new Uint8Array(capacity), offset: 0 };
}

function ensureCapacity(w: ByteWriter, n: number): void {
  if (w.offset + n <= w.bytes.length) return;
  let size = w.bytes.length * 2;
  while (w.offset + n > size) size *= 2;
  const next = new Uint8Array(size);
  next.set(w.bytes.subarray(0, w.offset));
  w.bytes = next;
}

function writeU8(w: ByteWriter, v: number): void {
  ensureCapacity(w, 1);
  w.bytes[w.offset] = v & 0xff;
  w.offset += 1;
}

function writeU16(w: ByteWriter, v: number): void {
  ensureCapacity(w, 2);
  w.bytes[w.offset] = v & 0xff;
  w.bytes[w.offset + 1] = (v >>> 8) & 0xff;
  w.offset += 2;
}

function writeU32(w: ByteWriter, v: number): void {
  ensureCapacity(w, 4);
  w.bytes[w.offset] = v & 0xff;
  w.bytes[w.offset + 1] = (v >>> 8) & 0xff;
  w.bytes[w.offset + 2] = (v >>> 16) & 0xff;
  w.bytes[w.offset + 3] = (v >>> 24) & 0xff;
  w.offset += 4;
}

function writeI32(w: ByteWriter, v: number): void {
  writeU32(w, v | 0);
}

function writeBytes(w: ByteWriter, bytes: Uint8Array): void {
  ensureCapacity(w, bytes.length);
  w.bytes.set(bytes, w.offset);
  w.offset += bytes.length;
}

function writeString(w: ByteWriter, s: string): void {
  const bytes = utf8Bytes(s);
  writeU16(w, bytes.length);
  writeBytes(w, bytes);
}

function readU16(view: Uint8Array, offset: number): number {
  return view[offset]! | (view[offset + 1]! << 8);
}

function readU32(view: Uint8Array, offset: number): number {
  return (view[offset]! | (view[offset + 1]! << 8) | (view[offset + 2]! << 16) | (view[offset + 3]! << 24)) >>> 0;
}

function readI32(view: Uint8Array, offset: number): number {
  return view[offset]! | (view[offset + 1]! << 8) | (view[offset + 2]! << 16) | (view[offset + 3]! << 24);
}

function readString(view: Uint8Array, offset: number): string {
  const len = readU16(view, offset);
  return utf8String(view.subarray(offset + 2, offset + 2 + len));
}

function skipString(view: Uint8Array, offset: number): number {
  const len = readU16(view, offset);
  return 2 + len;
}

function utf8Bytes(s: string): Uint8Array {
  return UTF8_ENCODER.encode(s);
}

function utf8String(bytes: Uint8Array): string {
  return UTF8_DECODER.decode(bytes);
}
