import { compareHlc } from './hlc';
import type { ChangeOp, Hlc, RecordKey, RecordMeta } from './types';

export type PathPattern = readonly string[];

export type DecodedSegment =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'element'; readonly id: string };

export interface ElementArrayRule {
  readonly path: PathPattern;
  readonly elementId: (element: unknown) => string | null;
  readonly stripFields?: readonly string[];
}

export interface FieldRegistry {
  readonly syncedPaths: readonly PathPattern[];
  readonly excludedPaths?: readonly PathPattern[];
  readonly elementArrays?: readonly ElementArrayRule[];
}

export interface FlatLeaf {
  readonly path: string;
  readonly value: unknown;
}

export interface FlatRecord {
  readonly path: string;
  readonly value?: unknown;
  readonly op?: ChangeOp;
  readonly hlc?: Hlc;
  readonly firstHlc?: Hlc;
}

export interface FlattenDiff {
  readonly puts: readonly FlatLeaf[];
  readonly tombstones: readonly string[];
}

export interface UnflattenResult {
  readonly value: unknown;
  readonly materialized: readonly FlatRecord[];
  readonly rejected: readonly FlatRecord[];
}

const WILDCARD = '*';
const ELEMENT_MARKER = '@';
const ZERO_HLC: Hlc = { wall: 0, counter: 0, node: '' };

export function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function escapePathSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function unescapePathSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function encodePath(segments: readonly string[]): string {
  return segments.map(encodeKeySegment).join('/');
}

export function encodeElementSegment(elementId: string): string {
  return `${ELEMENT_MARKER}${escapePathSegment(elementId)}`;
}

export function decodePath(path: string): DecodedSegment[] {
  if (path === '') return [];
  return path.split('/').map(decodeSegment);
}

export function segmentKeys(segments: readonly DecodedSegment[]): (string | null)[] {
  return segments.map((s) => (s.kind === 'key' ? s.key : null));
}

export function matchPathPattern(
  pattern: PathPattern,
  segments: readonly DecodedSegment[],
): boolean {
  if (pattern.length === 0) return segments.length === 0;
  const [head, ...rest] = pattern;
  if (head === WILDCARD) {
    for (let skip = 0; skip <= segments.length; skip += 1) {
      if (matchPathPattern(rest, segments.slice(skip))) return true;
    }
    return false;
  }
  const first = segments[0];
  if (first === undefined || first.kind !== 'key' || first.key !== head) return false;
  return matchPathPattern(rest, segments.slice(1));
}

export function elementArrayRuleFor(
  segments: readonly DecodedSegment[],
  registry: FieldRegistry,
): ElementArrayRule | undefined {
  return (registry.elementArrays ?? []).find((rule) => matchPathPattern(rule.path, segments));
}

export function isSyncedPath(
  segments: readonly DecodedSegment[],
  registry: FieldRegistry,
): boolean {
  return registry.syncedPaths.some((prefix) => isPrefixOf(prefix, segments));
}

export function isExcludedPath(
  segments: readonly DecodedSegment[],
  registry: FieldRegistry,
): boolean {
  return (registry.excludedPaths ?? []).some((pattern) => matchPathPattern(pattern, segments));
}

export function isMaterializablePath(path: string, registry: FieldRegistry): boolean {
  const segments = decodePath(path);
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].kind === 'element') {
      if (i !== segments.length - 1) return false;
      if (!elementArrayRuleFor(segments.slice(0, i), registry)) return false;
    }
  }
  return isSyncedPath(segments, registry) && !isExcludedPath(segments, registry);
}

export function isMaterializableKvPath(
  storageKey: string,
  key: RecordKey,
  registry: FieldRegistry,
): boolean {
  const path = kvRecordPath(storageKey, key);
  return path !== null && isMaterializablePath(path, registry);
}

