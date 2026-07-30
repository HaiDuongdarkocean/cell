import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Citation.module.css';

export interface CitationProps extends HTMLAttributes<HTMLElement> {
  /** Optional URL — when provided, wraps the `<cite>` in an `<a>` link. */
  href?: string;
  /** Citation content. */
  children: ReactNode;
}

/**
 * Citation — semantic `<cite>` element for referencing a creative work.
 * When `href` is provided, the `<cite>` is wrapped in an `<a>` for navigation.
 */
export function Citation({
  href,
  children,
  className,
  ...rest
}: CitationProps): React.JSX.Element {
  const cls = [styles.citation, className ?? ''].filter(Boolean).join(' ');

  if (href) {
    return (
      <a className={styles.link} href={href} rel="noopener noreferrer">
        <cite className={cls} {...rest}>
          {children}
        </cite>
      </a>
    );
  }

  return (
    <cite className={cls} {...rest}>
      {children}
    </cite>
  );
}
