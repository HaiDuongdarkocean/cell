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
 *    dictionary audio tab); `resolveSentence` → sentence audio (same chain
 *    restricted to cloud voices + browser voice, only when a sentence exists —
 *    captured/recorded sentence audio is never touched here)
 *  - `FETCH_IMAGES`          → image candidates
 *
 * Every media fetch is best-effort: a failing source yields an empty list, it
 * never blocks the other sources or the definitions that did resolve.
 */
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { newId } from '@/shared/lib/id';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_PRONUNCIATION_SETTINGS, DEFAULT_SETTINGS } from '@/shared/config/config';
import { PronunciationAudioOrchestrator, audioItemDataUrl, resolveSentenceAudioItems } from '@/features/pronunciation';
import { formatDefinitions } from '@/features/dictionary';
import { formatDefFromLookup, joinDefEntries } from '@/features/srs';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import type { MessageResponse } from '@/entities/message/types';
import type {
  FetchImagesResponse,
  LookupRequest,
  LookupResult,
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
  return newId();
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
    const items = await withTimeout(
      resolveSentenceAudioItems(sentence, langCode),
      MEDIA_TIMEOUT_MS,
    );
    return items.map(audioItemDataUrl).filter((url): url is string => url !== undefined);
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

async function lookupTerm(term: string, langCode: string, contextSentence: string): Promise<LookupResult | null> {
  const request: LookupRequest = {
    term,
    langCode,
    contextSentence: (contextSentence.trim() || term).slice(0, 500),
    cursorOffset: 0,
    fallback: true,
  };

  try {
    const response = await withTimeout(
      sendMessage<MessageResponse<LookupResult[]>>({
        type: MESSAGE_TYPES.LOOKUP_REQUEST,
        payload: { requestId: makeRequestId(), request },
      }),
      LOOKUP_TIMEOUT_MS,
    );
    return response?.success && response.data?.length ? response.data[0]! : null;
  } catch {
    return null;
  }
}

function formatEntryFromLookup(winner: LookupResult, frequencyFormat?: 'stars' | 'rank', frequencyThresholds?: FrequencyBandThresholds): string {
  return formatDefFromLookup(winner, formatDefinitions(winner.definitions), undefined, frequencyFormat, frequencyThresholds);
}

/**
 * Look up `term` in the dictionary and build a CardCreatorPrefill-shaped
 * source: formatted definitions + media URLs. Returns null when the lookup
 * itself fails or the term has no dictionary entry.
 *
 * Comma-separated terms ("hormone, reset") are looked up individually and
 * joined into one `def` block separated by `---` (see defEntry.ts).
 */
export async function lookupDictionaryResources(
  term: string,
  langCode: string,
  contextSentence: string,
): Promise<CardCreatorPrefill | null> {
  const terms = term.split(/[,;、]/).map((w) => w.trim()).filter(Boolean);
  if (terms.length === 0) return null;

  const winners = (await Promise.all(terms.map((w) => lookupTerm(w, langCode, contextSentence))))
    .filter((w): w is LookupResult => w !== null);
  if (winners.length === 0) return null;
  const winner = winners[0]!;

  const [wordAudioUrls, sentenceAudioUrls, imageUrls] = await Promise.all([
    fetchWordAudioUrls(winner.term, winner.langCode),
    fetchSentenceAudioUrls(contextSentence, winner.langCode),
    fetchImageUrls(winner.term, winner.langCode),
  ]);
  const settings = await loadSettings().catch(() => DEFAULT_SETTINGS);

  return {
    targetWord: terms.join(', '),
    definitions: joinDefEntries(
      winners.map((w) => formatEntryFromLookup(w, settings.dictionaryPopup?.frequencyDisplay, settings.frequencyBands)),
    ),
    wordAudioUrls,
    sentenceAudioUrls,
    imageUrls,
  };
}
