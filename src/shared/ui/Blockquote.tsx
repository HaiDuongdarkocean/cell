import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Blockquote.module.css';

type BlockquoteVariant = 'default' | 'bordered';

export interface BlockquoteProps extends HTMLAttributes<HTMLQuoteElement> {
  /** Visual variant. Default: default. */
  variant?: BlockquoteVariant;
  /** Optional cite URL — sets the `cite` attribute for machine readability. */
  cite?: string;
  /** Optional citation text rendered via `<cite>` inside the blockquote. */
  citation?: ReactNode;
  /** Quote content. */
  children: ReactNode;
}

/**
 * Blockquote — semantic `<blockquote>` with optional cite URL and citation text.
 * `bordered` variant adds a left accent border.
 */
export function Blockquote({
  variant = 'default',
  cite,
  citation,
  children,
  className,
  ...rest
}: BlockquoteProps): React.JSX.Element {
  const cls = [styles.blockquote, styles[variant], className ?? ''].filter(Boolean).join(' ');

  return (
    <blockquote className={cls} cite={cite} {...rest}>
      <span className={styles.content}>{children}</span>
      {citation && <cite className={styles.citation}>{citation}</cite>}
    </blockquote>
  );
}
