import { useMemo } from 'react';
import { Text } from '@/shared/ui';
import { escapeRegExp, normalizeSpelling } from '@/features/srs/lib/helpers';
import type { SrsAudioAsset, SrsFieldValue, SrsImageAsset } from '@/entities/srs/types';
import styles from './SrsReviewCard.module.css';

export function playAudio(asset: SrsAudioAsset): void {
  const blob = new Blob([asset.bytes], { type: asset.mimeType });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play().catch(() => {});
  audio.onended = () => {
    URL.revokeObjectURL(url);
  };
}

export function playAudioUrl(url: string): void {
  void new Audio(url).play().catch(() => {});
}

export function playableUrl(value: string): string | undefined {
  return /^(data:|https?:|blob:)/.test(value) ? value : undefined;
}

export function sequentialAudio(sources: readonly (SrsAudioAsset | string)[]): () => void {
  let cancelled = false;
  let current: HTMLAudioElement | null = null;
  const run = async (): Promise<void> => {
    for (const src of sources) {
      if (cancelled) return;
      const url = typeof src === 'string'
        ? src
        : URL.createObjectURL(new Blob([src.bytes], { type: src.mimeType }));
      const audio = new Audio(url);
      current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().then(() => undefined, () => resolve());
      });
      current = null;
      if (typeof src !== 'string') URL.revokeObjectURL(url);
    }
  };
  void run();
  return () => {
    cancelled = true;
    current?.pause();
  };
}

export function useImageBlobUrl(asset: SrsImageAsset | undefined): string | undefined {
  return useMemo(() => {
    if (!asset) return undefined;
    const blob = new Blob([asset.bytes], { type: asset.mimeType });
    return URL.createObjectURL(blob);
  }, [asset]);
}

export function formatFieldValue(value: SrsFieldValue): string {
  if (value.kind === 'list') return value.value.join(', ');
  return value.value;
}

export function HighlightedSentence({ sentence, target }: { sentence: string; target: string }): React.JSX.Element {
  const normalizedTarget = normalizeSpelling(target);
  const regex = new RegExp(`(${escapeRegExp(normalizedTarget)})`, 'gi');
  const parts = sentence.split(regex);
  return (
    <Text className={styles.sentence}>
      {parts.map((part, i) =>
        normalizeSpelling(part) === normalizedTarget ? (
          <strong key={i} className={styles.sentenceTarget}>{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </Text>
  );
}
