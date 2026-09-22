// JSON entry-array reader — the canonical json-entries shape (or any
// entry-object array; the canonical normalizer downstream decides splits).

export function* iterJsonEntries(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('expected a JSON array of entries');
  for (const e of parsed) {
    if (!e || typeof e !== 'object' || !e.term) continue;
    yield {
      term: e.term,
      reading: e.reading ?? e.altterm ?? '',
      altterm: e.altterm ?? '',
      pronunciation: e.pronunciation ?? '',
      definition: e.definition ?? '',
      senses: Array.isArray(e.senses) ? e.senses : undefined,
      pos: e.pos ?? '',
      examples: e.examples ?? '',
      audio: e.audio ?? '',
      related: Array.isArray(e.related) ? e.related : undefined,
      inflections: Array.isArray(e.inflections) ? e.inflections : undefined,
      level: e.level,
      etymology: e.etymology,
      wordFamily: e.wordFamily,
      wordNet: e.wordNet,
      derivedTerms: Array.isArray(e.derivedTerms) ? e.derivedTerms : undefined,
      usageNote: e.usageNote,
    };
  }
}