export function flatten(value: unknown, registry: FieldRegistry): FlatLeaf[] {
  const out: FlatLeaf[] = [];
  walk(value, [], registry, out);
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

export function unflatten(
  records: readonly FlatRecord[],
  registry: FieldRegistry,
): UnflattenResult {
  const live = records.filter((record) => record.op !== 'delete');
  const accepted: FlatRecord[] = [];
  const rejected: FlatRecord[] = [];
  for (const record of live) {
    if (isMaterializablePath(record.path, registry)) accepted.push(record);
    else rejected.push(record);
  }
  const materialized: FlatRecord[] = [];
  const root: TreeNode = {};
  for (const record of [...accepted].sort(compareForPlacement)) {
    if (insertRecord(root, decodePath(record.path), record)) materialized.push(record);
    else rejected.push(record);
  }
  return { value: buildValue(root), materialized, rejected };
}

export function diffFlattened(
  previous: readonly FlatLeaf[],
  next: readonly FlatLeaf[],
): FlattenDiff {
  const prevByPath = new Map(previous.map((leaf) => [leaf.path, leaf.value]));
  const nextPaths = new Set(next.map((leaf) => leaf.path));
  const puts = next.filter(
    (leaf) => !prevByPath.has(leaf.path) || !jsonEquals(prevByPath.get(leaf.path), leaf.value),
  );
  const tombstones = previous.map((leaf) => leaf.path).filter((path) => !nextPaths.has(path));
  return { puts, tombstones };
}

export function jsonEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => jsonEquals(v, b[i]));
  }
  if (isPlainJsonObject(a) && isPlainJsonObject(b)) {
    const aKeys = Object.keys(a).filter((k) => a[k] !== undefined);
    const bKeys = Object.keys(b).filter((k) => b[k] !== undefined);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEquals(a[k], b[k]))
    );
  }
  return false;
}

export function nextFirstHlc(previous: RecordMeta | undefined, putHlc: Hlc): Hlc {
  if (previous && previous.op === 'put') return previous.firstHlc ?? previous.hlc;
  return putHlc;
}

export function kvRecordKey(storageKey: string, path: string): RecordKey {
  return path === '' ? `kv:${storageKey}` : `kv:${storageKey}/${path}`;
}

export function kvRecordPath(storageKey: string, key: RecordKey): string | null {
  const prefix = `kv:${storageKey}`;
  if (key === prefix) return '';
  if (key.startsWith(`${prefix}/`)) return key.slice(prefix.length + 1);
  return null;
}

export function profileRecordKey(path: string): RecordKey {
  return path === '' ? 'profile' : `profile/${path}`;
}

function encodeKeySegment(key: string): string {
  const escaped = escapePathSegment(key);
  return key.startsWith(ELEMENT_MARKER) ? `${ELEMENT_MARKER}${escaped}` : escaped;
}

function decodeSegment(segment: string): DecodedSegment {
  if (segment.startsWith(`${ELEMENT_MARKER}${ELEMENT_MARKER}`)) {
    return { kind: 'key', key: unescapePathSegment(segment.slice(1)) };
  }
  if (segment.startsWith(ELEMENT_MARKER)) {
    return { kind: 'element', id: unescapePathSegment(segment.slice(1)) };
  }
  return { kind: 'key', key: unescapePathSegment(segment) };
}

function isPrefixOf(prefix: PathPattern, segments: readonly DecodedSegment[]): boolean {
  if (prefix.length > segments.length) return false;
  return prefix.every((p, i) => {
    const seg = segments[i];
    return p === WILDCARD ? seg !== undefined : seg.kind === 'key' && seg.key === p;
  });
}

function keySegments(segments: readonly string[]): DecodedSegment[] {
  return segments.map((key) => ({ kind: 'key', key }));
}

function isKeyPrefixOf(segments: readonly string[], path: PathPattern): boolean {
  if (segments.length > path.length) return false;
  return segments.every((key, i) => path[i] === key);
}

function mayContainSynced(segments: readonly string[], registry: FieldRegistry): boolean {
  const segs = keySegments(segments);
  return registry.syncedPaths.some(
    (prefix) => isPrefixOf(prefix, segs) || isKeyPrefixOf(segments, prefix),
  );
}

function emitPath(rawSegments: readonly string[], elementId: string | null): string {
  const keyPart = encodePath(rawSegments);
  if (elementId === null) return keyPart;
  const elementPart = encodeElementSegment(elementId);
  return keyPart === '' ? elementPart : `${keyPart}/${elementPart}`;
}

