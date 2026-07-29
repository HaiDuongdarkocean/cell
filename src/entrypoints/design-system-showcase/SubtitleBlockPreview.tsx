import { useEffect } from 'react';
import { SubtitleBlock } from '@/features/subtitle/ui/SubtitleBlock';
import { useCuesStore } from '@/stores/cuesStore';
import { mockTargetCues, mockNativeCues } from './mockCues';
import type { OverlayStyleConfig } from '@/entities/subtitle';

const targetStyle: OverlayStyleConfig = {
  fontSize: 22,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  textOpacity: 1,
  textShadow: { preset: 'soft', color: '#000000', blur: 2, offsetX: 1, offsetY: 1 },
  fontFamily: 'sans-serif',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

const nativeStyle: OverlayStyleConfig = {
  ...targetStyle,
  fontSize: 18,
  textColor: '#e2e8f0',
};

export function SubtitleBlockPreview(): React.JSX.Element {
  useEffect(() => {
    useCuesStore.getState().setCues(mockTargetCues, mockNativeCues);
    useCuesStore.getState().setActiveIndex(1, 1);
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        height: 160,
        background: 'linear-gradient(135deg, #0f172a, #1e293b)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 24,
        }}
      >
        <SubtitleBlock targetStyle={targetStyle} nativeStyle={nativeStyle} />
      </div>
    </div>
  );
}
