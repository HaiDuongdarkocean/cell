// These used to live inside the legacy popupContent.ts renderer. They are
// still consumed by useCandidate and useDictionaryLookup, so they have been
// extracted into a standalone logic module before that legacy file was deleted.

import type { LookupResult, DefinitionEntry } from '@/entities/dictionary';

/** Selection state for definitions (checkboxes). */
export type DefinitionSelection = Map<string, boolean>;

/** Initialize definition selection.
 *  - If `selectedIds` is omitted, every definition starts unchecked.
 *  - If `selectedIds` is provided, those IDs start checked and all others
 *    unchecked. This lets the integrated Dictionary clone a popup snapshot.
 */
export function initDefinitionSelection(
  result: LookupResult,
  selectedIds?: readonly string[],
): DefinitionSelection {
  const selectedSet = selectedIds ? new Set(selectedIds) : null;
  const map = new Map<string, boolean>();
  for (const def of result.definitions) {
    map.set(def.id, selectedSet ? selectedSet.has(def.id) : false);
  }
  return map;
}

/** Get the definitions the user explicitly selected. */
export function getSelectedDefinitions(
  result: LookupResult,
  selection: DefinitionSelection,
): DefinitionEntry[] {
  return result.definitions.filter((def) => selection.get(def.id) === true);
}

/** Selection state for example lines, keyed by definition id → example indices. */
export type ExampleSelection = ReadonlyMap<string, ReadonlySet<number>>;

const EXAMPLE_ID_SEP = ':';

export function makeExampleId(defId: string, index: number): string {
  return `${defId}${EXAMPLE_ID_SEP}${index}`;
}

/** Initialize example selection from a popup snapshot (`defId:index` ids).
 *  Ids are applied verbatim — never derived from the include-all setting.
 *  Orphans (unknown def / index out of range) are dropped. */
export function initExampleSelection(
  result: LookupResult,
  selectedExampleIds?: readonly string[],
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  if (!selectedExampleIds) return map;
  for (const id of selectedExampleIds) {
    const sep = id.lastIndexOf(EXAMPLE_ID_SEP);
    if (sep <= 0 || sep === id.length - 1) continue;
    const defId = id.slice(0, sep);
    const index = Number(id.slice(sep + 1));
    const def = result.definitions.find((d) => d.id === defId);
    if (!def || !Number.isInteger(index) || index < 0 || index >= def.examples.length) continue;
    const set = map.get(defId) ?? new Set<number>();
    set.add(index);
    map.set(defId, set);
  }
  return map;
}

/** Selected example texts of one definition, in source order. */
export function getSelectedExamples(
  def: DefinitionEntry,
  selection: ExampleSelection,
): string[] {
  const indices = selection.get(def.id);
  if (!indices || indices.size === 0) return [];
  return def.examples.filter((_, i) => indices.has(i)).map((l) => l.text);
}

/** Composite `defId:index` ids for the shipped defs, in def + index order. */
export function toSelectedExampleIds(
  defs: readonly DefinitionEntry[],
  selection: ExampleSelection,
): string[] {
  const ids: string[] = [];
  for (const def of defs) {
    const indices = selection.get(def.id);
    if (!indices) continue;
    for (let i = 0; i < def.examples.length; i += 1) {
      if (indices.has(i)) ids.push(makeExampleId(def.id, i));
    }
  }
  return ids;
}
