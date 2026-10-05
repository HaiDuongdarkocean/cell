import type { SrtCue } from '@/entities/media';
import { LruCache } from '@/shared/lib/lruCache';

const MAX_ENTRIES = 12;

export const autoLoadSubtitleCache = new LruCache<string, { cues: SrtCue[]; format: string }>(MAX_ENTRIES);

export function clearAutoLoadCache(): void {
  autoLoadSubtitleCache.clear();
}
