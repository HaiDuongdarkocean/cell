/**
 * Sentence translation — translate a single cue's text via the background
 * TRANSLATE message (Google Translate unofficial endpoint, ADR-021 D2).
 *
 * Reuses the existing translate service's encode/decode punctuation logic
 * to prevent Google from splitting on sentence boundaries. Returns empty
 * string on any failure (translation is optional; never blocks card creation).
 */
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse, TranslatePayload, TranslateResult } from '@/entities/message';
import { encodePunctuation, decodePunctuation } from '@/features/translate/service/translateService';

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

  const encoded = encodePunctuation(text.replace(/\n/g, ' '));
  const payload: TranslatePayload = { text: encoded, sl: sourceLang, tl: targetLang };

  try {
    const response = (await sendMessage({
      type: MESSAGE_TYPES.TRANSLATE,
      payload,
    })) as MessageResponse<TranslateResult> | undefined;
    if (!response?.success || !response.data) return '';
    const segments = response.data.translated;
    if (!segments || segments.length === 0) return '';
    // Join all segments (Google may split) + decode punctuation.
    const joined = segments.join('');
    return decodePunctuation(joined).trim();
  } catch {
    return '';
  }
}
