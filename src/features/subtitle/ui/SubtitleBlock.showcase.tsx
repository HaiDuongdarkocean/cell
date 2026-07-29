import { SubtitleBlock } from './SubtitleBlock';
import { useMockCues } from '@/entrypoints/design-system-showcase/mockProviders';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const cues = useMockCues();

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
