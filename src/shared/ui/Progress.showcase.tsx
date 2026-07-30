import type { ReactElement } from 'react';
import { Progress } from './Progress';

export function Showcase(): ReactElement {
  const colors = ['accent', 'success', 'warning', 'error'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 240 }}>
      <Progress value={25} max={100} />
      <Progress value={60} max={100} size="sm" />
      <Progress value={80} max={100} size="lg" />
      {colors.map((color) => (
        <Progress key={color} value={50} max={100} color={color} />
      ))}
      <Progress indeterminate />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Progress',
  group: 'Shared UI — Feedback',
  order: 32,
};
