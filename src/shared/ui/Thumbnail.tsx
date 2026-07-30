import { useState, type ImgHTMLAttributes } from 'react';
import { Skeleton } from './Skeleton';
import styles from './Thumbnail.module.css';

type ThumbnailRatio = '1:1' | '4:3' | '16:9' | '3:2';

export interface ThumbnailProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Image source URL. */
  src: string;
  /** Alt text — required for accessibility. */
  alt: string;
  /** Aspect ratio. Default: 1:1. */
  ratio?: ThumbnailRatio;
  /** Fallback src used when the primary image fails to load. */
  fallbackSrc?: string;
  /** Show a skeleton placeholder while loading. Default: true. */
  showSkeleton?: boolean;
}

const RATIO_CLASS: Record<ThumbnailRatio, string> = {
  '1:1': styles.ratio1x1,
  '4:3': styles.ratio4x3,
  '16:9': styles.ratio16x9,
  '3:2': styles.ratio3x2,
};

/**
 * Thumbnail — image with aspect-ratio container, skeleton loading state,
 * and onError fallback.
 */
export function Thumbnail({
  src,
  alt,
  ratio = '1:1',
  fallbackSrc,
  showSkeleton = true,
  className,
  ...rest
}: ThumbnailProps): React.JSX.Element {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [usingFallback, setUsingFallback] = useState(false);

  const currentSrc = usingFallback && fallbackSrc ? fallbackSrc : src;

  const handleError = (): void => {
    if (fallbackSrc && !usingFallback) {
      setUsingFallback(true);
      setStatus('loading');
    } else {
      setStatus('error');
    }
  };

  const cls = [styles.thumbnail, RATIO_CLASS[ratio], className ?? ''].filter(Boolean).join(' ');

  return (
    <span className={cls}>
      {showSkeleton && status === 'loading' && (
        <Skeleton className={styles.skeleton} aria-hidden="true" />
      )}
      {status === 'error' && !fallbackSrc ? (
        <span className={styles.fallback} role="img" aria-label={alt}>
          <svg className={styles.fallbackIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z"
              fill="currentColor"
            />
          </svg>
        </span>
      ) : (
        <img
          className={styles.img}
          src={currentSrc}
          alt={alt}
          onLoad={() => setStatus('loaded')}
          onError={handleError}
          {...rest}
        />
      )}
    </span>
  );
}
