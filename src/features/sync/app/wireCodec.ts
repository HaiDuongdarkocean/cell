import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import type { ChangeRecord, Scope } from '../domain/types';
import { WIRE_FORMAT_VERSION } from './remotePaths';

export interface JournalFile {
  readonly formatVersion: number;
  readonly kind: 'journal';
  readonly scope: Scope;
  readonly deviceId: string;
  readonly seq: number;
  readonly records: ChangeRecord[];
}

export interface SnapshotFile {
  readonly formatVersion: number;
  readonly kind: 'snapshot';
  readonly scope: Scope;
  readonly deviceId: string;
  readonly n: number;
  readonly coversSeq: number;
  readonly records: ChangeRecord[];
}

export class WireFormatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WireFormatError';
  }
}

export function encodeJournal(input: {
  scope: Scope;
  deviceId: string;
  seq: number;
  records: readonly ChangeRecord[];
}): Blob {
  const payload: JournalFile = {
    formatVersion: WIRE_FORMAT_VERSION,
    kind: 'journal',
    scope: input.scope,
    deviceId: input.deviceId,
    seq: input.seq,
    records: [...input.records],
  };
  return toGzipBlob(payload);
}

export function decodeJournal(blob: Blob): Promise<JournalFile> {
  return decodeGzip(blob, 'journal') as Promise<JournalFile>;
}

export function encodeSnapshot(input: {
  scope: Scope;
  deviceId: string;
  n: number;
  coversSeq: number;
  records: readonly ChangeRecord[];
}): Blob {
  const payload: SnapshotFile = {
    formatVersion: WIRE_FORMAT_VERSION,
    kind: 'snapshot',
    scope: input.scope,
    deviceId: input.deviceId,
    n: input.n,
    coversSeq: input.coversSeq,
    records: [...input.records],
  };
  return toGzipBlob(payload);
}

export function decodeSnapshot(blob: Blob): Promise<SnapshotFile> {
  return decodeGzip(blob, 'snapshot') as Promise<SnapshotFile>;
}

function toGzipBlob(payload: JournalFile | SnapshotFile): Blob {
  const bytes = gzipSync(strToU8(JSON.stringify(payload)), { mtime: 0 });
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/gzip' });
}

async function decodeGzip(
  blob: Blob,
  kind: 'journal' | 'snapshot',
): Promise<JournalFile | SnapshotFile> {
  let parsed: unknown;
  try {
    const bytes = gunzipSync(await blobBytes(blob));
    parsed = JSON.parse(strFromU8(bytes));
  } catch (e) {
    throw new WireFormatError(`cannot decode ${kind} file`, { cause: e });
  }
  if (!isWireFile(parsed, kind)) {
    throw new WireFormatError(`not a wire v1 ${kind} file`);
  }
  return parsed;
}

function isWireFile(value: unknown, kind: 'journal' | 'snapshot'): value is JournalFile | SnapshotFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as { formatVersion?: unknown; kind?: unknown; records?: unknown };
  return (
    file.formatVersion === WIRE_FORMAT_VERSION &&
    file.kind === kind &&
    Array.isArray(file.records)
  );
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('blob read failed'));
    reader.readAsArrayBuffer(blob);
  });
}
