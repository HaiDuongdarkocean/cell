// jsonElementScanner — incremental top-level JSON array element scanner.
//
// Streaming counterpart of jsonObjectScanner: instead of one decoded string
// in RAM, callers feed arbitrary text chunks; the scanner emits each
// completed top-level element's source slice. Peak memory is bounded by the
// current chunk plus the largest single element.
//
// Element kinds emitted: 'object' | 'array' | 'string' | 'literal'. The
// scanner only locates boundaries — JSON.parse on each slice stays the
// authority on element validity (a mis-cut boundary throws there).
// Envelope rules match jsonObjectScanner: leading '[', commas between
// elements, single closing ']', no trailing content → MalformedJsonArrayError.

import { MalformedJsonArrayError } from './jsonObjectScanner';

export type JsonElementKind = 'object' | 'array' | 'string' | 'literal';
export interface ScannedElement {
  readonly kind: JsonElementKind;
  readonly text: string;
}

const CODE_QUOTE = 0x22;
const CODE_BACKSLASH = 0x5c;
const CODE_OPEN_BRACE = 0x7b;
const CODE_CLOSE_BRACE = 0x7d;
const CODE_COMMA = 0x2c;
const CODE_OPEN_BRACKET = 0x5b;
const CODE_CLOSE_BRACKET = 0x5d;
const CODE_SPACE = 0x20;
const CODE_TAB = 0x09;
const CODE_LF = 0x0a;
const CODE_CR = 0x0d;

const PRIMITIVE_CHARS = new Set([
  ...'0123456789-+.eE',
  ...'truefalsn',
]);

const JSON_PRIMITIVE = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/;

function isWhitespace(code: number): boolean {
  return code === CODE_SPACE || code === CODE_TAB || code === CODE_LF || code === CODE_CR;
}

type ScanPhase = 'pre' | 'elem' | 'sep' | 'prim' | 'done';

/** Resumable scanner over text chunks of a top-level JSON array. */
export class JsonArrayElementScanner {
  private buf = '';
  private pos = 0;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private elemStart = -1;
  private elemKind: JsonElementKind | null = null;
  private primStart = -1;
  private phase: ScanPhase = 'pre';
  private elemAfterComma = false;
  private readonly collectText: boolean;
  private readonly allowTrailing: boolean;

  /** collectText=false emits kind without copying the slice — count passes.
   *  allowTrailing: ignore content after ']' — used when the array is a
   *  member of an enclosing object (its '}' is the parent's, not garbage). */
  constructor(options?: { collectText?: boolean; allowTrailing?: boolean }) {
    this.collectText = options?.collectText ?? true;
    this.allowTrailing = options?.allowTrailing ?? false;
  }

