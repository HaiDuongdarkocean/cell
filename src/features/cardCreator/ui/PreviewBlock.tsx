import type { ReactElement, ReactNode } from 'react';
import styles from './PreviewBlock.module.css';

export interface PreviewBlockProps {
  readonly targetWord: string;
  readonly sentence: string;
  readonly testId?: string;
}

export function PreviewBlock({ targetWord, sentence, testId }: PreviewBlockProps): ReactElement {
  const highlightedSentence = highlightOccurrences(sentence, targetWord);
  return (
    <div
      className={styles.previewBlock}
      aria-label="Preview"
      role="region"
      data-testid={testId}
    >
      <div className={styles.previewTarget}>{targetWord}</div>
      <div className={styles.previewSentence}>{highlightedSentence}</div>
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
