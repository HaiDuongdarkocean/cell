import { useState, type ReactElement } from 'react';
import { MaximizeButton } from './MaximizeButton';

export function Showcase(): ReactElement {
  const [maximized, setMaximized] = useState(false);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <MaximizeButton maximized={maximized} onClick={() => setMaximized(!maximized)} />
      <MaximizeButton maximized={true} />
      <MaximizeButton maximized={false} disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'MaximizeButton',
  group: 'Extension',
  order: 50,
};
