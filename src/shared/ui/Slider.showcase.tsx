import { useState, type ReactElement } from 'react';
import { Slider } from './Slider';

export function Showcase(): ReactElement {
  const [size, setSize] = useState(48);
  const [opacity, setOpacity] = useState(0.7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 240 }}>
      <Slider value={size} min={40} max={56} step={1} onChange={setSize} aria-label="Button size" />
      <Slider value={opacity} min={0} max={1} step={0.1} onChange={setOpacity} aria-label="Background opacity" />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Slider',
  level: 'atoms',
  category: 'Input',
  group: 'Shared UI — Input',
  order: 26,
};
