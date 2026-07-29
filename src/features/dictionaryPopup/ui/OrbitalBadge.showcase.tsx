import { useState, type ReactElement } from 'react';
import { OrbitalBadge } from './OrbitalBadge';
import type { Point } from '@/features/dictionaryPopup/badgePointer/pointerPosition';
import type { ViewportRect } from '@/features/dictionaryPopup/badgePointer/badgeCollapse';

const VIEWPORT: ViewportRect = { width: 400, height: 160 };
const INITIAL_CENTER: Point = { x: 360, y: 80 };

export function Showcase(): ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        border: 'var(--border-width-hairline) solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        background: 'var(--color-surface)',
      }}
    >
      <OrbitalBadge
        initialCenter={INITIAL_CENTER}
        viewport={VIEWPORT}
        badgeSize={40}
        pointerSize={10}
        initialPreset="left"
        persistPosition={false}
        onClick={() => setExpanded((v) => !v)}
      />
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 16,
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {expanded ? 'Badge tapped' : 'Tap or drag the badge'}
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'OrbitalBadge',
  group: 'Features',
  order: 101,
};
