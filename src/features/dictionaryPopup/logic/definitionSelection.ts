// These used to live inside the legacy popupContent.ts renderer. They are
// still consumed by useCandidate and useDictionaryLookup, so they have been
// extracted into a standalone logic module before that legacy file was deleted.

import type { LookupResult, DefinitionEntry } from '@/entities/dictionary';

/** Selection state for definitions (checkboxes). Subsenses are keyed by
 *  composite ids (`defId#index`) — selecting one implies its parent def
 *  ships as context (gloss + relations), never as a synthetic merged row. */
export type DefinitionSelection = Map<string, boolean>;

const SUB_ID_SEP = '#';

export function makeSubsenseId(defId: string, subIndex: number): string {
  return `${defId}${SUB_ID_SEP}${subIndex}`;
}

/** Split a selection id into parent def id + optional subsense index. */
export function splitSelectionId(id: string): { readonly defId: string; readonly subIndex?: number } {
  const sep = id.lastIndexOf(SUB_ID_SEP);
  if (sep <= 0 || sep === id.length - 1) return { defId: id };
  const subIndex = Number(id.slice(sep + 1));
  return Number.isInteger(subIndex) && subIndex >= 0
    ? { defId: id.slice(0, sep), subIndex }
    : { defId: id };
}

/** Examples owned by a selection id — def-level or one subsense's. */
export function examplesForSelectionId(
  result: LookupResult,
  id: string,
): DefinitionEntry['examples'] | undefined {
  const { defId, subIndex } = splitSelectionId(id);
  const def = result.definitions.find((d) => d.id === defId);
  return subIndex === undefined ? def?.examples : def?.subsenses?.[subIndex]?.examples;
}

/** Indices of a def's subsenses the user checked. */
export function getSelectedSubsenseIndexes(
  def: DefinitionEntry,
  selection: DefinitionSelection,
): readonly number[] {
  return (def.subsenses ?? [])
    .map((_, i) => i)
    .filter((i) => selection.get(makeSubsenseId(def.id, i)) === true);
}

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
    for (let i = 0; i < (def.subsenses?.length ?? 0); i += 1) {
      map.set(makeSubsenseId(def.id, i), selectedSet ? selectedSet.has(makeSubsenseId(def.id, i)) : false);
    }
  }
  return map;
}

/** Get the definitions to ship — a def is included when it is checked OR
 *  any of its subsenses is checked (the parent rides along as context). */
export function getSelectedDefinitions(
  result: LookupResult,
  selection: DefinitionSelection,
): DefinitionEntry[] {
  return result.definitions.filter(
    (def) => selection.get(def.id) === true || getSelectedSubsenseIndexes(def, selection).length > 0,
  );
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
    const ownerId = id.slice(0, sep);
    const index = Number(id.slice(sep + 1));
    const examples = examplesForSelectionId(result, ownerId);
    if (!examples || !Number.isInteger(index) || index < 0 || index >= examples.length) continue;
    const set = map.get(ownerId) ?? new Set<number>();
    set.add(index);
    map.set(ownerId, set);
  }
  return map;
}

/** Selected example texts of one definition, in source order. */
export function getSelectedExamples(
  def: DefinitionEntry,
  selection: ExampleSelection,
): string[] {
  return selectedExampleTexts(def.id, def.examples, selection);
}

/** Selected example texts of one subsense, keyed by its composite id. */
export function getSelectedSubsenseExamples(
  def: DefinitionEntry,
  sub: { readonly examples?: readonly { readonly text: string }[] },
  subIndex: number,
  selection: ExampleSelection,
): string[] {
  return selectedExampleTexts(makeSubsenseId(def.id, subIndex), sub.examples ?? [], selection);
}

function selectedExampleTexts(
  ownerId: string,
  examples: readonly { readonly text: string }[],
  selection: ExampleSelection,
): string[] {
  const indices = selection.get(ownerId);
  if (!indices || indices.size === 0) return [];
  return examples.filter((_, i) => indices.has(i)).map((l) => l.text);
}

/** Composite `ownerId:index` ids for shipped defs + their selected
 *  subsenses, in def → subsense → index order. */
export function toSelectedExampleIds(
  defs: readonly DefinitionEntry[],
  selection: ExampleSelection,
): string[] {
  const ids: string[] = [];
  const pushFor = (ownerId: string, count: number) => {
    const indices = selection.get(ownerId);
    if (!indices) return;
    for (let i = 0; i < count; i += 1) {
      if (indices.has(i)) ids.push(makeExampleId(ownerId, i));
    }
  };
  for (const def of defs) {
    pushFor(def.id, def.examples.length);
    for (const [i, sub] of (def.subsenses ?? []).entries()) {
      if (sub.examples?.length) pushFor(makeSubsenseId(def.id, i), sub.examples.length);
    }
  }
  return ids;
}