function stripElementFields(element: unknown, fields: readonly string[] | undefined): unknown {
  if (!fields || fields.length === 0 || !isPlainJsonObject(element)) return element;
  const clone = { ...element };
  for (const field of fields) delete clone[field];
  return clone;
}

function walk(
  node: unknown,
  segments: string[],
  registry: FieldRegistry,
  out: FlatLeaf[],
): void {
  if (node === undefined || typeof node === 'function' || typeof node === 'symbol') return;
  if (!mayContainSynced(segments, registry)) return;
  if (isExcludedPath(keySegments(segments), registry)) return;
  const rule = elementArrayRuleFor(keySegments(segments), registry);
  if (rule) {
    if (!isSyncedPath(keySegments(segments), registry)) return;
    if (!Array.isArray(node)) {
      out.push({ path: emitPath(segments, null), value: node });
      return;
    }
    for (const element of node) {
      const id = rule.elementId(element);
      if (id === null || id === '') continue;
      out.push({
        path: emitPath(segments, id),
        value: stripElementFields(element, rule.stripFields),
      });
    }
    return;
  }
  if (Array.isArray(node)) {
    if (isSyncedPath(keySegments(segments), registry)) {
      out.push({ path: emitPath(segments, null), value: node });
    }
    return;
  }
  if (isPlainJsonObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      walk(value, [...segments, key], registry, out);
    }
    return;
  }
  if (isSyncedPath(keySegments(segments), registry)) {
    out.push({ path: emitPath(segments, null), value: node });
  }
}

interface PlacedElement {
  readonly record: FlatRecord;
  readonly order: number | null;
  readonly sortHlc: Hlc;
}

interface TreeNode {
  leaf?: FlatRecord;
  children?: Map<string, TreeNode>;
  elements?: Map<string, PlacedElement>;
}

function recordHlc(record: FlatRecord): Hlc {
  return record.hlc ?? ZERO_HLC;
}

function compareForPlacement(a: FlatRecord, b: FlatRecord): number {
  const byHlc = compareHlc(recordHlc(b), recordHlc(a));
  if (byHlc !== 0) return byHlc;
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

function insertRecord(root: TreeNode, segments: readonly DecodedSegment[], record: FlatRecord): boolean {
  let node = root;
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg.kind === 'element') {
      if (i !== segments.length - 1) return false;
      if (node.leaf !== undefined || node.children !== undefined) return false;
      node.elements ??= new Map();
      if (!node.elements.has(seg.id)) {
        node.elements.set(seg.id, {
          record,
          order: elementOrder(record.value),
          sortHlc: record.firstHlc ?? record.hlc ?? ZERO_HLC,
        });
      }
      return true;
    }
    if (node.leaf !== undefined || node.elements !== undefined) return false;
    node.children ??= new Map();
    let child = node.children.get(seg.key);
    if (!child) {
      child = {};
      node.children.set(seg.key, child);
    }
    node = child;
  }
  if (node.leaf !== undefined || node.children !== undefined || node.elements !== undefined) {
    return false;
  }
  node.leaf = record;
  return true;
}

function elementOrder(value: unknown): number | null {
  if (!isPlainJsonObject(value)) return null;
  const order = value.order;
  return typeof order === 'number' && Number.isFinite(order) ? order : null;
}

function compareElements(a: PlacedElement, b: PlacedElement): number {
  if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
  const byHlc = compareHlc(a.sortHlc, b.sortHlc);
  if (byHlc !== 0) return byHlc;
  const aId = a.record.path;
  const bId = b.record.path;
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

function buildValue(node: TreeNode): unknown {
  if (node.leaf !== undefined) return node.leaf.value;
  if (node.elements !== undefined) {
    return [...node.elements.values()].sort(compareElements).map((e) => e.record.value);
  }
  if (node.children !== undefined) {
    const out: Record<string, unknown> = {};
    for (const key of [...node.children.keys()].sort()) {
      out[key] = buildValue(node.children.get(key) as TreeNode);
    }
    return out;
  }
  return undefined;
}