  /** Feed a text chunk; returns elements completed within it. */
  push(chunk: string): ScannedElement[] {
    this.buf += chunk;
    const out: ScannedElement[] = [];
    const buf = this.buf;
    let i = this.pos;
    for (; i < buf.length; i++) {
      const code = buf.charCodeAt(i);
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (code === CODE_BACKSLASH) this.escaped = true;
        else if (code === CODE_QUOTE) {
          this.inString = false;
          if (this.depth === 0) {
            out.push(this.emit('string', this.elemStart, i + 1));
            this.elemStart = -1;
            this.phase = 'sep';
          }
        }
        continue;
      }
      if (this.depth > 0) {
        if (code === CODE_QUOTE) this.inString = true;
        else if (code === CODE_OPEN_BRACE || code === CODE_OPEN_BRACKET) this.depth++;
        else if (code === CODE_CLOSE_BRACE || code === CODE_CLOSE_BRACKET) {
          this.depth--;
          if (this.depth === 0) {
            out.push(this.emit(this.elemKind!, this.elemStart, i + 1));
            this.elemStart = -1;
            this.elemKind = null;
            this.phase = 'sep';
          }
        }
        continue;
      }
      switch (this.phase) {
        case 'pre':
          if (isWhitespace(code)) break;
          if (code !== CODE_OPEN_BRACKET) {
            throw new MalformedJsonArrayError(`expected '[' at offset ${i}`);
          }
          this.phase = 'elem';
          this.elemAfterComma = false;
          break;
        case 'elem':
          if (isWhitespace(code)) break;
          if (code === CODE_CLOSE_BRACKET) {
            if (this.elemAfterComma) {
              throw new MalformedJsonArrayError(`trailing comma before ']' at offset ${i}`);
            }
            this.phase = 'done';
            break;
          }
          if (code === CODE_QUOTE) {
            this.inString = true;
            this.elemStart = i;
            this.elemKind = 'string';
            break;
          }
          if (code === CODE_OPEN_BRACE || code === CODE_OPEN_BRACKET) {
            this.elemStart = i;
            this.elemKind = code === CODE_OPEN_BRACE ? 'object' : 'array';
            this.depth = 1;
            break;
          }
          if (PRIMITIVE_CHARS.has(buf[i]!)) {
            this.primStart = i;
            this.phase = 'prim';
            break;
          }
          throw new MalformedJsonArrayError(`unexpected character "${buf[i]}" at offset ${i}`);
        case 'prim': {
          if (PRIMITIVE_CHARS.has(buf[i]!)) break;
          if (!JSON_PRIMITIVE.test(buf.slice(this.primStart, i))) {
            throw new MalformedJsonArrayError(`invalid literal at offset ${this.primStart}`);
          }
          out.push(this.emit('literal', this.primStart, i));
          this.primStart = -1;
          if (isWhitespace(code)) {
            this.phase = 'sep';
            break;
          }
          if (code === CODE_COMMA) {
            this.phase = 'elem';
            this.elemAfterComma = true;
            break;
          }
          if (code === CODE_CLOSE_BRACKET) {
            this.phase = 'done';
            break;
          }
          throw new MalformedJsonArrayError(`unexpected character "${buf[i]}" at offset ${i}`);
        }
        case 'sep':
          if (isWhitespace(code)) break;
          if (code === CODE_COMMA) {
            this.phase = 'elem';
            this.elemAfterComma = true;
            break;
          }
          if (code === CODE_CLOSE_BRACKET) {
            this.phase = 'done';
            break;
          }
          throw new MalformedJsonArrayError(`expected ',' or ']' at offset ${i}`);
        case 'done':
          if (this.allowTrailing) {
            this.pos = buf.length;
            return out;
          }
          if (isWhitespace(code)) break;
          throw new MalformedJsonArrayError(`trailing content at offset ${i}`);
      }
    }
    this.pos = i;
    // Drop consumed prefix — keep only an in-progress element's text.
    const keepFrom =
      this.elemStart >= 0 ? this.elemStart : this.primStart >= 0 ? this.primStart : this.pos;
    if (keepFrom > 0) {
      this.buf = buf.slice(keepFrom);
      this.pos -= keepFrom;
      if (this.elemStart >= 0) this.elemStart -= keepFrom;
      if (this.primStart >= 0) this.primStart -= keepFrom;
    }
    return out;
  }

  /** Signal EOF — the envelope must have closed cleanly. */
  finish(): void {
    if (this.inString || this.depth !== 0 || this.phase !== 'done') {
      throw new MalformedJsonArrayError('unterminated JSON array');
    }
  }

  private emit(kind: JsonElementKind, start: number, end: number): ScannedElement {
    return { kind, text: this.collectText ? this.buf.slice(start, end) : '' };
  }
}

/** Elements of a top-level JSON array from a text-chunk stream. */
export async function* iterJsonArrayElements(
  chunks: AsyncIterable<string>,
  options?: { collectText?: boolean; allowTrailing?: boolean },
): AsyncGenerator<ScannedElement> {
  const scanner = new JsonArrayElementScanner(options);
  for await (const chunk of chunks) {
    for (const el of scanner.push(chunk)) yield el;
  }
  scanner.finish();
}

/** Elements of `{"…": …, "member": [ … ], "…": …}` — locates the named
 *  member inside a top-level object, then streams its array elements through
 *  the same element scanner. Other members' values are skipped with depth
 *  tracking, so a big `index` map never lands in memory. */
