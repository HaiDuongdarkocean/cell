/**
 * Lingvo DSL (.dsl) audio parser.
 *
 * Extracts headword -> audio file path mappings from a Lingvo DSL dictionary.
 * Assumes the conventional entry shape where the headword itself is the opening
 * tag:
 *
 *   [hello]
 *     [m] ... [s]audio.mp3[/s] ... [/m]
 *   [/hello]
 *
 * Tolerant of unknown inner tags and missing sections — any `[s]...[/s]`
 * inside an entry is collected as an audio path.
 *
 * ponytail: loads the entire `.dsl` text into memory. For a ~38 MB index this
 * is fine in MVP; replace with a streaming TextDecoder if packages grow > 50 MB.
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

const TAG_OPEN_RE = /^\[([^\]\s]+)\]\s*$/;
const TAG_CLOSE_RE = /^\[\/([^\]\s]+)\]\s*$/;
const SOUND_TAG_RE = /\[s\]([^[\]]+)\[\/s\]/g;

/** Normalize a headword for lookup: NFC, lowercase, trim whitespace. */
function normalizeTerm(term: string): string {
  return term.normalize('NFC').trim().toLowerCase();
}

/** Parse a raw `.dsl` string into index entries. */
export function parseLingvoDsl(text: string, packageId: string): LingvoDslIndexEntry[] {
  const entries: LingvoDslIndexEntry[] = [];
  const lines = text.split(/\r?\n/);

  let currentHeadword: string | null = null;
  let currentBuffer = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Header / directive lines appear outside entries.
    if (line.startsWith('#')) continue;

    const openMatch: RegExpExecArray | null = !currentHeadword ? TAG_OPEN_RE.exec(line) : null;
    if (openMatch) {
      currentHeadword = openMatch[1];
      currentBuffer = '';
      continue;
    }

    const closeMatch: RegExpExecArray | null = currentHeadword ? TAG_CLOSE_RE.exec(line) : null;
    if (closeMatch && currentHeadword && closeMatch[1] === currentHeadword) {
      const audioPaths = extractAudioPaths(currentBuffer);
      if (audioPaths.length > 0) {
        const term = normalizeTerm(currentHeadword);
        entries.push({
          id: `${packageId}:${term}`,
          packageId,
          term,
          audioPaths,
        });
      }
      currentHeadword = null;
      currentBuffer = '';
      continue;
    }

    if (currentHeadword) {
      currentBuffer += `${line}\n`;
    }
  }

  // Flush any dangling entry.
  if (currentHeadword) {
    const audioPaths = extractAudioPaths(currentBuffer);
    if (audioPaths.length > 0) {
      const term = normalizeTerm(currentHeadword);
      entries.push({
        id: `${packageId}:${term}`,
        packageId,
        term,
        audioPaths,
      });
    }
  }

  return entries;
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
