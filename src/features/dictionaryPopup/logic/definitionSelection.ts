// definitionSelection.ts — pure helpers for definition checkbox state.
//
// These used to live inside the legacy popupContent.ts renderer. They are
// still consumed by useCandidate and useDictionaryLookup, so they have been
// extracted into a standalone logic module before that legacy file was deleted.

import type { LookupResult, DefinitionEntry } from '../types';

/** Selection state for definitions (checkboxes). */
export type DefinitionSelection = Map<string, boolean>;

/** Initialize definition selection from LookupResult (default all selected). */
export function initDefinitionSelection(result: LookupResult): DefinitionSelection {
  const map = new Map<string, boolean>();
  for (const def of result.definitions) {
    map.set(def.id, def.defaultSelected);
  }
  return map;
}

/** Get the selected definitions from a selection map. */
export function getSelectedDefinitions(
  result: LookupResult,
  selection: DefinitionSelection,
): DefinitionEntry[] {
  return result.definitions.filter((def) => selection.get(def.id) ?? def.defaultSelected);
}
