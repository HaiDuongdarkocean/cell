import type { HTMLAttributes, ReactNode } from 'react';
import styles from './WordTitle.module.css';

type HeadingLevel = 1 | 2 | 3;

export interface WordTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Heading level. Default: 2. */
  level?: HeadingLevel;
  /** Optional phonetic text rendered inline after the word. */
  phonetic?: ReactNode;
  /** id for aria-labelledby wiring. */
  id?: string;
  children: ReactNode;
}

/**
 * WordTitle — semantic heading for a dictionary entry word.
 * Renders `<h1|h2|h3>` with heading font family and optional inline phonetic.
 */
export function WordTitle({
  level = 2,
  phonetic,
  id,
  children,
  className,
  ...rest
}: WordTitleProps): React.JSX.Element {
  const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');
  const cls = [styles.title, styles[`level${level}`], className ?? ''].filter(Boolean).join(' ');

  return (
    <Tag id={id} className={cls} {...rest}>
      <span className={styles.word}>{children}</span>
      {phonetic && <span className={styles.phonetic}>{phonetic}</span>}
    </Tag>
  );
}
