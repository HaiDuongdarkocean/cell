// quickAddAssembler — spec §9.2, D7: build QuickAddPayload from popup state.
//
// Respects Card Creator auto-complete settings (per-field toggle + fallback).
// Field auto-complete ON → fill with best-match items (+ fallback).
// Field auto-complete OFF → only fill user-ticked items.
//
// Definitions join: `\n` + `{pos}. {text}` + examples per line.
// Audios/images: pass through (binary fetch happens in Anki Quick Add step).
// Translation → sentenceTranslation; sentence → sentence; term → targetWord.

import type {
  QuickAddPayload,
  LookupResult,
  DefinitionEntry,
  WordStatus,
} from '../types';
import type { CardCreatorSettings, AutoCompletableField } from '@/entities/settings/types';

/** Selection state from popup UI (checkboxes). */
export interface PopupSelection {
  readonly definitions: Map<string, boolean>;
  readonly audios: Map<string, boolean>;
  readonly images: Map<string, boolean>;
}

/** Format definitions for Anki field: join `\n` + `{pos}. {text}` + examples. */
export function formatDefinitions(defs: readonly DefinitionEntry[]): string {
  return defs
    .map((def) => {
      const posPrefix = def.pos ? `${def.pos}. ` : '';
      const examples = def.examples.length > 0
        ? '\n' + def.examples.map((ex) => `  • ${ex}`).join('\n')
        : '';
      return `${posPrefix}${def.text}${examples}`;
    })
    .join('\n');
}

/** Filter items by selection map (fallback to defaultSelected). */
function filterSelected<T extends { readonly id: string; readonly defaultSelected: boolean }>(
  items: readonly T[],
  selection: Map<string, boolean>,
): T[] {
  return items.filter((item) => selection.get(item.id) ?? item.defaultSelected);
}

/**
 * Assemble QuickAddPayload from popup state + Card Creator settings.
 *
 * @param result - LookupResult from the orchestrator.
 * @param selection - User checkbox selections from popup UI.
 * @param sentence - The context sentence (default = LookupRequest.contextSentence).
 * @param translation - Translation text (default '' if Translate panel not opened).
 * @param status - Current word status.
 * @param cardCreatorSettings - Card Creator settings with auto-complete toggles.
 * @returns QuickAddPayload ready for Anki Quick Add.
 */
export function assembleQuickAddPayload(
  result: LookupResult,
  selection: PopupSelection,
  sentence: string,
  translation: string,
  status: WordStatus,
  cardCreatorSettings: CardCreatorSettings,
): QuickAddPayload {
  const toggles = cardCreatorSettings.autoCompleteToggles ?? {
    definitions: true,
    wordAudios: true,
    sentenceAudios: true,
    images: true,
    sentenceTranslation: true,
    sentence: true,
  };

  // Definitions: if auto-complete ON, use all selected definitions.
  // If OFF, only use user-ticked definitions (explicit selection).
  const selectedDefs = filterSelected(result.definitions, selection.definitions);
  const definitions = toggles.definitions
    ? selectedDefs
    : selectedDefs.filter((d) => selection.definitions.get(d.id) === true);

  // Audios: same logic. (Audio items come from the audio panel, not LookupResult.
  // For now, we pass through the selection — the caller provides audio items
  // separately via the audio panel state.)
  // This function focuses on definitions + sentence + translation.
  // Audio/image filtering happens in the Quick Add handler (Task 5.2).

  return {
    term: result.term,
    langCode: result.langCode,
    definitions,
    audios: [],
    images: [],
    translation: toggles.sentenceTranslation ? translation : '',
    sentence: toggles.sentence ? sentence : '',
    status,
    destination: 'anki',
  };
}

/**
 * Build the Anki note fields from QuickAddPayload + Card Creator field mapping.
 *
 * Field mapping comes from Card Creator settings/draft (deck, noteType,
 * fieldMapping). This function maps QuickAddPayload fields to Anki note
 * fields according to the mapping.
 *
 * @param payload - QuickAddPayload from assembleQuickAddPayload.
 * @param fieldMapping - Card Creator field mapping (fieldName → source).
 * @returns Record of Anki field name → string value.
 */
export function buildAnkiNoteFields(
  payload: QuickAddPayload,
  fieldMapping: Record<string, string>,
): Record<string, string> {
  const fields: Record<string, string> = {};

  const definitionsText = formatDefinitions(payload.definitions);

  // Source values available for mapping.
  const sourceValues: Record<string, string> = {
    term: payload.term,
    definitions: definitionsText,
    sentence: payload.sentence,
    translation: payload.translation,
    // Audio/image fields are handled separately (binary fetch in Task 5.2).
  };

  for (const [fieldName, source] of Object.entries(fieldMapping)) {
    if (source === 'None' || source === 'none') continue;
    fields[fieldName] = sourceValues[source] ?? '';
  }

  return fields;
}

/** Check if a field should be auto-completed. */
export function isAutoCompleteEnabled(
  field: AutoCompletableField,
  settings: CardCreatorSettings,
): boolean {
  return settings.autoCompleteToggles?.[field] ?? true;
}
