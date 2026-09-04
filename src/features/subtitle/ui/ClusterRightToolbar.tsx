import type { CSSProperties } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import sharedStyles from './subtitlePanelsShared.module.css';

export interface ClusterRightToolbarProps {
  mode: 'overlay' | 'player';
  clusterRightStyle?: CSSProperties;
  /** Extra className for wrapper (player mode adds styles.actionArea) */
  wrapperClassName?: string;
  onQuickAdd?: () => void;
  onEditCard?: () => void;
  /** Toggle OCR on/off for current site. Replaces onUpdateCurrentCard. */
  onToggleOcr?: () => void;
  /** Whether OCR is currently enabled (controls button active state). */
  ocrEnabled?: boolean;
  onToggleManager?: () => void;
  onGenerateNative?: () => void;
  generateNativeEnabled?: boolean;
  onToggleSidePanel?: () => void;
  /** Overlay: splitViewOpen ? 'Close' : 'Open'. Player: fixed 'Toggle subtitle list' */
  sidePanelLabel: string;
  toolsExpanded: boolean;
  onToggleTools: () => void;
  /** Overlay only: player mode toggle */
  onTogglePlayerMode?: () => void;
  playerMode?: boolean;
  /** Player only: exit */
  onExit?: () => void;
}

/**
 * ClusterRightToolbar molecule — right-side toolbar shared by overlay + player mode.
 * SSOT for toolbar CSS (subtitlePanelsShared.module.css) + data-cell-id selectors.
 * Spec: docs/specs/subtitle-panels-atom-decomposition.md (D5).
 */
export function ClusterRightToolbar({
  mode,
  clusterRightStyle,
  wrapperClassName,
  onQuickAdd,
  onEditCard,
  onToggleOcr,
  ocrEnabled,
  onToggleManager,
  onGenerateNative,
  generateNativeEnabled,
  onToggleSidePanel,
  sidePanelLabel,
  toolsExpanded,
  onToggleTools,
  onTogglePlayerMode,
  playerMode,
  onExit,
}: ClusterRightToolbarProps): React.JSX.Element {
  const wrapperId = mode === 'overlay' ? 'nav-cluster-right' : 'player-mode-actions';
  const wrapperClass = `${sharedStyles.clusterRight} ${wrapperClassName ?? ''}`.trim();

  return (
    <div className={wrapperClass} style={clusterRightStyle} data-cell-id={wrapperId}>
      <div className={sharedStyles.primaryCol}>
        {onQuickAdd && (
          <IconButton
            material="liquid" variant="glass"
            aria-label="Quick add card"
            title="Quick add (Q)"
            data-cell-id="quick-add-btn"
            size="sm"
            onClick={onQuickAdd}
          >
            <Icon name="zap" />
          </IconButton>
        )}
        {onEditCard && (
          <IconButton
            material="liquid" variant="glass"
            aria-label="Edit card"
            title="Edit card (E)"
            data-cell-id="edit-card-btn"
            size="sm"
            onClick={onEditCard}
          >
            <Icon name="pencil" />
          </IconButton>
        )}
        <div className={sharedStyles.toggleWrap}>
          <div
            className={`${sharedStyles.extraCol} ${toolsExpanded ? sharedStyles.expanded : ''}`}
            data-cell-id="subtitle-tools-extra"
          >
            {onToggleSidePanel && (
              <IconButton
                material="liquid" variant="glass"
                aria-label={sidePanelLabel}
                title="Toggle subtitle list (T)"
                data-cell-id="panel-toggle-btn"
                size="sm"
                onClick={onToggleSidePanel}
              >
                <Icon name="sidePanel" />
              </IconButton>
            )}
            {onGenerateNative && (
              <IconButton
                material="liquid" variant="glass"
                aria-label="Generate native subtitle"
                title="Generate native (H)"
                data-cell-id="generate-native-btn"
                size="sm"
                onClick={onGenerateNative}
                disabled={!generateNativeEnabled}
              >
                <Icon name="languages" />
              </IconButton>
            )}
          </div>
          <IconButton
            material="liquid" variant="glass"
            aria-label={toolsExpanded ? 'Collapse tools' : 'Expand tools'}
            title={toolsExpanded ? 'Collapse tools' : 'Expand tools'}
            data-cell-id="tools-toggle-btn"
            size="sm"
            onClick={onToggleTools}
          >
            <Icon name="chevronLeft" />
          </IconButton>
        </div>
      </div>
      <div className={sharedStyles.secondaryCol}>
        {onToggleOcr && (
          <IconButton
            material="liquid" variant="glass"
            aria-label={ocrEnabled ? 'Disable OCR' : 'Enable OCR'}
            title={ocrEnabled ? 'Disable OCR' : 'Enable OCR'}
            data-cell-id="ocr-toggle-btn"
            size="sm"
            onClick={onToggleOcr}
            active={ocrEnabled}
          >
            <Icon name="scanText" />
          </IconButton>
        )}
        {onToggleManager && (
          <IconButton
            material="liquid" variant="glass"
            aria-label="Open subtitle manager"
            title="Open subtitle manager"
            data-cell-id="manager-toggle-btn"
            size="sm"
            onClick={onToggleManager}
          >
            <Icon name="subtitleManager" />
          </IconButton>
        )}
        {mode === 'overlay' ? (
          <IconButton
            material="liquid" variant="glass"
            aria-label={playerMode ? 'Exit player mode' : 'Enter player mode'}
            title={playerMode ? 'Exit player mode (Esc)' : 'Enter player mode (G)'}
            data-cell-id="player-mode-btn"
            size="sm"
            onClick={onTogglePlayerMode}
            active={playerMode}
          >
            <Icon name={playerMode ? 'minimize' : 'maximize'} />
          </IconButton>
        ) : (
          <IconButton
            material="liquid" variant="glass"
            aria-label="Exit player mode"
            title="Exit player mode (Esc)"
            data-cell-id="player-mode-exit-btn"
            size="sm"
            onClick={onExit}
          >
            <Icon name="minimize" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
