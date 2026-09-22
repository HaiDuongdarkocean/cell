export interface ZipEntryMeta {
  /** Absolute offset of the entry's local file header. */
  offset: number;
  compressedSize: number;
  /** ZIP compression method: 0 = stored, 8 = deflate. */
  method: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_SIZE = 22;
const EOCD_MAX_TAIL = EOCD_SIZE + 0xffff;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_LOCATOR_SIZE = 20;
const ZIP64_EOCD_SIZE = 56;
const CD_ENTRY_SIGNATURE = 0x02014b50;
const CD_ENTRY_FIXED_SIZE = 46;
const ZIP64_EXTRA_TAG = 0x0001;
const U32_SATURATED = 0xffffffff;
const U16_SATURATED = 0xffff;

export async function readRange(
  file: File,
  start: number,
  end: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const blob = file.slice(start, end);
  if (blob.arrayBuffer) return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsArrayBuffer(blob);
  });
}

function readU64(view: DataView, at: number): number {
  return view.getUint32(at + 4, true) * 0x100000000 + view.getUint32(at, true);
}

function readZip64Extra(
  view: DataView,
  extraStart: number,
  extraLength: number,
  needCompressed: boolean,
  needOffset: boolean,
  needUncompressed: boolean,
): { compressedSize?: number; offset?: number } {
  const out: { compressedSize?: number; offset?: number } = {};
  let p = extraStart;
  const end = extraStart + extraLength;
  while (p + 4 <= end) {
    const tag = view.getUint16(p, true);
    const size = view.getUint16(p + 2, true);
    if (tag === ZIP64_EXTRA_TAG) {
      let q = p + 4;
      if (needUncompressed) q += 8;
      if (needCompressed) {
        out.compressedSize = readU64(view, q);
        q += 8;
      }
      if (needOffset) out.offset = readU64(view, q);
      break;
    }
    p += 4 + size;
  }
  return out;
}

