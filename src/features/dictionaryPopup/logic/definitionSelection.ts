// These used to live inside the legacy popupContent.ts renderer. They are
// still consumed by useCandidate and useDictionaryLookup, so they have been
// extracted into a standalone logic module before that legacy file was deleted.

import type { LookupResult, DefinitionEntry } from '../types';

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
