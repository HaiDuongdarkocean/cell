// dictionaryComponents — detect which canonical components a dictionary
// resource contains. Runs per stored entry during import and as a lazy
// store scan for resources imported before the field existed; results land
// on ResourceInfo.components and drive the per-resource toggles.

import type { DictionaryComponent, DictionaryEntry } from '@/entities/dictionary';

export const DICTIONARY_COMPONENTS: readonly DictionaryComponent[] = [
  'definitions',
  'examples',
  'translations',
  'synonyms',
  'pronunciation',
  'inflections',
  'etymology',
  'wordFamily',
  'wordNet',
  'derivedTerms',
  'related',
  'level',
  'frequencyStars',
];

type ComponentSource = Pick<
  DictionaryEntry,
  | 'definition' | 'senses' | 'pronunciation' | 'inflections' | 'etymology'
  | 'wordFamily' | 'wordNet' | 'derivedTerms' | 'related' | 'level'
  | 'frequencyStars' | 'examples'
>;

/** Fold one stored entry's components into `set`. */
export function collectEntryComponents(set: Set<DictionaryComponent>, e: ComponentSource): void {
  const senses = e.senses ?? [];
  if (senses.length > 0 || e.definition.trim()) set.add('definitions');
  if (e.pronunciation.trim()) set.add('pronunciation');
  if (e.inflections?.length) set.add('inflections');
  if (e.etymology) set.add('etymology');
  if (e.wordFamily) set.add('wordFamily');
  if (e.wordNet) set.add('wordNet');
  if (e.derivedTerms?.length) set.add('derivedTerms');
  if (e.related?.length) set.add('related');
  if (e.level) set.add('level');
  if (e.frequencyStars) set.add('frequencyStars');
  if (e.examples?.trim() || senses.some((s) => s.lines.some((l) => l.role === 'example'))) set.add('examples');
  if (senses.some((s) => s.lines.some((l) => l.translation))) set.add('translations');
  if (senses.some((s) => (s.synonyms?.length ?? 0) > 0 || (s.antonyms?.length ?? 0) > 0)) set.add('synonyms');
}

export function sortedComponents(set: ReadonlySet<DictionaryComponent>): DictionaryComponent[] {
  return DICTIONARY_COMPONENTS.filter((c) => set.has(c));
}
