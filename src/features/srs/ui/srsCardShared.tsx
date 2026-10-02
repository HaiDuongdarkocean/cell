import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { useDragScroll } from '@/shared/ui/useDragScroll';
import { t } from '@/shared/i18n';
import { mediaFieldValues } from '@/features/srs/lib/helpers';
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

export function useResolvedImageUrls(
  items: readonly { src: string; asset: SrsImageAsset | undefined }[],
): readonly (string | undefined)[] {
  const urls = useMemo(
    () => items.map(({ src, asset }) => {
      const direct = playableUrl(src);
      if (direct) return direct;
      return asset ? URL.createObjectURL(new Blob([asset.bytes], { type: asset.mimeType })) : undefined;
    }),
    [items],
  );
  useEffect(() => () => {
    urls.forEach((url, i) => {
      if (url && !playableUrl(items[i].src)) URL.revokeObjectURL(url);
    });
  }, [urls, items]);
  return urls;
}

export interface GalleryItem {
  readonly key: string;
  readonly src: string;
  readonly asset: SrsImageAsset | undefined;
}

export function ReviewImageGallery({ items, alt, dataCellId }: {
  readonly items: readonly GalleryItem[];
  readonly alt: string;
  readonly dataCellId?: string;
}): React.JSX.Element | null {
  const urls = useResolvedImageUrls(items);
  const stripRef = useDragScroll<HTMLDivElement>();
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const visible = items
    .map((item, i) => ({ item, url: urls[i] }))
    .filter((x): x is { item: GalleryItem; url: string } => Boolean(x.url));

  useEffect(() => {
    if (zoomIdx === null) return;
    if (visible.length === 0) { setZoomIdx(null); return; }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      setZoomIdx((p) => p === null ? p : (e.key === 'ArrowLeft' ? (p - 1 + visible.length) % visible.length : (p + 1) % visible.length));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoomIdx, visible.length]);

  if (visible.length === 0) return null;
  const zoomPos = zoomIdx === null ? null : Math.min(zoomIdx, visible.length - 1);

  return (
    <>
      <div ref={stripRef} className={styles.imageStrip} data-cell-id={dataCellId}>
        {visible.map(({ item, url }, pos) => (
          <button
            key={item.key}
            type="button"
            className={styles.imageItem}
            aria-label={t('srs.review.zoomImage')}
            onClick={(e) => { e.stopPropagation(); setZoomIdx(pos); }}
          >
            <img src={url} alt={alt} className={styles.image} draggable={false} />
          </button>
        ))}
      </div>
      <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <Dialog
        open={zoomPos !== null}
        onOpenChange={(open) => { if (!open) setZoomIdx(null); }}
        title={alt}
        showCloseButton
        size="xl"
        data-cell-id="srs-image-zoom"
      >
        {zoomPos !== null && (
          <Box className={styles.zoomStage}>
            <img src={visible[zoomPos].url} alt={alt} className={styles.zoomImage} draggable={false} />
            {visible.length > 1 && (
              <Box className={styles.zoomNav}>
                <Button
                  variant="ghost"
                  shape="circle"
                  aria-label={t('srs.review.prevImage')}
                  onClick={() => setZoomIdx((zoomPos - 1 + visible.length) % visible.length)}
                >
                  <Icon name="chevronLeft" />
                </Button>
                <Text className={styles.zoomCount}>{zoomPos + 1} / {visible.length}</Text>
                <Button
                  variant="ghost"
                  shape="circle"
                  aria-label={t('srs.review.nextImage')}
                  onClick={() => setZoomIdx((zoomPos + 1) % visible.length)}
                >
                  <Icon name="chevronRight" />
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Dialog>
      </div>
    </>
  );
}

export function formatFieldValue(value: SrsFieldValue): string {
  if (value.kind === 'list') return value.value.join(', ');
  if (value.kind === 'audio' || value.kind === 'image') return mediaFieldValues(value)[0] ?? '';
  return value.value;
}

export function SentenceText({ sentence }: { sentence: string }): React.JSX.Element {
  return <Text className={styles.sentence}>{sentence}</Text>;
}
