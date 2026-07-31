import { useState, type ReactElement } from 'react';
import { CollapseButton } from './CollapseButton';

export function Showcase(): ReactElement {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <CollapseButton
        collapsed={collapsed}
        onClick={() => setCollapsed(!collapsed)}
        controlsId="demo-section"
        aria-label="Toggle section"
      />
      <CollapseButton collapsed={true} aria-label="Collapsed" />
      <CollapseButton collapsed={false} disabled aria-label="Disabled" />
    </div>
  );
}

export const showcaseMeta = {
  title: 'CollapseButton',
  description: 'Collapse/expand toggle with direction (horizontal, vertical), showLabel, and sizes. Use for collapsible sections.',
  level: 'molecules',
  category: 'Action',
  group: 'Extension',
  order: 48,
};
