import { PronunciationButton } from './PronunciationButton';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <PronunciationButton word="hello" />
      <PronunciationButton word="serendipity" audioUrl="https://example.com/serendipity.mp3" />
      <PronunciationButton word="loading" loading />
    </div>
  );
}

export const showcaseMeta = {
  title: 'PronunciationButton',
  group: 'Domain — Dictionary',
  order: 82,
};
