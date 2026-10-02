import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  CloseButton,
  Overlay,
  PaginationDots,
  Portal,
  Text,
  useFocusTrap,
} from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
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

const MAX_IMAGE_ZOOM = 4;
const ZOOM_STEP = 1.25;

export function ReviewImageGallery({ items, alt, dataCellId }: {
  readonly items: readonly GalleryItem[];
  readonly alt: string;
  readonly dataCellId?: string;
}): React.JSX.Element | null {
  const urls = useResolvedImageUrls(items);
  const [stripEl, setStripEl] = useState<HTMLDivElement | null>(null);
  const [activePos, setActivePos] = useState(0);
  const [itemStep, setItemStep] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ id: number; startX: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const wheelAcc = useRef(0);
  const activityRef = useRef(0);
  const pausedRef = useRef(false);
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const zoomImgRef = useRef<HTMLImageElement>(null);
  const panStart = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  const visible = items
    .map((item, i) => ({ item, url: urls[i] }))
    .filter((x): x is { item: GalleryItem; url: string } => Boolean(x.url));

  const zoomPos = zoomIdx === null ? null : Math.min(zoomIdx, Math.max(0, visible.length - 1));
  useFocusTrap(lightboxRef, zoomPos !== null);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPanning(false);
  }, [zoomPos]);

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

  const applyZoom = (next: number): void => {
    setZoom(Math.min(MAX_IMAGE_ZOOM, Math.max(1, next)));
  };

  useEffect(() => {
    const img = zoomImgRef.current;
    if (!img || zoomPos === null) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      setZoom((z) => Math.min(MAX_IMAGE_ZOOM, Math.max(1, e.deltaY < 0 ? z * ZOOM_STEP : z / ZOOM_STEP)));
    };
    img.addEventListener('wheel', onWheel, { passive: false });
    return () => img.removeEventListener('wheel', onWheel);
  }, [zoomPos]);

  useEffect(() => {
    const img = zoomImgRef.current;
    const stage = lightboxRef.current;
    setPan((p) => {
      if (zoom <= 1 || !img || !stage) return { x: 0, y: 0 };
      const maxX = Math.max(0, (img.offsetWidth * zoom - stage.clientWidth) / 2);
      const maxY = Math.max(0, (img.offsetHeight * zoom - stage.clientHeight) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, p.x)),
        y: Math.min(maxY, Math.max(-maxY, p.y)),
      };
    });
  }, [zoom]);

  const clampedPan = (x: number, y: number): { x: number; y: number } => {
    const img = zoomImgRef.current;
    const stage = lightboxRef.current;
    if (!img || !stage) return { x, y };
    const maxX = Math.max(0, (img.offsetWidth * zoom - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * zoom - stage.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  useEffect(() => {
    if (!stripEl) return;
    const measure = (): void => {
      setItemStep(stripEl.clientWidth * 0.58 * 0.32);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stripEl);
    return () => ro.disconnect();
  }, [stripEl, visible.length]);

  useEffect(() => {
    if (!stripEl || visible.length <= 1) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      activityRef.current = Date.now();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wheelAcc.current += delta;
      if (Math.abs(wheelAcc.current) >= 60) {
        const dir = wheelAcc.current > 0 ? 1 : -1;
        wheelAcc.current = 0;
        setActivePos((p) => (p + dir + visible.length) % visible.length);
      }
    };
    stripEl.addEventListener('wheel', onWheel, { passive: false });
    return () => stripEl.removeEventListener('wheel', onWheel);
  }, [stripEl, visible.length]);

  useEffect(() => {
    const gallery = stripEl?.parentElement;
    if (!stripEl || !gallery || visible.length <= 1) return;
    const mark = (): void => { activityRef.current = Date.now(); };
    const pause = (): void => { pausedRef.current = true; };
    const resume = (): void => { pausedRef.current = false; };
    const interval = setInterval(() => {
      if (pausedRef.current || document.hidden || zoomPos !== null) return;
      if (Date.now() - activityRef.current < 3000) return;
      setActivePos((p) => (p + 1) % visible.length);
    }, 2000);
    stripEl.addEventListener('pointerdown', mark);
    stripEl.addEventListener('touchmove', mark, { passive: true });
    gallery.addEventListener('pointerenter', pause);
    gallery.addEventListener('pointerleave', resume);
    gallery.addEventListener('focusin', pause);
    gallery.addEventListener('focusout', resume);
    return () => {
      clearInterval(interval);
      stripEl.removeEventListener('pointerdown', mark);
      stripEl.removeEventListener('touchmove', mark);
      gallery.removeEventListener('pointerenter', pause);
      gallery.removeEventListener('pointerleave', resume);
      gallery.removeEventListener('focusin', pause);
      gallery.removeEventListener('focusout', resume);
    };
  }, [stripEl, visible.length, zoomPos]);

  const cycOffset = (i: number): number => {
    const n = visible.length;
    const d = ((i - activePos) % n + n) % n;
    return d > n / 2 ? d - n : d;
  };

  if (visible.length === 0) return null;

  return (
    <>
      <div className={styles.imageGallery} onClick={(e) => e.stopPropagation()}>
      <div
        ref={setStripEl}
        className={`${styles.imageStrip} ${dragging ? styles.imageStripDragging : ''}`}
        data-cell-id={dataCellId}
        onPointerDown={(e) => {
          if (visible.length <= 1 || e.button !== 0) return;
          dragRef.current = { id: e.pointerId, startX: e.clientX, moved: false };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d || d.id !== e.pointerId) return;
          const delta = e.clientX - d.startX;
          if (!d.moved && Math.abs(delta) >= 4) {
            d.moved = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
          }
          if (d.moved) setDragX(delta);
        }}
        onPointerUp={(e) => {
          const d = dragRef.current;
          if (!d || d.id !== e.pointerId) return;
          dragRef.current = null;
          suppressClickRef.current = d.moved;
          setDragging(false);
          const steps = itemStep > 0 ? Math.round(dragX / itemStep) : 0;
          setDragX(0);
          if (steps !== 0) {
            setActivePos((p) => ((p - steps) % visible.length + visible.length) % visible.length);
          }
        }}
        onPointerCancel={(e) => {
          if (dragRef.current?.id !== e.pointerId) return;
          dragRef.current = null;
          setDragging(false);
          setDragX(0);
        }}
      >
        {visible.map(({ item, url }, pos) => {
          const off = cycOffset(pos) + (itemStep > 0 ? dragX / itemStep : 0);
          const abs = Math.abs(off);
          return (
          <button
            key={item.key}
            type="button"
            className={styles.imageItem}
            style={{
              transform: `translateX(-50%) translateX(${off * itemStep}px) scale(${1 - 0.3 * Math.min(abs, 1)})`,
              opacity: abs > 1.5 ? 0 : 1,
              zIndex: 100 - Math.round(abs * 10),
              pointerEvents: abs > 1.5 ? 'none' : undefined,
              boxShadow: abs < 0.5 ? 'var(--shadow-lg)' : undefined,
            }}
            aria-label={t('srs.review.zoomImage')}
            aria-current={pos === activePos}
            onClick={(e) => {
              e.stopPropagation();
              if (suppressClickRef.current) { suppressClickRef.current = false; return; }
              activityRef.current = Date.now();
              if (pos === activePos) setZoomIdx(pos);
              else setActivePos(pos);
            }}
          >
            <img src={url} alt={alt} className={styles.image} draggable={false} />
          </button>
          );
        })}
      </div>
      {visible.length > 1 && (
        <>
          <Button
            variant="ghost"
            shape="circle"
            size="sm"
            aria-label={t('srs.review.prevImage')}
            className={`${styles.stripArrow} ${styles.stripPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              activityRef.current = Date.now();
              setActivePos((activePos - 1 + visible.length) % visible.length);
            }}
          >
            <Icon name="chevronLeft" />
          </Button>
          <Button
            variant="ghost"
            shape="circle"
            size="sm"
            aria-label={t('srs.review.nextImage')}
            className={`${styles.stripArrow} ${styles.stripNext}`}
            onClick={(e) => {
              e.stopPropagation();
              activityRef.current = Date.now();
              setActivePos((activePos + 1) % visible.length);
            }}
          >
            <Icon name="chevronRight" />
          </Button>
        </>
      )}
      </div>
      <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {zoomPos !== null && (
          <Portal>
            <Overlay
              elevation="high"
              data-cell-id="srs-image-zoom"
              onClick={(e) => { if (e.target === e.currentTarget) setZoomIdx(null); }}
              onClose={() => setZoomIdx(null)}
            >
              <div
                ref={lightboxRef}
                className={styles.lightbox}
                role="dialog"
                aria-modal="true"
                aria-label={alt}
              >
                <div className={styles.lightboxStage}>
                  <img
                    ref={zoomImgRef}
                    src={visible[zoomPos].url}
                    alt={alt}
                    draggable={false}
                    className={`${styles.lightboxImage} ${zoom > 1 ? styles.lightboxImageZoomed : ''} ${panning ? styles.lightboxImagePanning : ''}`}
                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                    onPointerDown={(e) => {
                      if (zoom <= 1) return;
                      e.preventDefault();
                      panStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setPanning(true);
                    }}
                    onPointerMove={(e) => {
                      const s = panStart.current;
                      if (!s || s.id !== e.pointerId) return;
                      setPan(clampedPan(s.px + e.clientX - s.x, s.py + e.clientY - s.y));
                    }}
                    onPointerUp={(e) => {
                      if (panStart.current?.id === e.pointerId) { panStart.current = null; setPanning(false); }
                    }}
                    onPointerCancel={() => { panStart.current = null; setPanning(false); }}
                    onDoubleClick={(e) => { e.preventDefault(); applyZoom(zoom > 1 ? 1 : 2.5); }}
                  />
                </div>
                <CloseButton className={styles.lightboxClose} onClick={() => setZoomIdx(null)} />
                {visible.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      shape="circle"
                      aria-label={t('srs.review.prevImage')}
                      className={`${styles.lightboxArrow} ${styles.lightboxPrev}`}
                      onClick={() => setZoomIdx((zoomPos - 1 + visible.length) % visible.length)}
                    >
                      <Icon name="chevronLeft" />
                    </Button>
                    <Button
                      variant="ghost"
                      shape="circle"
                      aria-label={t('srs.review.nextImage')}
                      className={`${styles.lightboxArrow} ${styles.lightboxNext}`}
                      onClick={() => setZoomIdx((zoomPos + 1) % visible.length)}
                    >
                      <Icon name="chevronRight" />
                    </Button>
                    <PaginationDots
                      className={styles.lightboxDots}
                      count={visible.length}
                      active={zoomPos}
                      onSelect={setZoomIdx}
                      label={`${zoomPos + 1} / ${visible.length}`}
                      itemLabel={(i) => t('srs.review.goToImage', [String(i + 1)])}
                    />
                  </>
                )}
                <div className={styles.lightboxZoom}>
                  <Button
                    variant="ghost"
                    shape="circle"
                    aria-label={t('srs.review.zoomOut')}
                    disabled={zoom <= 1}
                    onClick={() => applyZoom(zoom / ZOOM_STEP)}
                  >
                    <Icon name="minus" />
                  </Button>
                  <Button
                    variant="ghost"
                    shape="circle"
                    aria-label={t('srs.review.zoomIn')}
                    disabled={zoom >= MAX_IMAGE_ZOOM}
                    onClick={() => applyZoom(zoom * ZOOM_STEP)}
                  >
                    <Icon name="plus" />
                  </Button>
                </div>
              </div>
            </Overlay>
          </Portal>
        )}
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
