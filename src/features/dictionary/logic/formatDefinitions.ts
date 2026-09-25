const BULLET_PREFIX_RE = /^(?:\s*•\s*)+/;
const EXAMPLE_PREFIX_RE = /^(?:\s*[•·]\s*)+/;

/** Format selected definitions for Card Creator / Quick Add:
 *  - Each definition: `• {pos} {text}` (or `• {text}` if no pos)
 *  - Each ticked example: `· {text}` on its own line under its definition
 *  - Definitions separated by exactly one blank line (\n\n)
 *  Respects user selection — only checked definitions are included.
 *  `selectedExamples` is the opt-in selection field; raw dictionary example
 *  lists (`DefinitionEntry.examples`) are never emitted implicitly.
 *  Strips any leading `•`/`·` markers already present in the source text so
 *  the output always has exactly one marker. */
export function formatDefinitions(defs: readonly {
  readonly pos?: string;
  readonly text: string;
  readonly selectedExamples?: readonly string[];
}[]): string {
  return defs
    .map((d) => {
      const text = d.text.replace(BULLET_PREFIX_RE, '');
      const head = `• ${d.pos ? `${d.pos} ` : ''}${text}`.trim();
      const examples = (d.selectedExamples ?? []).map(
        (ex) => `· ${ex.replace(EXAMPLE_PREFIX_RE, '')}`.trim(),
      );
      return [head, ...examples].join('\n');
    })
    .join('\n\n')
    .trim();
}

/** Inverse of {@link formatDefinitions}: parse a `•`/`·` block back into
 *  entries. `·` lines attach to the preceding definition's
 *  `selectedExamples`; an orphan `·` line (no preceding `•`) degrades to a
 *  plain definition entry. */
export function parseDefinitionsText(
  text: string,
): { text: string; selectedExamples: string[] }[] {
  const entries: { text: string; selectedExamples: string[] }[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const last = entries[entries.length - 1];
    if (line.startsWith('·')) {
      const example = line.replace(EXAMPLE_PREFIX_RE, '');
      if (last) last.selectedExamples.push(example);
      else entries.push({ text: example, selectedExamples: [] });
    } else {
      entries.push({ text: line, selectedExamples: [] });
    }
  }
  return entries;
}
