import type {
  InflectionGroup,
  LookupResult,
  ReadingKind,
  RelatedEntry,
  WordFamily,
  WordNetInfo,
} from '@/entities/dictionary';

const ENTRY_SEPARATOR_RE = /\n\s*---\s*\n/;
const OTHER_FORMS_RE = /^Other forms:/i;
const META_LINE_RE =
  /^(word family|synset|hypernyms|derived terms|phrases|idioms|phrasal verbs|collocations|thesaurus|lemmas|derivatives):/i;
const NON_HEADER_LINE_RE = /^[[\-•·]/;

const RELATED_KIND_LABELS: Record<string, string> = {
  phrasal: 'phrasal verbs',
  idiom: 'idioms',
  collocation: 'collocations',
  expression: 'phrases',
  lemma: 'lemmas',
  derivative: 'derivatives',
  thesaurus: 'thesaurus',
};

export type FrequencyDisplay = 'stars' | 'rank';

export interface DefEntryInput {
  readonly term: string;
  readonly reading?: string;
  readonly readingKind?: ReadingKind;
  readonly frequencyStars?: number;
  /** Per-list frequency — rendered `[source:rank]` in the header. */
  readonly frequencies?: readonly { readonly rank: number; readonly source: string }[];
  readonly frequencyFormat?: FrequencyDisplay;
  /** Inflection groups — `type forms | type forms`, flat list when untyped. */
  readonly inflections?: readonly InflectionGroup[];
  /** formatDefinitions output — `[pos]`-headed senses, `-` example lines. */
  readonly senses: string;
  readonly wordFamily?: WordFamily;
  readonly wordNet?: WordNetInfo;
  readonly derivedTerms?: readonly string[];
  readonly related?: readonly RelatedEntry[];
}

export interface ParsedDefEntry {
  readonly header: string;
  readonly otherForms: string;
  readonly senses: string;
  readonly meta: string;
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function formatReading(reading: string | undefined, kind: ReadingKind | undefined): string {
  const r = reading?.trim() ?? '';
  if (!r || kind !== 'ipa') return r;
  if ((r.startsWith('/') && r.endsWith('/')) || (r.startsWith('[') && r.endsWith(']'))) return r;
  return `/${r}/`;
}

function formatInflections(inflections: readonly InflectionGroup[]): string {
  const typed = inflections.some((g) => g.type);
  if (!typed) return inflections.flatMap((g) => g.forms).join(', ');
  return inflections
    .map((g) => `${g.type ? `${g.type} ` : ''}${g.forms.join(', ')}`.trim())
    .filter(Boolean)
    .join(' | ');
}

function metaLines(input: DefEntryInput): string[] {
  const lines: string[] = [];
  const wf = input.wordFamily;
  if (wf) {
    const parts = (
      [
        ['noun', wf.nouns],
        ['verb', wf.verbs],
        ['adjective', wf.adjectives],
        ['adverb', wf.adverbs],
      ] as const
    )
      .filter(([, forms]) => forms?.length)
      .map(([pos, forms]) => `${pos} ${forms!.join(', ')}`);
    if (parts.length) lines.push(`word family: ${parts.join(' | ')}`);
  }
  if (input.wordNet?.synset?.length) lines.push(`synset: ${input.wordNet.synset.join(', ')}`);
  if (input.wordNet?.hypernyms?.length) {
    lines.push(`hypernyms: ${input.wordNet.hypernyms.join(', ')}`);
  }
  if (input.derivedTerms?.length) lines.push(`derived terms: ${input.derivedTerms.join(', ')}`);
  if (input.related?.length) {
    const groups = new Map<string, string[]>();
    for (const r of input.related) {
      const list = groups.get(r.kind) ?? [];
      list.push(r.term);
      groups.set(r.kind, list);
    }
    for (const [kind, terms] of groups) {
      lines.push(`${RELATED_KIND_LABELS[kind] ?? `${kind}s`}: ${terms.join(', ')}`);
    }
  }
  return lines;
}

/**
 * One dictionary entry inside the `def` field:
 *   Term reading ★★★ [source:rank]
 *   Other forms: type form, form | type form
 *   <blank>
 *   [pos] [label] sense
 *   - example
 *   <blank>
 *   word family: noun a, b | verb c
 *   phrasal verbs: x, y
 * Multiple entries are joined by `\n---\n`.
 */
export function formatDefEntry(entry: DefEntryInput): string {
  const starCount = entry.frequencyStars ? Math.min(5, Math.max(1, entry.frequencyStars)) : 0;
  const stars = starCount ? '★'.repeat(starCount) + '☆'.repeat(5 - starCount) : '';
  const ranks = (entry.frequencies ?? []).map((f) => `[${f.source}:${f.rank}]`).join(' ');
  const freq = entry.frequencyFormat === 'rank' ? ranks || stars : stars;
  const head = [capitalize(entry.term.trim()), formatReading(entry.reading, entry.readingKind), freq]
    .filter(Boolean)
    .join(' ');
  const meta = metaLines(entry);
  const metaSet = new Set(meta);
  const senses = entry.senses
    .split('\n')
    .map((l) => {
      const line = l.trim();
      if (line.startsWith('·')) return `- ${line.replace(/^·\s*/, '')}`;
      return line.replace(/^•\s*/, '');
    })
    .filter((l) => !metaSet.has(l))
    .join('\n')
    .trim();
  const headBlock = [head];
  if (entry.inflections?.length) {
    headBlock.push(`Other forms: ${formatInflections(entry.inflections)}`);
  }
  return [headBlock.join('\n'), senses, meta.join('\n')].filter(Boolean).join('\n\n');
}

export function joinDefEntries(entries: readonly string[]): string {
  return entries.map((e) => e.trim()).filter(Boolean).join('\n---\n');
}

/** Build a normalized entry from a dictionary lookup result — header,
 *  inflections and meta sections all flow from the result; `senses` is the
 *  pre-formatted selected-definitions block. */
export function formatDefFromLookup(
  result: LookupResult,
  senses: string,
  fallbackTerm?: string,
  frequencyFormat?: FrequencyDisplay,
): string {
  return formatDefEntry({
    term: result.term || fallbackTerm || '',
    reading: result.reading,
    readingKind: result.readingKind,
    frequencyStars: result.frequencyStars?.count,
    frequencies: result.frequencies,
    frequencyFormat,
    inflections: result.inflections,
    senses,
    wordFamily: result.wordFamily,
    wordNet: result.wordNet,
    derivedTerms: result.derivedTerms,
    related: result.related,
  });
}

/** Parse a `def` field back into per-term blocks for rendering. Plain text
 *  without `---` or a header line degrades to a single entry with empty
 *  header. `- `/`· `-lines are examples; `[`-headed and meta lines stay in
 *  the senses/meta blocks. */
export function parseDefEntries(text: string): readonly ParsedDefEntry[] {
  return text
    .split(ENTRY_SEPARATOR_RE)
    .map((block) => {
      const raw = block.split('\n').map((l) => l.trim());
      let start = 0;
      let end = raw.length;
      while (start < end && !raw[start]) start++;
      while (end > start && !raw[end - 1]) end--;
      const lines = raw.slice(start, end);
      const first = lines[0] ?? '';
      const hasHeader =
        lines.length > 1 &&
        !NON_HEADER_LINE_RE.test(first) &&
        !OTHER_FORMS_RE.test(first) &&
        !META_LINE_RE.test(first);
      const otherForms = lines.find((l) => OTHER_FORMS_RE.test(l)) ?? '';
      const senses: string[] = [];
      const meta: string[] = [];
      for (const l of lines.slice(hasHeader ? 1 : 0)) {
        if (OTHER_FORMS_RE.test(l)) continue;
        (META_LINE_RE.test(l) ? meta : senses).push(l);
      }
      while (senses.length && !senses[senses.length - 1]) senses.pop();
      while (senses.length && !senses[0]) senses.shift();
      return {
        header: hasHeader ? first : '',
        otherForms,
        senses: senses.join('\n'),
        meta: meta.join('\n'),
      };
    })
    .filter((e) => e.header || e.senses || e.otherForms || e.meta);
}
