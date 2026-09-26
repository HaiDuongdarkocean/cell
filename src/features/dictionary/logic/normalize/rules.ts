// rules — shape detectors for toCanonicalDefinition.
//
// Each rule inspects the CONTENT SHAPE of a raw entry (never the declared
// import format — rules must not name or gate on a specific source product)
// and returns a ParsedDefinition when it confidently recognizes structure,
// or null to pass to the next rule. Rules are ordered most-structured →
// least-structured; adding a new source shape = append one rule, existing
// rules stay untouched.
//
// Contract: only confident structure becomes senses. Unrecognized input
// reaches `verbatim` and stays a single def — the popup splitter never sees
// an invented boundary ("not canonical → not split").

import type { RawDictionaryEntry } from '../../strategies/baseImportStrategy';
import type { SenseBlock, SenseLine } from '@/entities/dictionary';

export interface ParsedDefinition {
  readonly senses: readonly SenseBlock[];
  /** Entry-level POS override detected from the source shape. */
  readonly pos?: string;
}

export type DefinitionRule = (raw: RawDictionaryEntry) => ParsedDefinition | null;

const BREAK_RE = /<br\s*\/?>|\r?\n/i;
const BREAK_SPLIT_RE = /<br\s*\/?>|\r?\n/gi;
const EXAMPLE_MARKER_RE = /^[·•]\s*/;
const NOTE_RE = /^\([\s\S]*\)$/;
const TRANSLATION_SEP_RE = /\s—\s/;

/** Split `target — native` on the FIRST spaced em-dash; both sides must be
 *  non-empty. No match → the whole string is `text` (no revealable part). */
function splitTranslation(text: string): Pick<SenseLine, 'text' | 'translation'> {
  const i = text.search(TRANSLATION_SEP_RE);
  if (i <= 0) return { text };
  const head = text.slice(0, i).trim();
  const tail = text.slice(i + 3).trim();
  if (!head || !tail) return { text };
  return { text: head, translation: tail };
}

/** Classify one raw line into a SenseLine. Returns null for empty lines. */
export function classifyLine(raw: string): SenseLine | null {
  const line = raw.trim().replace(/^\d+\.(?!\d)\s*/, '');
  if (!line) return null;
  if (EXAMPLE_MARKER_RE.test(line)) {
    const body = line.replace(EXAMPLE_MARKER_RE, '').trim();
    if (!body) return null;
    return { role: 'example', ...splitTranslation(body) };
  }
  if (NOTE_RE.test(line)) return { role: 'note', text: line };
  return { role: 'gloss', ...splitTranslation(line) };
}

/** Serialize a SenseLine back to canonical display form
 *  (`· text [pattern] — translation (citation)`). Shared by the definition
 *  serializer and the lookup layer building `DefinitionEntry.text` for
 *  legacy consumers. */
export function lineToCanonicalText(line: SenseLine): string {
  let body = line.pattern ? `${line.text} ${line.pattern}` : line.text;
  if (line.translation) body += ` — ${line.translation}`;
  if (line.citation) body += ` (${line.citation})`;
  return line.role === 'example' ? `· ${body}` : body;
}

function classifyLines(rawLines: readonly string[]): SenseLine[] {
  const out: SenseLine[] = [];
  for (const raw of rawLines) {
    const line = classifyLine(raw);
    if (line) out.push(line);
  }
  return out;
}

/** `N.` marker lines carry the pos label as their first content line —
 *  but only when the sense has at least one more line (a single-line sense
 *  like `1.to suddenly start` is gloss, not a label). */
function splitMarkerSense(firstLine: string, restLines: readonly string[]): SenseBlock {
  const first = firstLine.trim();
  const rest = restLines.map((l) => l.trim()).filter(Boolean);
  if (first && rest.length > 0 && !EXAMPLE_MARKER_RE.test(first) && !NOTE_RE.test(first)) {
    return { pos: first, lines: classifyLines(rest) };
  }
  return { lines: classifyLines([first, ...rest]) };
}

/** `[headword, [tag, …]]` inflection-redirect element (list-shaped sources). */
function isHeadwordRef(item: unknown): item is [string, unknown[]] {
  return (
    Array.isArray(item) &&
    typeof item[0] === 'string' &&
    Array.isArray(item[1])
  );
}

/** Entry already carries structured senses (pre-normalized file). Trust and
 *  pass through — normalization is idempotent by construction. */
export const preNormalized: DefinitionRule = (raw) => {
  if (!Array.isArray(raw.senses) || raw.senses.length === 0) return null;
  return { senses: raw.senses, pos: raw.pos || undefined };
};

/**
 * Source provides definitions as a LIST of elements (one element = one
 * sense). Elements may be plain gloss strings or headword redirects.
 * Unknown element shapes are dropped — a rule added later can claim them.
 */
export const listDefinitions: DefinitionRule = (raw) => {
  if (!Array.isArray(raw.definitions)) return null;

  const items = raw.definitions;
  if (items.length > 0 && items.every(isHeadwordRef)) {
    const [headword, tags] = items[0]!;
    const tagList = (tags as unknown[]).filter((t): t is string => typeof t === 'string');
    return {
      senses: [{ lines: [{ role: 'note', text: `→ ${headword}` }] }],
      pos: tagList.join(' ') || undefined,
    };
  }

  const senses: SenseBlock[] = [];
  for (const item of items) {
    if (typeof item === 'string' && item.trim()) {
      senses.push({ lines: classifyLines(item.split(BREAK_SPLIT_RE)) });
    } else if (isHeadwordRef(item)) {
      senses.push({ lines: [{ role: 'note', text: `→ ${item[0]}` }] });
    }
  }
  return senses.length > 0 ? { senses } : null;
};

/**
 * Definition text carries numbered sense markers `N.` at line starts,
 * separated by break markup (`<br>` family or real newlines). Requires ≥2
 * markers — a lone marker proves nothing. `N.` must not be followed by
 * another digit, so decimals ("1.5 kg", "2.2 m") never count as markers.
 * Numbering need not be contiguous; each marker line starts a new sense.
 */
export const numberedLineMarkup: DefinitionRule = (raw) => {
  const text = typeof raw.definition === 'string' ? raw.definition : '';
  if (!BREAK_RE.test(text)) return null;

  const lines = text.split(BREAK_SPLIT_RE).map((l) => l.trim());
  const markerIdx = lines
    .map((l, i) => (/^\d+\.(?!\d)/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  if (markerIdx.length < 2) return null;

  const preamble = lines.slice(0, markerIdx[0]).filter(Boolean);
  const senses: SenseBlock[] = markerIdx.map((start, k) => {
    const end = markerIdx[k + 1] ?? lines.length;
    const rest = [
      ...(k === 0 ? preamble : []),
      ...lines.slice(start + 1, end),
    ];
    return splitMarkerSense(lines[start]!.replace(/^\d+\./, ''), rest);
  });
  return { senses };
};

/**
 * Fallback — matches any non-empty definition. The definition stays ONE
 * sense: lines are classified (`·` examples, `—` pairs) for rendering, but
 * no sense boundary is ever invented. This is the fail-safe the whole
 * pipeline relies on: unrecognized input does not split in the popup.
 * Empty definitions return null — metadata-only entries (etymology without
 * senses) must not produce a phantom empty sense.
 */
export const verbatim: DefinitionRule = (raw) => {
  const text = typeof raw.definition === 'string' ? raw.definition : '';
  if (!text.trim()) return null;
  const lines = classifyLines(text.split(BREAK_SPLIT_RE));
  return { senses: [{ lines }] };
};
