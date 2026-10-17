import type { PronunciationSettings } from '@/entities/settings/types';
import type { SrsAudioAsset } from '@/entities/srs/types';
import { generateId } from '@/features/srs/lib/helpers';
import { PronunciationAudioOrchestrator, resolveSentenceAudioItems } from '@/features/pronunciation';
import { getAudioAssetsByNote, putAudioAsset } from '@/features/srs/repositories/audioAssetRepository';
import { evictAudioIfNeeded, touchAudioAsset, getCachedAsset, findExistingAsset, persistAsset } from './quotaManager';
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
export async function getCachedAudioAsset(noteId: string, fieldId: string, index = 0): Promise<SrsAudioAsset | undefined> {
  return getCachedAsset(getAudioAssetsByNote, touchAudioAsset, noteId, fieldId, index);
}

/** Store audio bytes as an asset, update LRU, and run eviction. */
export async function storeAudioAsset(
  noteId: string,
  fieldId: string,
  bytes: ArrayBuffer,
  mimeType: string,
  source: SrsAudioAsset['source'],
  index = 0,
): Promise<SrsAudioAsset> {
  const existing = await findExisting(noteId, fieldId, source, index);
  const asset: SrsAudioAsset = {
    id: existing?.id ?? buildAssetId(noteId, fieldId, source),
    noteId,
    fieldId,
    index: index || undefined,
    source,
    mimeType,
    bytes,
    size: bytes.byteLength,
    lastAccessed: Date.now(),
    createdAt: existing?.createdAt ?? Date.now(),
  };
  return persistAsset(putAudioAsset, (ids) => evictAudioIfNeeded(50, ids), asset);
}

async function findExisting(
  noteId: string,
  fieldId: string,
  source: SrsAudioAsset['source'],
  index: number,
): Promise<SrsAudioAsset | undefined> {
  return findExistingAsset(getAudioAssetsByNote, noteId, fieldId, index, (a) => a.source === source);
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

/** Fetch sentence audio through the pronunciation chain (cloud voices +
 *  browser voice only) and store it. */
export async function fetchAndCacheSentenceAudio(
  noteId: string,
  fieldId: string,
  text: string,
  langCode: string,
): Promise<SrsAudioAsset | undefined> {
  const cached = await getCachedAudioAsset(noteId, fieldId);
  if (cached) return cached;

  const items = await resolveSentenceAudioItems(text, langCode);
  const selected = items[0];
  if (!selected || (!selected.audioBytes && !selected.url)) return undefined;

  const bytes = selected.audioBytes
    ? selected.audioBytes.slice().buffer
    : await fetchMediaAsArrayBuffer(selected.url!);
  const mime = selected.audioBytes ? 'audio/wav' : makeSrsMimeType('tts', '');
  return storeAudioAsset(noteId, fieldId, bytes, mime, 'tts');
}
