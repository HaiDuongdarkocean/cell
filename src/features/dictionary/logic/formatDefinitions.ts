const DEF_MARKER_RE = /^(?:\s*•\s*)+/;
const EXAMPLE_MARKER_RE = /^(?:\s*[-•·]\s+)+/;
const LEGACY_EXAMPLE_LINE_RE = /^·\s?/;
const EXAMPLE_LINE_RE = /^-\s/;
const LEGACY_DEF_LINE_RE = /^•\s*/;

function bracketize(token: string): string {
  const t = token.trim();
  return /^[[(]/.test(t) ? t : `[${t}]`;
}

interface RelationGroupLike {
  readonly label?: string;
  readonly words: readonly string[];
}

interface SubsenseLike {
  readonly num?: string;
  readonly text: string;
  readonly labels?: readonly string[];
  readonly synonymGroups?: readonly RelationGroupLike[];
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
  readonly selectedExamples?: readonly string[];
}

function relationLines(s: {
  readonly synonymGroups?: readonly RelationGroupLike[];
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
}): string[] {
  const groups = s.synonymGroups?.length
    ? s.synonymGroups
    : (s.synonyms?.length ? [{ words: s.synonyms }] : []);
  return [
    ...groups.map(
      (g) => `synonyms and related words: ${g.label ? `${g.label}: ` : ''}${g.words.join(', ')}`,
    ),
    ...(s.antonyms?.length ? [`antonyms: ${s.antonyms.join(', ')}`] : []),
  ];
}

function exampleLines(examples: readonly string[] | undefined): string[] {
  return (examples ?? []).map((ex) => `- ${ex.replace(EXAMPLE_MARKER_RE, '')}`.trim());
}

/** Format selected definitions for Card Creator / Quick Add:
 *  - Each definition: `[pos] [label]… [level] {text}` — meta tokens are
 *    bracketed; a bare `{text}` is emitted when the sense has no meta.
 *  - Each ticked example: `- {text}` right under its own definition
 *  - Per-sense relations as lowercase canonical markers —
 *    `synonyms and related words: {label}: a, b` / `antonyms: c` — so the
 *    system can locate and auto-look-up the related terms.
 *  - Each selected subsense: `{num}. {text}` with its own examples and
 *    relations nested under it; a subsense pick ships its parent as
 *    context, never a merged gloss.
 *  - Definitions separated by exactly one blank line (\n\n)
 *  Respects user selection — only checked definitions/subsenses are
 *  included. `selectedExamples` is the opt-in selection field; raw
 *  dictionary example lists are never emitted implicitly.
 *  Strips any leading `•`/`·`/`-` markers already present in the source text
 *  so the output never doubles a marker. */
export function formatDefinitions(defs: readonly {
  readonly pos?: string;
  readonly labels?: readonly string[];
  readonly level?: string;
  readonly text: string;
  readonly subsenses?: readonly SubsenseLike[];
  readonly synonymGroups?: readonly RelationGroupLike[];
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
  readonly selectedExamples?: readonly string[];
}[]): string {
  return defs
    .map((d) => {
      const text = d.text.replace(DEF_MARKER_RE, '');
      const meta = [
        ...(d.pos?.trim() ? [d.pos] : []),
        ...(d.labels ?? []),
        ...(d.level?.trim() ? [d.level] : []),
      ]
        .map(bracketize)
        .join(' ');
      const head = `${meta ? `${meta} ` : ''}${text}`.trim();
      const lines = [
        head,
        ...exampleLines(d.selectedExamples),
        ...relationLines(d),
        ...(d.subsenses ?? []).flatMap((s) => [
          `${s.num ? `${s.num}. ` : ''}${s.labels?.length ? `${s.labels.map(bracketize).join(' ')} ` : ''}${s.text}`.trim(),
          ...exampleLines(s.selectedExamples),
          ...relationLines(s),
        ]),
      ];
      return lines.join('\n');
    })
    .join('\n\n')
    .trim();
}

/** Inverse of {@link formatDefinitions}: parse a definition block back into
 *  entries. `- `/`· `-prefixed lines attach to the preceding definition's
 *  `selectedExamples`; legacy `• `-prefixed lines start a new entry; blank
 *  lines separate entries; any other line continues the current entry's
 *  text (multi-line glosses, `Synonyms:`/`Opposite:` lines). An orphan
 *  example line (no preceding entry) degrades to a plain definition. */
export function parseDefinitionsText(
  text: string,
): { text: string; selectedExamples: string[] }[] {
  const entries: { text: string; selectedExamples: string[] }[] = [];
  let atBoundary = true;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      atBoundary = true;
      continue;
    }
    const last = entries[entries.length - 1];
    if (line.startsWith('•')) {
      entries.push({ text: line.replace(LEGACY_DEF_LINE_RE, ''), selectedExamples: [] });
    } else if (EXAMPLE_LINE_RE.test(line) || LEGACY_EXAMPLE_LINE_RE.test(line)) {
      const example = line.replace(EXAMPLE_MARKER_RE, '');
      if (last && !atBoundary) last.selectedExamples.push(example);
      else entries.push({ text: example, selectedExamples: [] });
    } else if (last && !atBoundary) {
      last.text += `\n${line}`;
    } else {
      entries.push({ text: line, selectedExamples: [] });
    }
    atBoundary = false;
  }
  return entries;
}
