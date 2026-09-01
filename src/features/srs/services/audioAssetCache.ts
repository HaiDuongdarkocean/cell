import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message/types';
import type { TtsFetchAudioResponse } from '@/features/dictionaryPopup/types';
import type { PronunciationSettings } from '@/entities/settings/types';
import type { SrsAudioAsset } from '@/entities/srs/types';
import { generateId } from '@/features/srs/lib/helpers';
import { PronunciationAudioOrchestrator } from '@/features/pronunciation/services/pronunciationAudioOrchestrator';
import { getAudioAssetsByNote, putAudioAsset } from '@/features/srs/repositories/audioAssetRepository';
import { evictAudioIfNeeded, touchAudioAsset } from './quotaManager';
import { fetchMediaAsArrayBuffer } from './fetchMedia';

export interface ResolvedAudio {
  readonly bytes: ArrayBuffer;
  readonly mimeType: string;
  readonly source: SrsAudioAsset['source'];
}

function makeSrsMimeType(source: SrsAudioAsset['source'], fallback: string): string {
  if (source === 'tts') return 'audio/mpeg';
  return fallback || 'audio/mpeg';
}

function buildAssetId(noteId: string, fieldId: string, source: SrsAudioAsset['source']): string {
  return `${noteId}-${fieldId}-${source}-${generateId()}`;
}

/** Find a cached audio asset for the given note and field. */
export async function getCachedAudioAsset(noteId: string, fieldId: string): Promise<SrsAudioAsset | undefined> {
  const assets = await getAudioAssetsByNote(noteId);
  const asset = assets.find((a) => a.fieldId === fieldId);
  if (!asset) return undefined;
  await touchAudioAsset(asset.id);
  return asset;
}

/** Store audio bytes as an asset, update LRU, and run eviction. */
export async function storeAudioAsset(
  noteId: string,
  fieldId: string,
  bytes: ArrayBuffer,
  mimeType: string,
  source: SrsAudioAsset['source'],
): Promise<SrsAudioAsset> {
  const existing = await findExisting(noteId, fieldId, source);
  const asset: SrsAudioAsset = {
    id: existing?.id ?? buildAssetId(noteId, fieldId, source),
    noteId,
    fieldId,
    source,
    mimeType,
    bytes,
    size: bytes.byteLength,
    lastAccessed: Date.now(),
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await putAudioAsset(asset);
  await evictAudioIfNeeded(50, new Set([asset.id]));
  return asset;
}

async function findExisting(
  noteId: string,
  fieldId: string,
  source: SrsAudioAsset['source'],
): Promise<SrsAudioAsset | undefined> {
  const assets = await getAudioAssetsByNote(noteId);
  return assets.find((a) => a.fieldId === fieldId && a.source === source);
}

/** Fetch word audio through the pronunciation fallback chain and store it. */
export async function fetchAndCacheWordAudio(
  noteId: string,
  fieldId: string,
  term: string,
  langCode: string,
  settings: PronunciationSettings,
): Promise<SrsAudioAsset | undefined> {
  const cached = await getCachedAudioAsset(noteId, fieldId);
  if (cached) return cached;

  const orchestrator = new PronunciationAudioOrchestrator(settings);
  const items = await orchestrator.resolve(term, langCode);
  const selected = items.find((i) => i.defaultSelected) ?? items[0];
  if (!selected || (!selected.audioBytes && !selected.url)) return undefined;

  const bytes = selected.audioBytes
    ? selected.audioBytes.slice().buffer
    : await fetchMediaAsArrayBuffer(selected.url!);
  const source: SrsAudioAsset['source'] = selected.source === 'espeak' ? 'pronunciation' : 'tts';
  const mime = makeSrsMimeType(source, selected.url ? '' : 'audio/wav');
  return storeAudioAsset(noteId, fieldId, bytes, mime, source);
}

/** Fetch sentence audio through the TTS fallback and store it. */
export async function fetchAndCacheSentenceAudio(
  noteId: string,
  fieldId: string,
  text: string,
  langCode: string,
): Promise<SrsAudioAsset | undefined> {
  const cached = await getCachedAudioAsset(noteId, fieldId);
  if (cached) return cached;

  const res = await sendMessage<MessageResponse<TtsFetchAudioResponse>>({
    type: MESSAGE_TYPES.TTS_FETCH_AUDIO,
    payload: { tabId: 0, text, langCode },
  });
  if (!res?.success || !res.data?.url) return undefined;

  const bytes = await fetchMediaAsArrayBuffer(res.data.url);
  return storeAudioAsset(noteId, fieldId, bytes, 'audio/mpeg', 'tts');
}
