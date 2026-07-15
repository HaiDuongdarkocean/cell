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
const COMPILER_VERSION = 1;
const MAX_ANCHORS = 3;

const NODE_LITERAL = 0;
const NODE_OPTIONAL = 1;
const NODE_ALTERNATIVE = 2;
const NODE_SLOT = 3;

const SLOT_OBJECT = 0;
const SLOT_PERSON = 1;
const SLOT_POSSESSIVE = 2;

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

/** Compile parsed templates into an in-memory phrase index. */
export function compilePhraseIndex(inputs: readonly PhraseIndexInput[]): PhraseIndex {
  const templates: CompiledTemplate[] = inputs.map((input, i) => ({
    templateId: input.templateId === 0 && i > 0 ? i : input.templateId,
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

  // Build byte chunks.
  const chunks: number[] = [];

  // Header: magic + version + termCount + anchorCount
  pushU32(chunks, MAGIC);
  pushU32(chunks, index.compilerVersion);
  pushU32(chunks, index.termCount);
  pushU32(chunks, index.anchorCount);

  // Token table: count + (len + utf8)*
  pushU32(chunks, tokenList.length);
  for (const token of tokenList) {
    const bytes = utf8Bytes(token);
    pushU16(chunks, bytes.length);
    for (const b of bytes) chunks.push(b);
  }

  // Template table.
  for (const t of index.templates) {
    pushString(chunks, t.sourceTerm);
    pushString(chunks, t.normalizedTerm);
    chunks.push(t.fixedTokenCount & 0xff);
    chunks.push(t.minSurfaceTokens & 0xff);
    chunks.push(t.maxSurfaceTokens & 0xff);
    pushI32(chunks, t.frequencyRank);
    chunks.push(t.anchors.length & 0xff);
    for (const a of t.anchors) pushU32(chunks, intern(a));
    const nodeBytes = serializeNodes(t.nodes, intern);
    pushU32(chunks, nodeBytes.length);
    for (const b of nodeBytes) chunks.push(b);
  }

  // Anchor table: per anchor — tokenId + postingCount + templateIds
  for (const key of index.anchorKeys) {
    pushU32(chunks, intern(key));
    const ids = index.lookupByAnchor(key);
    pushU32(chunks, ids.length);
    for (const id of ids) pushU32(chunks, id);
  }

  const buffer = new Uint8Array(chunks).buffer;
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

function serializeNodes(nodes: readonly PhraseNode[], intern: (s: string) => number): number[] {
  const out: number[] = [];
  pushU16(out, nodes.length);
  for (const n of nodes) serializeNode(n, out, intern);
  return out;
}

function serializeNode(node: PhraseNode, out: number[], intern: (s: string) => number): void {
  switch (node.type) {
    case 'literal':
      out.push(NODE_LITERAL);
      pushU32(out, intern(node.value));
      out.push(node.inflectableVerb ? 1 : 0);
      break;
    case 'optional':
      out.push(NODE_OPTIONAL);
      pushU16(out, node.children.length);
      for (const c of node.children) serializeNode(c, out, intern);
      break;
    case 'alternative':
      out.push(NODE_ALTERNATIVE);
      pushU16(out, node.branches.length);
      for (const branch of node.branches) {
        pushU16(out, branch.length);
        for (const c of branch) serializeNode(c, out, intern);
      }
      break;
    case 'slot':
      out.push(NODE_SLOT);
      out.push(node.kind === 'object' ? SLOT_OBJECT : node.kind === 'person' ? SLOT_PERSON : SLOT_POSSESSIVE);
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
      out.push({
        type: 'slot',
        kind: kind === SLOT_OBJECT ? 'object' : kind === SLOT_PERSON ? 'person' : 'possessive',
      });
      return offset;
    }
    default:
      throw new Error(`phraseIndex: unknown node type ${type} at offset ${offset - 1}`);
  }
}

// --- Binary helpers ---

function pushU16(out: number[], v: number): void {
  out.push(v & 0xff, (v >>> 8) & 0xff);
}

function pushU32(out: number[], v: number): void {
  out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

function pushI32(out: number[], v: number): void {
  pushU32(out, v | 0);
}

function pushString(out: number[], s: string): void {
  const bytes = utf8Bytes(s);
  pushU16(out, bytes.length);
  for (const b of bytes) out.push(b);
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

function utf8Bytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function utf8String(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
