/**
 * Generate native subtitle — shared translation core.
 *
 * Extracted from contentScriptController.ts. The core translation logic
 * (createTranslateFunction + BackgroundPrefillController) is reusable by both
 * content-script and local-player. State management (runId, translatedSlot,
 * panel refresh) stays in the consumer — content-script has complex multi-source
 * state, local-player has simple single-track state.
 */
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { isoCodeToLabel } from '@/features/detection/logic/languageDetector';
import { BackgroundPrefillController } from '@/features/translate/logic/translatePrefill';
import { createTranslateFunction } from '@/features/subtitle';
import type { SrtCue } from '@/entities/media';

export interface GenerateNativeCallbacks {
  /** Called when a chunk of cues is translated. Consumer should load cues + update UI. */
  onChunkTranslated: (translatedCues: SrtCue[]) => void;
  /** Called on translation error. */
  onError: (message: string) => void;
  /** Called when translation completes. */
  onComplete: () => void;
}

export interface GenerateNativeResult {
  /** The BackgroundPrefillController — caller stores it to allow cancellation. */
  prefill: BackgroundPrefillController;
  /** Source language code (from settings). */
  sourceLang: string;
  /** Target/native language code (from settings). */
  targetLang: string;
  /** Human-readable native language label (e.g. "Vietnamese"). */
  nativeLabel: string;
}

/** Validate that generate-native can run: languages must differ + target cues exist.
 *  Returns an error message if invalid, null if OK. */
export function validateGenerateNative(
  sourceLang: string,
  targetLang: string,
  targetCueCount: number,
): string | null {
  if (!sourceLang || !targetLang || sourceLang === targetLang) {
    return 'Target and native languages must differ';
  }
  if (targetCueCount === 0) {
    return 'No target subtitle to translate';
  }
  return null;
}

/** Start generate-native: load settings, validate, create BackgroundPrefillController.
 *  Returns null if validation fails (caller shows the error toast). */
export async function startGenerateNative(
  targetCues: readonly SrtCue[],
  callbacks: GenerateNativeCallbacks,
): Promise<GenerateNativeResult | null> {
  const settings = await loadSettings();
  const sl = settings.subtitleOverlayTargetLanguage ?? '';
  const tl = settings.subtitleOverlayNativeLanguage ?? '';

  const error = validateGenerateNative(sl, tl, targetCues.length);
  if (error) {
    return null;
  }

  const nativeLabel = isoCodeToLabel(tl) ?? tl;
  const prefill = new BackgroundPrefillController({
    translate: createTranslateFunction(sl, tl),
    onChunkTranslated: callbacks.onChunkTranslated,
    onError: callbacks.onError,
    onComplete: callbacks.onComplete,
  });

  prefill.start([...targetCues], sl, tl);

  return { prefill, sourceLang: sl, targetLang: tl, nativeLabel };
}