async function locateCentralDirectory(file: File): Promise<{ offset: number; size: number }> {
  const tailStart = Math.max(0, file.size - EOCD_MAX_TAIL);
  const tail = await readRange(file, tailStart, file.size);
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);

  let eocd = -1;
  for (let i = tail.length - EOCD_SIZE; i >= 0; i--) {
    if (
      tailView.getUint32(i, true) === EOCD_SIGNATURE &&
      i + EOCD_SIZE + tailView.getUint16(i + 20, true) === tail.length
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip EOCD not found');

  let offset = tailView.getUint32(eocd + 16, true);
  let size = tailView.getUint32(eocd + 12, true);
  const saturated =
    offset === U32_SATURATED ||
    size === U32_SATURATED ||
    tailView.getUint16(eocd + 10, true) === U16_SATURATED;
  if (saturated) {
    const locatorPos = tailStart + eocd - ZIP64_LOCATOR_SIZE;
    const locator = await readRange(file, locatorPos, locatorPos + ZIP64_LOCATOR_SIZE);
    const locView = new DataView(locator.buffer, locator.byteOffset, locator.byteLength);
    if (locView.getUint32(0, true) !== ZIP64_LOCATOR_SIGNATURE) {
      throw new Error('zip64 locator missing');
    }
    const zip64Pos = readU64(locView, 8);
    const zip64 = await readRange(file, zip64Pos, zip64Pos + ZIP64_EOCD_SIZE);
    const z64View = new DataView(zip64.buffer, zip64.byteOffset, zip64.byteLength);
    offset = readU64(z64View, 48);
    size = readU64(z64View, 40);
  }
  return { offset, size };
}

function readEntryMeta(
  view: DataView,
  pos: number,
  nameLen: number,
  extraLen: number,
): ZipEntryMeta {
  const method = view.getUint16(pos + 10, true);
  let compressedSize = view.getUint32(pos + 20, true);
  const uncompressed32 = view.getUint32(pos + 24, true);
  let offset = view.getUint32(pos + 42, true);
  if (
    compressedSize === U32_SATURATED ||
    offset === U32_SATURATED ||
    uncompressed32 === U32_SATURATED
  ) {
    const z = readZip64Extra(
      view,
      pos + CD_ENTRY_FIXED_SIZE + nameLen,
      extraLen,
      compressedSize === U32_SATURATED,
      offset === U32_SATURATED,
      uncompressed32 === U32_SATURATED,
    );
    if (z.compressedSize !== undefined) compressedSize = z.compressedSize;
    if (z.offset !== undefined) offset = z.offset;
  }
  return { offset, compressedSize, method };
}

export async function readCentralDirectory(file: File): Promise<Uint8Array<ArrayBuffer>> {
  const { offset, size } = await locateCentralDirectory(file);
  return readRange(file, offset, offset + size);
}

export function parseCentralDirectory(cd: Uint8Array): Record<string, ZipEntryMeta> {
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const decoder = new TextDecoder();
  const entries: Record<string, ZipEntryMeta> = Object.create(null);

  let pos = 0;
  while (pos + CD_ENTRY_FIXED_SIZE <= cd.length) {
    if (view.getUint32(pos, true) !== CD_ENTRY_SIGNATURE) break;
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const name = decoder.decode(
      cd.subarray(pos + CD_ENTRY_FIXED_SIZE, pos + CD_ENTRY_FIXED_SIZE + nameLen),
    );
    const meta = readEntryMeta(view, pos, nameLen, extraLen);
    if (!name.endsWith('/') && (meta.method === 0 || meta.method === 8)) {
      entries[name] = meta;
    }
    pos += CD_ENTRY_FIXED_SIZE + nameLen + extraLen + commentLen;
  }
  return entries;
}

export async function scanZipDirectory(file: File): Promise<Record<string, ZipEntryMeta>> {
  return parseCentralDirectory(await readCentralDirectory(file));
}

function asciiEq(a: number, b: number): boolean {
  if (a >= 65 && a <= 90) a += 32;
  if (b >= 65 && b <= 90) b += 32;
  return a === b;
}

function bytesMatch(cd: Uint8Array, start: number, length: number, target: Uint8Array): boolean {
  if (length !== target.length) return false;
  for (let i = 0; i < length; i++) {
    if (!asciiEq(cd[start + i], target[i])) return false;
  }
  return true;
}

function basenameStart(cd: Uint8Array, start: number, length: number): number {
  for (let i = start + length - 1; i >= start; i--) {
    if (cd[i] === 0x2f || cd[i] === 0x5c) return i + 1;
  }
  return start;
}

export function matchCentralDirectoryEntries(
  cd: Uint8Array,
  paths: readonly string[],
): (ZipEntryMeta | undefined)[] {
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const encoder = new TextEncoder();
  const targets = paths.map((p) => encoder.encode(p));
  const targetBases = targets.map((t) => t.subarray(basenameStart(t, 0, t.length)));
  const exact: (ZipEntryMeta | undefined)[] = new Array(paths.length);
  const fallback: (ZipEntryMeta | undefined)[] = new Array(paths.length);
  let remaining = paths.length;

  let pos = 0;
  while (pos + CD_ENTRY_FIXED_SIZE <= cd.length && remaining > 0) {
    if (view.getUint32(pos, true) !== CD_ENTRY_SIGNATURE) break;
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const nameStart = pos + CD_ENTRY_FIXED_SIZE;
    const method = view.getUint16(pos + 10, true);

    if (method === 0 || method === 8) {
      for (let i = 0; i < targets.length; i++) {
        if (exact[i]) continue;
        if (bytesMatch(cd, nameStart, nameLen, targets[i])) {
          exact[i] = readEntryMeta(view, pos, nameLen, extraLen);
          remaining--;
          continue;
        }
        if (!fallback[i]) {
          const baseStart = basenameStart(cd, nameStart, nameLen);
          if (bytesMatch(cd, baseStart, nameStart + nameLen - baseStart, targetBases[i])) {
            fallback[i] = readEntryMeta(view, pos, nameLen, extraLen);
          }
        }
      }
    }
    pos += CD_ENTRY_FIXED_SIZE + nameLen + extraLen + commentLen;
  }
  return paths.map((_, i) => exact[i] ?? fallback[i]);
}

export function matchCentralDirectoryEntry(
  cd: Uint8Array,
  path: string,
): ZipEntryMeta | undefined {
  return matchCentralDirectoryEntries(cd, [path])[0];
}

export async function scanZipEntryForPath(
  file: File,
  path: string,
): Promise<ZipEntryMeta | undefined> {
  return matchCentralDirectoryEntry(await readCentralDirectory(file), path);
}