export async function* iterJsonObjectMemberElements(
  chunks: AsyncIterable<string>,
  member: string,
  options?: { collectText?: boolean; onFound?: () => void; allowTrailing?: boolean },
): AsyncGenerator<ScannedElement> {
  const it = chunks[Symbol.asyncIterator]();
  let buf = '';
  let pos = 0;

  const refill = async (): Promise<boolean> => {
    for (;;) {
      if (pos < buf.length) return true;
      const next = await it.next();
      if (next.done) return false;
      buf = next.value;
      pos = 0;
    }
  };
  const skipWs = async (): Promise<number> => {
    for (;;) {
      if (!(await refill())) return -1;
      const code = buf.charCodeAt(pos);
      if (!isWhitespace(code)) return code;
      pos++;
    }
  };
  // Read a "..." string starting at the quote; returns the raw source text.
  // Accumulates across refills — a key may span a chunk boundary.
  const readString = async (): Promise<string> => {
    const start = pos; // the opening quote
    pos++;
    let acc = '';
    let seg = start;
    let escapedNext = false;
    for (;;) {
      while (pos >= buf.length) {
        acc += buf.slice(seg);
        const next = await it.next();
        if (next.done) throw new MalformedJsonArrayError('unterminated string in object member');
        buf = next.value;
        pos = 0;
        seg = 0;
      }
      const code = buf.charCodeAt(pos++);
      if (escapedNext) {
        escapedNext = false;
        continue;
      }
      if (code === CODE_BACKSLASH) {
        escapedNext = true;
      } else if (code === CODE_QUOTE) {
        return acc + buf.slice(seg, pos);
      }
    }
  };
  // Skip one JSON value (any kind) — leaves pos just past it.
  const skipValue = async (): Promise<void> => {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let primSeen = false;
    for (;;) {
      if (!(await refill())) {
        if (depth === 0 && !inString) return;
        throw new MalformedJsonArrayError('unterminated value in object member');
      }
      const code = buf.charCodeAt(pos);
      if (inString) {
        if (escaped) escaped = false;
        else if (code === CODE_BACKSLASH) escaped = true;
        else if (code === CODE_QUOTE) {
          inString = false;
          if (depth === 0) primSeen = true;
        }
        pos++;
        continue;
      }
      if (depth > 0) {
        if (code === CODE_QUOTE) inString = true;
        else if (code === CODE_OPEN_BRACE || code === CODE_OPEN_BRACKET) depth++;
        else if (code === CODE_CLOSE_BRACE || code === CODE_CLOSE_BRACKET) {
          depth--;
          if (depth === 0) primSeen = true;
        }
        pos++;
        continue;
      }
      // depth 0, not in string: value = string | primitive
      if (code === CODE_QUOTE) {
        pos++;
        inString = true;
        continue;
      }
      if (PRIMITIVE_CHARS.has(buf[pos]!)) {
        primSeen = true;
        pos++;
        continue;
      }
      if (code === CODE_OPEN_BRACE || code === CODE_OPEN_BRACKET) {
        depth++;
        pos++;
        continue;
      }
      // terminator — do not consume ','/'}'
      if (!primSeen && !isWhitespace(code)) {
        throw new MalformedJsonArrayError(`unexpected character "${buf[pos]}" skipping object member`);
      }
      if (isWhitespace(code)) {
        pos++;
        if (!primSeen) continue;
        continue;
      }
      return;
    }
  };

  // Envelope: '{' then repeated "key" ':' value separated by ','.
  let code = await skipWs();
  if (code !== CODE_OPEN_BRACE) {
    throw new MalformedJsonArrayError(`expected '{' at offset ${pos}`);
  }
  pos++;
  for (;;) {
    code = await skipWs();
    if (code === CODE_CLOSE_BRACE) {
      return; // member absent — caller reports the format error
    }
    if (code !== CODE_QUOTE) {
      throw new MalformedJsonArrayError(`expected member key at offset ${pos}`);
    }
    const keySlice = await readString();
    let key: string;
    try {
      key = JSON.parse(keySlice) as string;
    } catch (e) {
      throw new MalformedJsonArrayError('invalid member key');
    }
    code = await skipWs();
    if (code !== 0x3a /* ':' */) {
      throw new MalformedJsonArrayError(`expected ':' at offset ${pos}`);
    }
    pos++;
    if (key === member) {
      options?.onFound?.();
      // Hand the remainder of the stream to the array element scanner.
      const rest = (async function* (): AsyncGenerator<string> {
        if (pos < buf.length) yield buf.slice(pos);
        for (;;) {
          const next = await it.next();
          if (next.done) return;
          yield next.value;
        }
      })();
      yield* iterJsonArrayElements(rest, { ...options, allowTrailing: true });
      return;
    }
    await skipValue();
    code = await skipWs();
    if (code === CODE_COMMA) {
      pos++;
      continue;
    }
    if (code === CODE_CLOSE_BRACE) return;
    throw new MalformedJsonArrayError(`expected ',' or '}' at offset ${pos}`);
  }
}
