// sendToCreator — spec §4.6 P1.2: Send to Creator two-pane workspace.
//
// Opens the Card Creator dialog pre-filled with the popup dictionary's
// lookup result + selected materials (definitions, audio, image, translation).
//
// Reuses the existing Card Creator mount + dialog. No duplicate card model.
// The popup controller calls sendToCreator(state) → Card Creator opens with
// draft pre-filled.

import type { LookupResult } from '../types';
import type { DefinitionSelection } from '../ui/popupContent';
import type { CardCreatorSettings } from '@/entities/settings/types';
import type { BilingualCue } from '@/entities/media';

/** Pre-fill data extracted from the popup dictionary state. */
export interface SendToCreatorPrefill {
  readonly term: string;
  readonly langCode: string;
  readonly reading: string;
  readonly definitions: readonly { readonly pos?: string; readonly text: string }[];
  readonly contextSentence: string;
  readonly translation?: string;
  readonly audioUrls?: readonly string[];
  readonly imageUrls?: readonly string[];
}

/** Extract pre-fill data from a LookupResult + selections. */
export function extractPrefill(
  result: LookupResult,
  definitionSelection: DefinitionSelection,
  contextSentence: string,
  translation?: string,
  audioUrls?: readonly string[],
  imageUrls?: readonly string[],
): SendToCreatorPrefill {
  const selectedDefs = result.definitions.filter((d) => definitionSelection.get(d.id) !== false);
  return {
    term: result.term,
    langCode: result.langCode,
    reading: result.reading,
    definitions: selectedDefs.map((d) => ({
      pos: d.pos,
      text: d.text,
    })),
    contextSentence,
    translation,
    audioUrls,
    imageUrls,
  };
}

/** Build a fake BilingualCue for the Card Creator open context. */
function buildFakeCue(
  prefill: SendToCreatorPrefill,
): BilingualCue {
  return {
    index: 0,
    start: 0,
    end: 0,
    targetText: prefill.contextSentence,
    nativeText: prefill.translation ?? '',
  };
}

/** Build definitions text for the Card Creator draft. */
export function buildDefinitionsText(
  definitions: readonly { readonly pos?: string; readonly text: string }[],
): string {
  return definitions
    .map((d) => (d.pos ? `(${d.pos}) ${d.text}` : d.text))
    .join('\n');
}

/**
 * Send to Creator — open the Card Creator dialog pre-filled with the
 * popup dictionary's lookup result.
 *
 * ponytail: MVP version sends a message to the background script, which
 * opens the Card Creator dialog. The background script has access to
 * the mountCardCreatorDialog controller. Real version: the content script
 * calls mountCardCreatorDialog directly (it already does for subtitle
 * capture).
 *
 * For now, this function builds the pre-fill data + sends a message.
 * The background script (or content script controller) opens the dialog.
 */
export async function sendToCreator(
  prefill: SendToCreatorPrefill,
  cardCreatorSettings: CardCreatorSettings,
): Promise<void> {
  // Build the definitions text for the draft.
  const definitionsText = buildDefinitionsText(prefill.definitions);

  // Build the fake cue for the Card Creator open context.
  const cue = buildFakeCue(prefill);

  // ponytail: in production, the content script controller calls
  // mountCardCreatorDialog().open(context). For MVP, we send a message
  // to the background script which forwards it to the content script.
  try {
    const { sendMessage } = await import('@/shared/lib/chrome-apis/runtime');
    await sendMessage({
      type: 'SEND_TO_CREATOR',
      payload: {
        term: prefill.term,
        langCode: prefill.langCode,
        reading: prefill.reading,
        definitionsText,
        contextSentence: prefill.contextSentence,
        translation: prefill.translation ?? '',
        audioUrls: prefill.audioUrls ?? [],
        imageUrls: prefill.imageUrls ?? [],
        cue,
        cardCreatorSettings,
      },
    });
  } catch {
    // Best-effort — fail silently.
  }
}
