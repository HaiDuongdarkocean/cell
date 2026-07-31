import { ExampleSentence } from './ExampleSentence';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ExampleSentence highlight="serendipity" translation="Cô ấy tìm thấy cuốn sách một cách tình cờ.">
        She found the book by serendipity.
      </ExampleSentence>
      <ExampleSentence blockquote>
        It was pure serendipity that brought them together.
      </ExampleSentence>
    </div>
  );
}

export const showcaseMeta = {
  title: 'ExampleSentence',
  level: 'atoms',
  category: 'Content',
  group: 'Domain — Dictionary',
  order: 85,
};
