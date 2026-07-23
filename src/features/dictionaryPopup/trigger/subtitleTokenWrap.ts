// subtitleTokenWrap — integrates token-wrap + trigger into SubtitleOverlayController.
//
// When dictionaryPopup is enabled, subtitle text is wrapped into per-token
// spans (EN per-word, ZH per-segment) and the SubtitleTriggerController
// attaches click/hover listeners. When disabled, falls back to plain text
// (current behavior — spec: "dictionaryPopupEnabled: false → popup trigger
// tắt, subtitle overlay giữ nguyên behavior cũ").
//
// Integration point: SubtitleOverlayController.onTimeUpdate calls
// updateOverlayText(overlay, text). This module provides a wrapper that
// intercepts the text update when popup is enabled.

import { wrapTokenSpans, detectLangCode, SubtitleTriggerController } from '../trigger/subtitleTriggerController';
import type { LookupRequest, TriggerMode } from '../types';

export interface TokenWrapState {
  enabled: boolean;
  triggerController: SubtitleTriggerController | null;
  /** Currently attached token spans (for detach on next cue change). */
  currentSpans: HTMLSpanElement[];
  /** The sentence currently displayed (for LookupRequest contextSentence). */
  currentSentence: string;
  /** The lang code of the current sentence. */
  currentLangCode: string;
}

export function createTokenWrapState(): TokenWrapState {
  return {
    enabled: false,
    triggerController: null,
    currentSpans: [],
    currentSentence: '',
    currentLangCode: 'en',
  };
}

/**
 * Update the overlay text with token-wrap when enabled, or plain text when disabled.
 * Call this instead of `updateOverlayText` when dictionary popup is active.
 *
 * @param overlay - The overlay div (has a text span child).
 * @param text - The subtitle cue text.
 * @param state - Token wrap state (mutated in place).
 * @returns true if token-wrap was applied, false if plain text was used.
 */
export function updateOverlayWithTokens(
  overlay: HTMLDivElement,
  text: string,
  state: TokenWrapState,
): boolean {
  if (!state.enabled || !text) {
    // Fallback: plain text (current behavior).
    const span = overlay.querySelector('span[data-testid]') as HTMLSpanElement | null;
    if (span) span.textContent = text;
    else overlay.textContent = text;
    overlay.style.display = 'block';
    return false;
  }

  // Detach previous trigger listeners.
  if (state.triggerController) {
    state.triggerController.detach();
  }

  // Find the text span.
  const span = overlay.querySelector('span[data-testid]') as HTMLSpanElement | null;
  if (!span) {
    overlay.textContent = text;
    overlay.style.display = 'block';
    return false;
  }

  // Detect language + wrap tokens.
  const langCode = detectLangCode(text);
  const tokenSpans = wrapTokenSpans(span, text, langCode);
  overlay.style.display = 'block';

  // Update state.
  state.currentSpans = tokenSpans;
  state.currentSentence = text;
  state.currentLangCode = langCode;

  // Attach trigger listeners.
  if (state.triggerController && tokenSpans.length > 0) {
    state.triggerController.attach(tokenSpans, text, langCode);
  }

  return true;
}

/**
 * Enable token-wrap mode. Creates a trigger controller if not already present.
 *
 * @param state - Token wrap state.
 * @param triggerMode - Click/hover/hover+modifier.
 * @param onLookup - Callback when a lookup is triggered.
 * @param onCancel - Callback to cancel an in-flight lookup.
 * @param onClear - Optional callback when the cursor leaves a valid token target.
 */
export function enableTokenWrap(
  state: TokenWrapState,
  triggerMode: TriggerMode,
  onLookup: (request: LookupRequest, requestId: string) => void,
  onCancel: (requestId: string) => void,
  onClear?: () => void,
): void {
  state.enabled = true;
  if (!state.triggerController) {
    state.triggerController = new SubtitleTriggerController({
      triggerMode,
      onLookup,
      onCancel,
      onClear,
    });
  }
}

/** Disable token-wrap mode. Detaches trigger + clears state. */
export function disableTokenWrap(state: TokenWrapState): void {
  state.enabled = false;
  if (state.triggerController) {
    state.triggerController.detach();
  }
  state.currentSpans = [];
  state.currentSentence = '';
}

/** Update the trigger mode (re-attaches listeners on next cue). */
export function setTriggerMode(
  state: TokenWrapState,
  mode: TriggerMode,
): void {
  if (state.triggerController) {
    state.triggerController.setTriggerMode(mode);
  }
}
