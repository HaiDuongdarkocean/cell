/**
 * Lingvo DSL (.dsl) audio parser.
 *
 * Standard Lingvo layout: headword lines start at column 0, card body lines
 * are indented with a space or tab. A card is one or more consecutive
 * headword lines (alternative spellings of the same entry) followed by its
 * indented body:
 *
 *   hello
 *   	[m1][s]en/jessica/hello.mp3[/s] [i]jessica[/i][/m1]
 *
 * Sound references are `[s]path[/s]` tags inside the body. `#` header
 * directives and blank lines carry no card content.
 *
 * ponytail: loads the entire `.dsl` text into memory. For a ~38 MB index this
 * is fine; replace with a streaming TextDecoder if packages grow > 50 MB.
 */

export interface LingvoDslIndexEntry {
  /** Package-scoped entry id (packageId:term). */
  readonly id: string;
  /** Package the entry belongs to. */
  readonly packageId: string;
  /** Headword as it appears in the .dsl file, lowercased for lookup. */
  readonly term: string;
  /** Audio file paths referenced by `[s]` tags in the entry. */
  readonly audioPaths: readonly string[];
}

const DIRECTIVE_RE = /^#[A-Z_]+/;
const BODY_LINE_RE = /^[ \t]/;
const SOUND_TAG_RE = /\[s\]([^[\]]+)\[\/s\]/g;
const ESCAPE_RE = /\\(.)/g;

/** Normalize a headword for lookup: NFC, lowercase, trim whitespace. */
function normalizeTerm(term: string): string {
  return term.normalize('NFC').trim().toLowerCase();
}

/** DSL escapes punctuation in headwords: `\[` `\]` `\(` `\)` `\\` `\~`. */
function unescapeHeadword(raw: string): string {
  return raw.replace(ESCAPE_RE, '$1');
}

/** Parse a raw `.dsl` string into index entries. */
export function parseLingvoDsl(text: string, packageId: string): LingvoDslIndexEntry[] {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const pathsByTerm = new Map<string, Set<string>>();
  let headwords: string[] = [];
  let buffer = '';

  const flush = (): void => {
    const audioPaths = extractAudioPaths(buffer);
    buffer = '';
    if (audioPaths.length > 0) {
      for (const raw of headwords) {
        const term = normalizeTerm(unescapeHeadword(raw));
        if (!term) continue;
        let set = pathsByTerm.get(term);
        if (!set) {
          set = new Set();
          pathsByTerm.set(term, set);
        }
        for (const path of audioPaths) set.add(path);
      }
    }
    headwords = [];
  };

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (DIRECTIVE_RE.test(line)) continue;
    if (BODY_LINE_RE.test(line)) {
      if (headwords.length > 0) buffer += `${line}\n`;
      continue;
    }
    if (buffer !== '') flush();
    headwords.push(line);
  }
  flush();

  return [...pathsByTerm.entries()].map(([term, paths]) => ({
    id: `${packageId}:${term}`,
    packageId,
    term,
    audioPaths: [...paths],
  }));
}

function extractAudioPaths(buffer: string): readonly string[] {
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  SOUND_TAG_RE.lastIndex = 0;
  while ((match = SOUND_TAG_RE.exec(buffer)) !== null) {
    const path = match[1].trim();
    if (path) paths.push(path);
  }
  return paths;
}
