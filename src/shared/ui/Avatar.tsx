import { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import styles from './Avatar.module.css';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';
type AvatarShape = 'circle' | 'square';
type AvatarStatus = 'online' | 'offline' | 'busy' | 'none';

interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Image URL. */
  src?: string;
  /** Alt text / fallback initials (1-2 chars). */
  alt: string;
  /** Size. Default: md. */
  size?: AvatarSize;
  /** Shape. Default: circle. */
  shape?: AvatarShape;
  /** Status indicator dot. Default: none. */
  status?: AvatarStatus;
  /** Extra class names. */
  className?: string;
}

/**
 * Avatar — user image with initials fallback and optional status dot.
 *
 * Sizes: xs (24), sm (32), md (40), lg (56).
 * Shapes: circle, square.
 * Status: online, offline, busy, none.
 */
export function Avatar({
  src,
  alt,
  size = 'md',
  shape = 'circle',
  status = 'none',
  className,
  ...rest
}: AvatarProps): React.JSX.Element {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;
  const initials = alt.trim().slice(0, 2).toUpperCase();

  const cls = [
    styles.avatar,
    styles[size],
    styles[shape],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={cls}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className={styles.image}
          onError={() => setErrored(true)}
          {...rest}
        />
      ) : (
        <span className={styles.fallback} aria-hidden="true">
          {initials}
        </span>
      )}
      {status !== 'none' && (
        <span
          className={`${styles.statusDot} ${styles[status] ?? ''}`.trim()}
          aria-label={`status: ${status}`}
        />
      )}
    </span>
  );
}
