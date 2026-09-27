import { compareHlc } from '../hlc';
import type { ChangeRecord } from '../types';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (isObject(value)) {
    const inner = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',');
    return `{${inner}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function compareJson(a: unknown, b: unknown): number {
  const sa = canonicalJson(a);
  const sb = canonicalJson(b);
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

export function compareRecordContent(a: ChangeRecord, b: ChangeRecord): number {
  if (a.op !== b.op) return a.op === 'delete' ? -1 : 1;
  const byValue = compareJson(a.value ?? null, b.value ?? null);
  if (byValue !== 0) return byValue;
  if (a.firstHlc === undefined && b.firstHlc === undefined) return 0;
  if (a.firstHlc === undefined) return -1;
  if (b.firstHlc === undefined) return 1;
  return compareHlc(a.firstHlc, b.firstHlc);
}

export function compareRecords(a: ChangeRecord, b: ChangeRecord): number {
  return compareHlc(a.hlc, b.hlc) || compareRecordContent(a, b);
}

export function pickWinner(a: ChangeRecord, b: ChangeRecord): ChangeRecord {
  return compareRecords(a, b) >= 0 ? a : b;
}
