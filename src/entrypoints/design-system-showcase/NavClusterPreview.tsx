import { useState } from 'react';
import { NavCluster } from '@/features/subtitle/ui/NavCluster';
import { Button } from '@/shared/ui';

export function NavClusterPreview(): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [hasSubtitle, setHasSubtitle] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatActive, setRepeatActive] = useState(false);

  const actions = {
    onToggleCollapsed: () => setCollapsed((v) => !v),
    onPrev: () => undefined,
    onNext: () => undefined,
    onRepeat: () => setRepeatActive((v) => !v),
    onRewind: () => undefined,
    onForward: () => undefined,
    onPlayPause: () => setIsPlaying((v) => !v),
  };

  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: 160,
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          background: 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <NavCluster
          collapsed={collapsed}
          hasSubtitle={hasSubtitle}
          isPlaying={isPlaying}
          repeatActive={repeatActive}
          {...actions}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button size="sm" onClick={() => setCollapsed((v) => !v)}>
          Toggle collapsed
        </Button>
        <Button size="sm" onClick={() => setHasSubtitle((v) => !v)}>
          Toggle has subtitle
        </Button>
        <Button size="sm" onClick={() => setIsPlaying((v) => !v)}>
          Toggle play
        </Button>
        <Button size="sm" onClick={() => setRepeatActive((v) => !v)}>
          Toggle repeat
        </Button>
      </div>
    </div>
  );
}
