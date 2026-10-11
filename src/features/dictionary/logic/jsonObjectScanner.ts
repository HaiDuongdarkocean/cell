// jsonObjectScanner — split a top-level JSON array text into per-object
// source slices without materializing the parsed graph.
//
// A 122MB dictionary stays as ONE decoded string; each yielded [start,end)
// range is sliced + JSON.parse'd independently, so peak memory is bounded by
// the largest single entry instead of the whole object graph.
//
// The scan enforces the array envelope (open bracket, commas between
// elements, single closing bracket, no unterminated tail) so malformed
// input fails the same way a whole-file JSON.parse would instead of
// producing a silent partial/empty import.

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

export class MalformedJsonArrayError extends Error {}

type ScanPhase = 'pre' | 'elem' | 'sep' | 'prim' | 'done';

/** Half-open [start, end) offsets of one top-level object in the source text. */
export interface JsonObjectRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Yield the [start, end) range of each top-level `{...}` inside a JSON array.
 * Non-object elements (strings, numbers, literals) are validated then
 * skipped, matching the legacy whole-parse-then-filter behavior.
 * Throws MalformedJsonArrayError when the array envelope is violated
 * (missing comma, trailing content, unbalanced braces, unterminated input).
 */
export function* scanTopLevelJsonObjectRanges(text: string): Generator<JsonObjectRange, void, void> {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  let primStart = -1;
  let phase: ScanPhase = 'pre';
  let elemAfterComma = false;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (code === CODE_BACKSLASH) escaped = true;
      else if (code === CODE_QUOTE) {
        inString = false;
        if (depth === 0) phase = 'sep';
      }
      continue;
    }
    if (depth > 0) {
      if (code === CODE_QUOTE) inString = true;
      else if (code === CODE_OPEN_BRACE) depth++;
      else if (code === CODE_CLOSE_BRACE) {
        depth--;
        if (depth === 0) {
          yield { start, end: i + 1 };
          start = -1;
          phase = 'sep';
        }
      }
      continue;
    }
    switch (phase) {
      case 'pre':
        if (isWhitespace(code)) break;
        if (code !== CODE_OPEN_BRACKET) {
          throw new MalformedJsonArrayError(`expected '[' at offset ${i}`);
        }
        phase = 'elem';
        elemAfterComma = false;
        break;
      case 'elem':
        if (isWhitespace(code)) break;
        if (code === CODE_CLOSE_BRACKET) {
          if (elemAfterComma) {
            throw new MalformedJsonArrayError(`trailing comma before ']' at offset ${i}`);
          }
          phase = 'done';
          break;
        }
        if (code === CODE_QUOTE) {
          inString = true;
          break;
        }
        if (code === CODE_OPEN_BRACE) {
          start = i;
          depth = 1;
          break;
        }
        if (PRIMITIVE_CHARS.has(text[i]!)) {
          primStart = i;
          phase = 'prim';
          break;
        }
        throw new MalformedJsonArrayError(`unexpected character "${text[i]}" at offset ${i}`);
      case 'prim': {
        if (PRIMITIVE_CHARS.has(text[i]!)) break;
        if (!JSON_PRIMITIVE.test(text.slice(primStart, i))) {
          throw new MalformedJsonArrayError(`invalid literal at offset ${primStart}`);
        }
        primStart = -1;
        if (isWhitespace(code)) {
          phase = 'sep';
          break;
        }
        if (code === CODE_COMMA) {
          phase = 'elem';
          elemAfterComma = true;
          break;
        }
        if (code === CODE_CLOSE_BRACKET) {
          phase = 'done';
          break;
        }
        throw new MalformedJsonArrayError(`unexpected character "${text[i]}" at offset ${i}`);
      }
      case 'sep':
        if (isWhitespace(code)) break;
        if (code === CODE_COMMA) {
          phase = 'elem';
          elemAfterComma = true;
          break;
        }
        if (code === CODE_CLOSE_BRACKET) {
          phase = 'done';
          break;
        }
        throw new MalformedJsonArrayError(`expected ',' or ']' at offset ${i}`);
      case 'done':
        if (isWhitespace(code)) break;
        throw new MalformedJsonArrayError(`trailing content at offset ${i}`);
    }
  }

  if (inString || depth !== 0 || phase !== 'done') {
    throw new MalformedJsonArrayError('unterminated JSON array');
  }
}
