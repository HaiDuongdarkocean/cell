/**
 * SubtitleActionContext — shared interface for subtitle action orchestration.
 *
 * Both content-script and local-player build this context from their own state
 * and pass it to the shared action functions in cardActions.ts / generateNativeAction.ts.
 * This is the SSOT contract between the action layer and its consumers.
 */
import type { WebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import type { SrtCue, Settings } from '@/entities/media';
import type { ToastVariant } from '@/features/subtitle/ui/SubtitleToast';

export interface ShowToastOptions {
  variant?: ToastVariant;
}

export interface SubtitleActionContext {
  /** The video element being played. */
  readonly video: HTMLVideoElement;
  /** Container element for toast positioning (shadow host or overlay parent). */
  readonly container: HTMLElement;
  /** Web text dictionary controller — owns Card Creator dialog. Undefined if not configured. */
  readonly webTextCtrl: WebTextDictionaryController | undefined;
  /** Get current target language cues. */
  readonly getTargetCues: () => readonly SrtCue[];
  /** Get current native language cues. */
  readonly getNativeCues: () => readonly SrtCue[];
  /** Get the text of the currently active target subtitle line. */
  readonly getCurrentTargetText: () => string;
  /** Get the text of the currently active native subtitle line. */
  readonly getCurrentNativeText: () => string;
  /** Get the current subtitle offset in ms. */
  readonly getOffsetMs: () => number;
  /** Show a toast notification. */
  readonly showToast: (message: string, options?: ShowToastOptions) => void;
  /** Load settings or show an error toast if storage fails. */
  readonly loadSettingsOrToast: (container: HTMLElement) => Promise<Settings | undefined>;
}
