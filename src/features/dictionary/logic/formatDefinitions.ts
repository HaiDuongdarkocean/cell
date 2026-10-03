const DEF_MARKER_RE = /^(?:\s*•\s*)+/;
const EXAMPLE_MARKER_RE = /^(?:\s*[-•·]\s+)+/;
const LEGACY_EXAMPLE_LINE_RE = /^·\s?/;
const EXAMPLE_LINE_RE = /^-\s/;
const LEGACY_DEF_LINE_RE = /^•\s*/;

function bracketize(token: string): string {
  const t = token.trim();
  return /^[[(]/.test(t) ? t : `[${t}]`;
}

/** Format selected definitions for Card Creator / Quick Add:
 *  - Each definition: `[pos] [label]… [level] {text}` — meta tokens are
 *    bracketed; a bare `{text}` is emitted when the sense has no meta.
 *  - Each subsense: `{num}. {text}` (keyboard-native `a.`/`1.` numbering)
 *  - Each ticked example: `- {text}` on its own line under its definition
 *  - Per-sense relations: `Synonyms: a, b` / `Opposite: c`
 *  - Definitions separated by exactly one blank line (\n\n)
 *  Respects user selection — only checked definitions are included.
 *  `selectedExamples` is the opt-in selection field; raw dictionary example
 *  lists (`DefinitionEntry.examples`) are never emitted implicitly.
 *  Strips any leading `•`/`·`/`-` markers already present in the source text
 *  so the output never doubles a marker. */
export function formatDefinitions(defs: readonly {
  readonly pos?: string;
  readonly labels?: readonly string[];
  readonly level?: string;
  readonly text: string;
  readonly subsenses?: readonly { readonly num: string; readonly text: string }[];
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
        ...(d.subsenses ?? []).map((s) => `${s.num}. ${s.text}`),
        ...(d.selectedExamples ?? []).map(
          (ex) => `- ${ex.replace(EXAMPLE_MARKER_RE, '')}`.trim(),
        ),
      ];
      if (d.synonyms?.length) lines.push(`Synonyms: ${d.synonyms.join(', ')}`);
      if (d.antonyms?.length) lines.push(`Opposite: ${d.antonyms.join(', ')}`);
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
