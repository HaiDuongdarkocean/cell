import type { HTMLAttributes, ReactNode } from 'react';
import styles from './PartOfSpeechTag.module.css';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'conjunction'
  | 'pronoun'
  | 'interjection';

export interface PartOfSpeechTagProps extends HTMLAttributes<HTMLSpanElement> {
  /** The part of speech type. Controls tint color coding. */
  type: PartOfSpeech;
  children: ReactNode;
  /** Tag size. sm uses --font-size-2xs, md uses --font-size-xs. */
  size?: 'sm' | 'md';
}

/**
 * PartOfSpeechTag — pill-shaped label for a word's part of speech.
 * 8 types with tint color coding: noun, verb, adjective, adverb,
 * preposition, conjunction, pronoun, interjection.
 */
export function PartOfSpeechTag({ type, children, className, size = 'md', ...rest }: PartOfSpeechTagProps): React.JSX.Element {
  const cls = [styles.tag, styles[type], styles[size], className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-label={`Part of speech: ${type}`} {...rest}>
      {children}
    </span>
  );
}
