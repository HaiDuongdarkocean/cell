import type { HTMLAttributes, ReactNode } from 'react';
import styles from './AspectRatio.module.css';

interface AspectRatioProps extends HTMLAttributes<HTMLDivElement> {
  /** Width-to-height ratio (e.g. 16 for 16:9, 1 for square). Default: 16. */
  ratio?: number;
  /** Content positioned absolutely inside the ratio box. */
  children?: ReactNode;
}

/**
 * AspectRatio — constrains a box to a fixed width-to-height ratio so content
 * (images, video, embeds) fills a predictable shape without layout shift.
 * Children are absolutely positioned to fill the box.
 */
export function AspectRatio({
  ratio = 16,
  children,
  className,
  style,
  ...rest
}: AspectRatioProps): React.JSX.Element {
  const cls = [styles.box, className ?? ''].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={{ ...style, paddingTop: `${(100 / ratio)}%` }}
      {...rest}
    >
      <div className={styles.content}>{children}</div>
    </div>
  );
}
