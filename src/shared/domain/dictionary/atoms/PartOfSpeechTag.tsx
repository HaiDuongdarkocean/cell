import type { HTMLAttributes, ReactNode } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
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

const POS_LABELS: Record<PartOfSpeech, MessageKey> = {
  noun: 'dict.pos.noun',
  verb: 'dict.pos.verb',
  adjective: 'dict.pos.adjective',
  adverb: 'dict.pos.adverb',
  preposition: 'dict.pos.preposition',
  conjunction: 'dict.pos.conjunction',
  pronoun: 'dict.pos.pronoun',
  interjection: 'dict.pos.interjection',
};

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
    <span className={cls} aria-label={t('dict.atom.partOfSpeech', [t(POS_LABELS[type])])} {...rest}>
      {children}
    </span>
  );
}
