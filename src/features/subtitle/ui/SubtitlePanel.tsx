// SubtitlePanel — SSOT wrapper for CueList used by both Player Mode and Split View.
// Provides the flex-column + overflow:hidden container that lets CueList's .list
// (flex:1, min-height:0) become the sole scroll container.
//
// Usage:
//   Player Mode: <SubtitlePanel cues={...} currentTimeMs={...} offsetMs={...} onSeek={...} />
//   Split View:  <SubtitlePanel cues={...} currentTimeMs={...} offsetMs={...} onSeek={...} onClose={...} />

import { memo } from 'react';
import type { BilingualCue } from '@/entities/media';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import styles from './SubtitlePanel.module.css';

export interface SubtitlePanelProps {
  cues: BilingualCue[];
  currentTimeMs: number;
  /** ADR-019 sync: offset from content script. Highlight cue at
   *  effective = currentTimeMs + offsetMs to match the overlay. */
  offsetMs?: number;
  /** Seek video to timeMs when user clicks a cue. */
  onSeek: (timeMs: number) => void;
  /** Optional close button (Split View). Player Mode handles close via 't'. */
  onClose?: () => void;
}

function SubtitlePanelImpl({
  cues,
  currentTimeMs,
  offsetMs,
  onSeek,
  onClose,
}: SubtitlePanelProps): React.JSX.Element {
  return (
    <div className={styles.panel} data-cell-id="subtitle-panel">
      {onClose && (
        <div className={styles.header}>
          <span className={styles.title}>Subtitles</span>
          <IconButton
            aria-label="Close subtitle list"
            title="Close (T)"
            data-cell-id="subtitle-panel-close"
            size="sm"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </IconButton>
        </div>
      )}
      <div className={styles.cueListWrap}>
        <CueList
          cues={cues}
          currentTimeMs={currentTimeMs}
          offsetMs={offsetMs}
          onSeek={onSeek}
        />
      </div>
    </div>
  );
}

export const SubtitlePanel = memo(SubtitlePanelImpl);
