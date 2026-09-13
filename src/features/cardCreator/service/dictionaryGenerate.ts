/**
 * dictionaryGenerate — dictionary lookup for the Card Creator generate flow.
 *
 * When the user types a target word manually (no popup/subtitle prefill, or a
 * prefill that belongs to a different term), `generateField`/`generateAll`
 * resolve their source data through this module instead of `ctx.prefill`.
 *
 * Reuses the exact dictionary pipeline:
 *  - `LOOKUP_REQUEST`        → definitions (same message the popup uses)
 *  - `PronunciationAudioOrchestrator` → word audio (same fallback chain as the
 *    dictionary audio tab)
 *  - `TTS_FETCH_AUDIO`       → sentence audio (only when a sentence exists —
 *    captured/recorded sentence audio is never touched here)
 *  - `FETCH_IMAGES`          → image candidates
 *
 * Every media fetch is best-effort: a failing source yields an empty list, it
 * never blocks the other sources or the definitions that did resolve.
 */
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_PRONUNCIATION_SETTINGS, DEFAULT_SETTINGS } from '@/shared/config/config';
import { PronunciationAudioOrchestrator } from '@/features/pronunciation/services/pronunciationAudioOrchestrator';
import { formatDefinitions } from '@/features/dictionary/logic/formatDefinitions';
import type { MessageResponse } from '@/entities/message/types';
import type {
  FetchImagesResponse,
  LookupRequest,
  LookupResult,
  TtsFetchAudioResponse,
} from '@/entities/dictionary';
import type { CardCreatorPrefill } from '../types';

const LOOKUP_TIMEOUT_MS = 15_000;
const MEDIA_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fetchWordAudioUrls(term: string, langCode: string): Promise<readonly string[]> {
  try {
    const settings = await withTimeout(loadSettings(), 5_000).catch(() => DEFAULT_SETTINGS);
    const orchestrator = new PronunciationAudioOrchestrator(
      settings.pronunciation ?? DEFAULT_PRONUNCIATION_SETTINGS,
    );
    const items = await withTimeout(orchestrator.resolve(term, langCode), MEDIA_TIMEOUT_MS);
    const withUrl = items.filter((item) => item.kind === 'word' && item.url);
    // Mirror the popup's effective selection: explicit/default picks first,
    // then fall back to the first available so the card always gets audio.
    const selected = withUrl.filter((item) => item.defaultSelected);
    return (selected.length > 0 ? selected : withUrl.slice(0, 1)).map((item) => item.url!);
  } catch {
    return [];
  }
}

async function fetchSentenceAudioUrls(sentence: string, langCode: string): Promise<readonly string[]> {
  if (!sentence.trim()) return [];
  try {
    const res = await withTimeout(
      sendMessage<MessageResponse<TtsFetchAudioResponse>>({
        type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
        payload: { tabId: 0, text: sentence, langCode },
      }),
      MEDIA_TIMEOUT_MS,
    );
    return res?.success && res.data?.url ? [res.data.url] : [];
  } catch {
    return [];
  }
}

async function fetchImageUrls(term: string, langCode: string): Promise<readonly string[]> {
  try {
    const res = await withTimeout(
      sendMessage<MessageResponse<FetchImagesResponse>>({
        type: MESSAGE_TYPES.FETCH_IMAGES,
        payload: { tabId: 0, term, langCode },
      }),
      MEDIA_TIMEOUT_MS,
    );
    const items = res?.success && res.data?.items ? res.data.items : [];
    const selected = items.filter((item) => item.defaultSelected);
    return (selected.length > 0 ? selected : items.slice(0, 1)).map((item) => item.src);
  } catch {
    return [];
  }
}

/**
 * Look up `term` in the dictionary and build a CardCreatorPrefill-shaped
 * source: formatted definitions + media URLs. Returns null when the lookup
 * itself fails or the term has no dictionary entry.
 */
export async function lookupDictionaryResources(
  term: string,
  langCode: string,
  contextSentence: string,
): Promise<CardCreatorPrefill | null> {
  const trimmed = term.trim();
  if (!trimmed) return null;

  const request: LookupRequest = {
    term: trimmed,
    langCode,
    contextSentence: (contextSentence.trim() || trimmed).slice(0, 500),
    cursorOffset: 0,
    fallback: true,
  };

  let winner: LookupResult | null = null;
  try {
    const response = await withTimeout(
      sendMessage<MessageResponse<LookupResult[]>>({
        type: MESSAGE_TYPES.LOOKUP_REQUEST,
        payload: { requestId: makeRequestId(), request },
      }),
      LOOKUP_TIMEOUT_MS,
    );
    winner = response?.success && response.data?.length ? response.data[0]! : null;
  } catch {
    return null;
  }
  if (!winner) return null;

  const [wordAudioUrls, sentenceAudioUrls, imageUrls] = await Promise.all([
    fetchWordAudioUrls(winner.term, winner.langCode),
    fetchSentenceAudioUrls(contextSentence, winner.langCode),
    fetchImageUrls(winner.term, winner.langCode),
  ]);

  return {
    targetWord: winner.term,
    definitions: formatDefinitions(winner.definitions),
    wordAudioUrls,
    sentenceAudioUrls,
    imageUrls,
  };
}
