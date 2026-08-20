import { SubtitleOffsetPanel } from './SubtitleOffsetPanel';
import type { OffsetState } from './subtitlePanelsTypes';
import sharedStyles from './subtitlePanelsShared.module.css';

export interface OffsetLayerProps {
  offset: OffsetState;
}

export function OffsetLayer({ offset }: OffsetLayerProps): React.JSX.Element {
  return (
    <div className={sharedStyles.panelLayer} data-cell-id="subtitle-offset-layer">
      <div className={sharedStyles.offsetRow}>
        <SubtitleOffsetPanel offsetMs={offset.targetMs} onOffsetChange={offset.onTargetChange} />
        <SubtitleOffsetPanel offsetMs={offset.nativeMs} onOffsetChange={offset.onNativeChange} />
      </div>
    </div>
  );
}
