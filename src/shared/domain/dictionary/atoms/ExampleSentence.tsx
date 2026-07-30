import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ExampleSentence.module.css';

export interface ExampleSentenceProps extends HTMLAttributes<HTMLElement> {
  /** When true, renders a `<blockquote>`. Otherwise renders a `<p>`. Default: false. */
  blockquote?: boolean;
  /** A word to highlight within the sentence using `<mark>`. */
  highlight?: string;
  /** Optional translation rendered below the sentence. */
  translation?: ReactNode;
  children: ReactNode;
}

/**
 * ExampleSentence — renders an example sentence in italic with optional word
 * highlight and translation. Uses `--color-text-secondary`.
 */
export function ExampleSentence({
  blockquote = false,
  highlight,
  translation,
  children,
  className,
  ...rest
}: ExampleSentenceProps): React.JSX.Element {
  const cls = [styles.sentence, className ?? ''].filter(Boolean).join(' ');

  const renderContent = (): ReactNode => {
    if (!highlight) return children;
    const text = typeof children === 'string' ? children : '';
    if (!text) return children;
    const parts = text.split(highlight);
    return parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < parts.length - 1 && <mark className={styles.mark}>{highlight}</mark>}
      </span>
    ));
  };

  const inner = (
    <>
      <span className={styles.text}>{renderContent()}</span>
      {translation && <span className={styles.translation}>{translation}</span>}
    </>
  );

  if (blockquote) {
    return (
      <blockquote className={cls} {...(rest as HTMLAttributes<HTMLQuoteElement>)}>
        {inner}
      </blockquote>
    );
  }

  return (
    <p className={cls} {...(rest as HTMLAttributes<HTMLParagraphElement>)}>
      {inner}
    </p>
  );
}
