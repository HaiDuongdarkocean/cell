import { DefinitionText } from './DefinitionText';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <DefinitionText>A fortunate accident or coincidence.</DefinitionText>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DefinitionText index={1}>A fortunate accident.</DefinitionText>
        <DefinitionText index={2}>The faculty of making fortunate discoveries.</DefinitionText>
      </ol>
    </div>
  );
}

export const showcaseMeta = {
  title: 'DefinitionText',
  level: 'atoms',
  category: 'Content',
  group: 'Domain — Dictionary',
  order: 84,
};
