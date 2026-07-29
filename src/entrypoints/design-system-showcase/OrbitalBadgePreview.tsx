import { useState, useCallback } from 'react';
import { OrbitalBadge } from '@/features/dictionaryPopup/ui/OrbitalBadge';
import { Button } from '@/shared/ui';
import type { PointerPreset, Point } from '@/features/dictionaryPopup/badgePointer/pointerPosition';

const VIEWPORT = { width: 300, height: 220 } as const;
const CENTER = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 } as const;

export function OrbitalBadgePreview(): React.JSX.Element {
  const [preset, setPreset] = useState<PointerPreset>('center');
  const [tip, setTip] = useState<Point | null>(null);
  const [clicks, setClicks] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const handlePresetChange = useCallback((next: PointerPreset): void => {
    setPreset(next);
  }, []);

  const handleTipReady = useCallback((newTip: Point, _preset: PointerPreset, _center: Point): void => {
    setTip(newTip);
  }, []);

  const handleClick = useCallback((): void => {
    setClicks((c) => c + 1);
  }, []);

  return (
    <div>
      <div
        style={{
          position: 'relative',
          width: VIEWPORT.width,
          height: VIEWPORT.height,
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          background: 'var(--color-surface)',
          transform: 'translate(0)',
        }}
      >
        <OrbitalBadge
          key={resetKey}
          initialCenter={CENTER}
          initialPreset="center"
          viewport={VIEWPORT}
          persistPosition={false}
          onPresetChange={handlePresetChange}
          onTipReady={handleTipReady}
          onClick={handleClick}
        />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button size="sm" onClick={() => setResetKey((k) => k + 1)}>Reset badge</Button>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Preset: <strong>{preset}</strong>
        </span>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Clicks: <strong>{clicks}</strong>
        </span>
        {tip && (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Tip: {Math.round(tip.x)}, {Math.round(tip.y)}
          </span>
        )}
      </div>
    </div>
  );
}
