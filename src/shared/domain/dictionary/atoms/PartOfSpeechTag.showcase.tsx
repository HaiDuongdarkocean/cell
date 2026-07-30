import { PartOfSpeechTag } from './PartOfSpeechTag';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const types = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection'] as const;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {types.map((type) => (
        <PartOfSpeechTag key={type} type={type}>{type}</PartOfSpeechTag>
      ))}
    </div>
  );
}

export const showcaseMeta = {
  title: 'PartOfSpeechTag',
  group: 'Domain — Dictionary',
  order: 83,
};
