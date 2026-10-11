// jsonObjectScanner — split a top-level JSON array text into per-object
// source slices without materializing the parsed graph.
//
// A 122MB dictionary stays as ONE decoded string; each yielded slice is a
// substring view JSON.parse'd independently, so peak memory is bounded by
// the largest single entry instead of the whole object graph.

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
  ...'0123456789-+.eE', // numbers
  ...'truefalsn', // true / false / null letters
]);

function isTopLevelSeparator(code: number): boolean {
  return (
    code === CODE_COMMA ||
    code === CODE_OPEN_BRACKET ||
    code === CODE_CLOSE_BRACKET ||
    code === CODE_SPACE ||
    code === CODE_TAB ||
    code === CODE_LF ||
    code === CODE_CR
  );
}

export class MalformedJsonArrayError extends Error {}

/**
 * Yield the source text of each top-level `{...}` inside a JSON array.
 * Non-object elements (strings, numbers, literals) are skipped the same way
 * the object loop skips them after parse. Throws MalformedJsonArrayError on
 * characters that cannot appear in a JSON array of entries.
 */
export function* scanTopLevelJsonObjects(text: string): Generator<string, void, void> {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (code === CODE_BACKSLASH) escaped = true;
      else if (code === CODE_QUOTE) inString = false;
      continue;
    }
    if (code === CODE_QUOTE) {
      inString = true;
      continue;
    }
    if (code === CODE_OPEN_BRACE) {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (code === CODE_CLOSE_BRACE) {
      depth--;
      if (depth < 0) throw new MalformedJsonArrayError(`unbalanced "}" at offset ${i}`);
      if (depth === 0) {
        yield text.slice(start, i + 1);
        start = -1;
      }
      continue;
    }
    if (depth === 0 && !isTopLevelSeparator(code) && !PRIMITIVE_CHARS.has(text[i]!)) {
      throw new MalformedJsonArrayError(`unexpected character "${text[i]}" at offset ${i}`);
    }
  }
}
