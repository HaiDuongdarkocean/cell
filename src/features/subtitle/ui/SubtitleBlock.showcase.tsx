import { SubtitleBlock } from './SubtitleBlock';
import { mockTargetCues, mockNativeCues } from '@/entrypoints/design-system-showcase/mockCues';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const cues = { targetCues: mockTargetCues, nativeCues: mockNativeCues, targetActiveIndex: 1, nativeActiveIndex: 1 };

  return (
    <div
      style={{
        position: 'relative',
        height: 120,
        width: '100%',
        background: '#000000',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <SubtitleBlock
        targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
        nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
        cues={cues}
      />
    </div>
  );
}

export const showcaseMeta = {
  title: 'SubtitleBlock',
  group: 'Features',
  order: 100,
};
