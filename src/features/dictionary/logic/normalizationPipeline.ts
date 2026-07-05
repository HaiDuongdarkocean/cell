// normalizationPipeline — processWord: trim, NFC, lowercase, backwardTerm (ADR-023, spec F9).
//
// Pure functions, content-script-safe. Applied to every entry before storage.

/** Normalize a word: trim whitespace, NFC normalize, lowercase. */
export function normalizeWord(word: string): string {
  return word.trim().normalize('NFC').toLowerCase();
}

/** Normalize a term for storage (same as normalizeWord). */
export function normalizeTerm(term: string): string {
  return normalizeWord(term);
}

/** Normalize a reading (keep case for readings that may have capital letters). */
export function normalizeReading(reading: string): string {
  return reading.trim().normalize('NFC');
}

/** Normalize a definition (trim, NFC, collapse whitespace). */
export function normalizeDefinition(definition: string): string {
  return definition.trim().normalize('NFC').replace(/\s+/g, ' ');
}

/** Full normalization pipeline for a frequency entry. */
export function processFrequencyEntry(
  term: string,
  reading: string,
  frequency: number,
): { term: string; reading: string; frequency: number } {
  return {
    term: normalizeTerm(term),
    reading: normalizeReading(reading) || normalizeTerm(term),
    frequency: Math.max(0, Math.floor(frequency)),
  };
}

/** Full normalization pipeline for a dictionary entry. */
export function processDictionaryEntry(entry: {
  term: string;
  altterm: string;
  pronunciation: string;
  definition: string;
  pos: string;
  examples: string;
  audio: string;
}): { term: string; altterm: string; pronunciation: string; definition: string; pos: string; examples: string; audio: string } {
  return {
    term: normalizeTerm(entry.term),
    altterm: normalizeTerm(entry.altterm),
    pronunciation: entry.pronunciation.trim().normalize('NFC'),
    definition: normalizeDefinition(entry.definition),
    pos: entry.pos.trim().normalize('NFC'),
    examples: entry.examples.trim().normalize('NFC'),
    audio: entry.audio.trim(),
  };
}

/** Check if a word is valid (non-empty after normalization). */
export function isValidWord(word: string): boolean {
  return normalizeWord(word).length > 0;
}
