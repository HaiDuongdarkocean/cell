import type { SrtCue } from '@/entities/media';

export const autoLoadSubtitleCache = new Map<string, { cues: SrtCue[]; format: string }>();

export function clearAutoLoadCache(): void {
  autoLoadSubtitleCache.clear();
}
