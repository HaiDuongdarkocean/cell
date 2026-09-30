import type { LookupResult } from '@/entities/dictionary';

const ENTRY_SEPARATOR_RE = /\n\s*---\s*\n/;
const OTHER_FORMS_RE = /^Other forms:/i;

export interface DefEntryInput {
  readonly term: string;
  readonly reading?: string;
  readonly frequencyStars?: number;
  readonly otherForms?: string;
  /** Pre-formatted `•` bullet block (formatDefinitions output). */
  readonly senses: string;
}

export interface ParsedDefEntry {
  readonly header: string;
  readonly otherForms: string;
  readonly senses: string;
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/**
 * One dictionary entry inside the `def` field:
 *   Term (reading) ★★★
 *   Other forms: form1, form2
 *   • (pos) sense
 * Multiple entries are joined by `\n---\n`.
 */
export function formatDefEntry(entry: DefEntryInput): string {
  const head = [
    capitalize(entry.term.trim()),
    entry.reading ? `(${entry.reading})` : '',
    entry.frequencyStars ? '★'.repeat(Math.min(3, Math.max(1, entry.frequencyStars))) : '',
  ].filter(Boolean).join(' ');
  const senses = entry.senses
    .split('\n')
    .map((l) => l.replace(/^·\s*/, '').trimEnd())
    .join('\n')
    .trim();
  const lines = [head];
  if (entry.otherForms?.trim()) lines.push(`Other forms: ${entry.otherForms.trim()}`);
  if (senses) lines.push(senses);
  return lines.join('\n');
}

export function joinDefEntries(entries: readonly string[]): string {
  return entries.map((e) => e.trim()).filter(Boolean).join('\n---\n');
}

/** Build a normalized entry header+body from a dictionary lookup result. */
export function formatDefFromLookup(result: LookupResult, senses: string, fallbackTerm?: string): string {
  return formatDefEntry({
    term: result.term || fallbackTerm || '',
    reading: result.reading,
    frequencyStars: result.frequencyStars,
    otherForms: result.inflections?.flatMap((g) => g.forms).join(', '),
    senses,
  });
}

/** Parse a `def` field back into per-term blocks for rendering. Plain text
 *  without `---` or a header line degrades to a single entry with empty
 *  header. */
export function parseDefEntries(text: string): readonly ParsedDefEntry[] {
  return text
    .split(ENTRY_SEPARATOR_RE)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const hasHeader = lines.length > 1 && !lines[0]!.startsWith('•') && !OTHER_FORMS_RE.test(lines[0]!);
      const otherForms = lines.find((l) => OTHER_FORMS_RE.test(l)) ?? '';
      const senses = lines
        .slice(hasHeader ? 1 : 0)
        .filter((l) => !OTHER_FORMS_RE.test(l))
        .join('\n');
      return { header: hasHeader ? lines[0]! : '', otherForms, senses };
    })
    .filter((e) => e.header || e.senses || e.otherForms);
}
