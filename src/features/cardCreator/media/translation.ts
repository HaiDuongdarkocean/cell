/**
 * Sentence translation — translate a single cue's text via the background
 * TRANSLATE message (Google Translate unofficial endpoint, ADR-021 D2).
 *
 * Returns empty string on any failure (translation is optional; never blocks
 * card creation).
 */
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse, TranslatePayload, TranslateResult } from '@/entities/message';

/**
 * Translate a single cue's text from source to target language.
 *
 * @param text - Cue text to translate.
 * @param sourceLang - ISO 639-1 source language (e.g. 'en'). Use 'auto' for detection.
 * @param targetLang - ISO 639-1 target language (e.g. 'vi').
 * @returns Translated text, or '' on any failure (never throws).
 */
export async function translateSentence(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  if (!text.trim()) return '';
  if (sourceLang === targetLang) return text;

  // tabId: 0 — content script không có tab id thật, background không cần cho translate
  const payload: TranslatePayload = { tabId: 0, text: text.replace(/\n/g, ' '), sl: sourceLang, tl: targetLang };

  try {
    const response = (await sendMessage({
      type: MESSAGE_TYPES.TRANSLATE,
      payload,
    })) as MessageResponse<TranslateResult> | undefined;
    if (!response?.success || !response.data) return '';
    const segments = response.data.translated;
    if (!segments || segments.length === 0) return '';
    // Join all segments (Google may split on sentence boundaries) + trim.
    return segments.join('').trim();
  } catch {
    return '';
  }
}
