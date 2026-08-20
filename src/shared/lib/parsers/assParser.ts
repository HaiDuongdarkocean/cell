import type {
  AssDialogue,
  AssStyle,
  AssSubtitle,
} from '@/entities/media';

/**
 * Parse a single ASS timing token of the form H:MM:SS.cc (centiseconds)
 * into milliseconds. Returns `null` when the token is malformed.
 *
 * Examples:
 *   "0:00:01.00" -> 1000
 *   "0:01:30.50" -> 90500
 *   "1:02:03.04" -> 3723040
 */
function parseAssTime(token: string): number | null {
  const match = /^(\d+):(\d{1,2}):(\d{1,2})\.(\d{1,3})$/.exec(token.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  // Centiseconds may be 1-3 digits; normalize to centiseconds then to ms.
  const centiRaw = match[4];
  const centiseconds =
    Number(centiRaw) * (centiRaw.length === 1 ? 10 : centiRaw.length === 2 ? 1 : 0.1);

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  const ms =
    hours * 60 * 60 * 1000 +
    minutes * 60 * 1000 +
    seconds * 1000 +
    Math.round(centiseconds * 10);

  return ms;
}

/**
 * Split a comma-separated values line while preserving the final field
 * (ASS "Text" / "Effect") which may itself contain commas. The number of
 * fields is determined by the Format line column count.
 */
function splitFields(line: string, columnCount: number): string[] {
  const parts = line.split(',');
  if (parts.length <= columnCount) {
    return parts;
  }
  // Rejoin everything beyond the expected column count into the last field.
  const head = parts.slice(0, columnCount - 1);
  const tail = parts.slice(columnCount - 1).join(',');
  return [...head, tail];
}

function parseSectionHeader(line: string): string | null {
  const match = /^\s*\[(.+)\]\s*$/.exec(line);
  return match ? match[1] : null;
}

function parseScriptInfo(sectionLines: string[]): Record<string, string> {
  const info: Record<string, string> = {};
  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (!key) continue;
    info[key] = value;
  }
  return info;
}

function parseFormatColumns(formatLine: string): string[] {
  const colonIndex = formatLine.indexOf(':');
  if (colonIndex === -1) return [];
  const raw = formatLine.slice(colonIndex + 1).trim();
  return raw.split(',').map((c) => c.trim());
}

function parseStyles(
  sectionLines: string[],
): AssStyle[] {
  let columns: string[] = [];
  const styles: AssStyle[] = [];

  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^Format\s*:/i.test(trimmed)) {
      columns = parseFormatColumns(trimmed);
      continue;
    }

    if (/^Style\s*:/i.test(trimmed)) {
      if (columns.length === 0) continue;

      const colonIndex = trimmed.indexOf(':');
      const rawValues = trimmed.slice(colonIndex + 1);
      const values = splitFields(rawValues, columns.length);

      const indexOf = (name: string): number => columns.indexOf(name);

      const nameIdx = indexOf('Name');
      const fontNameIdx = indexOf('Fontname');
      const fontSizeIdx = indexOf('Fontsize');
      const primaryColorIdx = indexOf('PrimaryColour');
      const alignmentIdx = indexOf('Alignment');

      const get = (idx: number): string =>
        idx >= 0 && idx < values.length ? values[idx].trim() : '';

      const fontSize = Number(get(fontSizeIdx));
      const alignment = Number(get(alignmentIdx));

      // Skip styles missing required numeric fields.
      if (
        nameIdx >= 0 &&
        fontNameIdx >= 0 &&
        fontSizeIdx >= 0 &&
        primaryColorIdx >= 0 &&
        alignmentIdx >= 0 &&
        !Number.isNaN(fontSize) &&
        !Number.isNaN(alignment)
      ) {
        styles.push({
          name: get(nameIdx),
          fontName: get(fontNameIdx),
          fontSize,
          primaryColor: get(primaryColorIdx),
          alignment,
        });
      }
    }
  }

  return styles;
}

function parseDialogues(sectionLines: string[]): AssDialogue[] {
  let columns: string[] = [];
  const dialogues: AssDialogue[] = [];

  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^Format\s*:/i.test(trimmed)) {
      columns = parseFormatColumns(trimmed);
      continue;
    }

    if (/^Dialogue\s*:/i.test(trimmed)) {
      if (columns.length === 0) continue;

      const colonIndex = trimmed.indexOf(':');
      const rawValues = trimmed.slice(colonIndex + 1);
      const values = splitFields(rawValues, columns.length);

      const indexOf = (name: string): number => columns.indexOf(name);

      const layerIdx = indexOf('Layer');
      const startIdx = indexOf('Start');
      const endIdx = indexOf('End');
      const styleIdx = indexOf('Style');
      // ASS spec calls this column "Name", but real-world files (and our
      // collected samples) often label it "Actor". Accept either.
      const nameIdx = Math.max(indexOf('Name'), indexOf('Actor'));
      const textIdx = indexOf('Text');

      if (
        layerIdx < 0 ||
        startIdx < 0 ||
        endIdx < 0 ||
        styleIdx < 0 ||
        nameIdx < 0 ||
        textIdx < 0
      ) {
        continue;
      }

      const get = (idx: number): string =>
        idx < values.length ? values[idx].trim() : '';

      const layer = Number(get(layerIdx));
      const start = parseAssTime(get(startIdx));
      const end = parseAssTime(get(endIdx));

      // Skip malformed dialogues: non-numeric layer or unparseable timing.
      if (Number.isNaN(layer) || start === null || end === null) {
        continue;
      }

      dialogues.push({
        layer,
        start,
        end,
        style: get(styleIdx),
        name: get(nameIdx),
        text: get(textIdx),
      });
    }
  }

  return dialogues;
}

/**
 * Parse Advanced SubStation Alpha (.ass) subtitle content into a structured
 * `AssSubtitle` object. Pure function with no side effects.
 *
 * Throws when the content is empty / whitespace-only.
 */
export function parseAss(content: string): AssSubtitle {
  if (!content || content.trim().length === 0) {
    throw new Error('parseAss: content must not be empty');
  }

  const lines = content.split(/\r?\n/);

  const scriptInfoLines: string[] = [];
  const stylesLines: string[] = [];
  const eventsLines: string[] = [];

  let currentSection: 'scriptInfo' | 'styles' | 'events' | 'none' = 'none';

  for (const line of lines) {
    const header = parseSectionHeader(line);
    if (header !== null) {
      const normalized = header.toLowerCase();
      if (normalized === 'script info') {
        currentSection = 'scriptInfo';
      } else if (normalized === 'v4+ styles' || normalized === 'v4 styles') {
        currentSection = 'styles';
      } else if (normalized === 'events') {
        currentSection = 'events';
      } else {
        currentSection = 'none';
      }
      continue;
    }

    switch (currentSection) {
      case 'scriptInfo':
        scriptInfoLines.push(line);
        break;
      case 'styles':
        stylesLines.push(line);
        break;
      case 'events':
        eventsLines.push(line);
        break;
      case 'none':
        break;
    }
  }

  return {
    scriptInfo: parseScriptInfo(scriptInfoLines),
    styles: parseStyles(stylesLines),
    dialogues: parseDialogues(eventsLines),
  };
}
