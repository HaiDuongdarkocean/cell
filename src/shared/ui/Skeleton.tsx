import type { HTMLAttributes } from 'react';
import styles from './Skeleton.module.css';

type SkeletonShape = 'circle' | 'rounded' | 'rect';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Width as CSS length. */
  width?: string | number;
  /** Height as CSS length. */
  height?: string | number;
  /** Shape. Default: rect. */
  shape?: SkeletonShape;
}

/**
 * Skeleton — placeholder shape for loading content.
 */
export function Skeleton({ width, height, shape = 'rect', className, style, ...rest }: SkeletonProps): React.JSX.Element {
  const cls = [styles.skeleton, styles[shape], className ?? ''].filter(Boolean).join(' ');
  const combinedStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <div className={cls} style={combinedStyle} aria-hidden="true" {...rest} />
  );
}
