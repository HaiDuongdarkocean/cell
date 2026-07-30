import { WordTitle } from './WordTitle';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <WordTitle level={1} phonetic="/həˈloʊ/">hello</WordTitle>
      <WordTitle level={2} phonetic="/ˌserənˈdɪpəti/">serendipity</WordTitle>
      <WordTitle level={3}>ephemeral</WordTitle>
    </div>
  );
}

export const showcaseMeta = {
  title: 'WordTitle',
  group: 'Domain — Dictionary',
  order: 80,
};
