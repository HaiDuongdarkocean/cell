import type { ReactElement, ReactNode } from 'react';
import styles from './PreviewBlock.module.css';

export interface PreviewBlockProps {
  readonly targetWord: string;
  readonly sentence: string;
  readonly dataId?: string;
}

export function PreviewBlock({ targetWord, sentence, dataId }: PreviewBlockProps): ReactElement {
  const highlightedSentence = highlightOccurrences(sentence, targetWord);
  return (
    <div
      className={styles['cc-preview']}
      aria-label="Preview"
      role="region"
      data-testid={dataId}
    >
      <div className={styles['cc-preview__target']}>{targetWord}</div>
      <div className={styles['cc-preview__sentence']}>{highlightedSentence}</div>
    </div>
  );
}

function highlightOccurrences(sentence: string, target: string): ReactNode {
  if (!target.trim()) return sentence;
  const parts = sentence.split(target);
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 && <strong>{target}</strong>}
        </span>
      ))}
    </>
  );
}
