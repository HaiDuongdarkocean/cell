import type { CSSProperties } from 'react';
import { t } from '@/shared/i18n';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
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
  /** Interaction lock — blocks host video input, keeps Cell UI usable. */
  interactionLocked?: boolean;
  onToggleInteractionLock?: () => void;
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
  interactionLocked,
  onToggleInteractionLock,
  onExit,
}: ClusterRightToolbarProps): React.JSX.Element {
  const wrapperId = mode === 'overlay' ? 'nav-cluster-right' : 'player-mode-actions';
  const wrapperClass = `${sharedStyles.clusterRight} ${wrapperClassName ?? ''}`.trim();

  return (
    <div className={wrapperClass} style={clusterRightStyle} data-cell-id={wrapperId}>
      <div className={sharedStyles.primaryCol}>
        {onQuickAdd && (
          <Button shape="circle"
            variant="overlay"
            aria-label={t('subtitle.toolbar.quickAdd')}
            title={t('subtitle.toolbar.quickAddTitle')}
            data-cell-id="quick-add-btn"
            size="sm"
            onClick={onQuickAdd}
          >
            <Icon name="zap" />
          </Button>
        )}
        {onEditCard && (
          <Button shape="circle"
            variant="overlay"
            aria-label={t('subtitle.toolbar.editCard')}
            title={t('subtitle.toolbar.editCardTitle')}
            data-cell-id="edit-card-btn"
            size="sm"
            onClick={onEditCard}
          >
            <Icon name="pencil" />
          </Button>
        )}
        <div className={sharedStyles.toggleWrap}>
          <div
            className={`${sharedStyles.extraCol} ${toolsExpanded ? sharedStyles.expanded : ''}`}
            data-cell-id="subtitle-tools-extra"
          >
            {onToggleSidePanel && (
              <Button shape="circle"
                variant="overlay"
                aria-label={sidePanelLabel}
                title={t('subtitle.toolbar.toggleListTitle')}
                data-cell-id="panel-toggle-btn"
                size="sm"
                onClick={onToggleSidePanel}
              >
                <Icon name="sidePanel" />
              </Button>
            )}
            {onGenerateNative && (
              <Button shape="circle"
                variant="overlay"
                aria-label={t('subtitle.toolbar.generateNative')}
                title={t('subtitle.toolbar.generateNativeTitle')}
                data-cell-id="generate-native-btn"
                size="sm"
                onClick={onGenerateNative}
                disabled={!generateNativeEnabled}
              >
                <Icon name="languages" />
              </Button>
            )}
            {onToggleInteractionLock && (
              <Button shape="circle"
                variant="overlay"
                aria-label={interactionLocked ? t('subtitle.toolbar.unlockInteraction') : t('subtitle.toolbar.lockInteraction')}
                title={interactionLocked ? t('subtitle.toolbar.unlockInteraction') : t('subtitle.toolbar.lockInteraction')}
                data-cell-id="interaction-lock-btn"
                size="sm"
                onClick={onToggleInteractionLock}
                active={interactionLocked}
              >
                <Icon name={interactionLocked ? 'lock' : 'lockOpen'} />
              </Button>
            )}
          </div>
          <Button shape="circle"
            variant="overlay"
            aria-label={toolsExpanded ? t('subtitle.toolbar.collapseTools') : t('subtitle.toolbar.expandTools')}
            title={toolsExpanded ? t('subtitle.toolbar.collapseTools') : t('subtitle.toolbar.expandTools')}
            data-cell-id="tools-toggle-btn"
            size="sm"
            onClick={onToggleTools}
          >
            <Icon name="chevronLeft" />
          </Button>
        </div>
      </div>
      <div className={sharedStyles.secondaryCol}>
        {onToggleOcr && (
          <Button shape="circle"
            variant="overlay"
            aria-label={ocrEnabled ? t('subtitle.toolbar.disableOcr') : t('subtitle.toolbar.enableOcr')}
            title={ocrEnabled ? t('subtitle.toolbar.disableOcr') : t('subtitle.toolbar.enableOcr')}
            data-cell-id="ocr-toggle-btn"
            size="sm"
            onClick={onToggleOcr}
            active={ocrEnabled}
          >
            <Icon name="scanText" />
          </Button>
        )}
        {onToggleManager && (
          <Button shape="circle"
            variant="overlay"
            aria-label={t('subtitle.toolbar.openManager')}
            title={t('subtitle.toolbar.openManager')}
            data-cell-id="manager-toggle-btn"
            size="sm"
            onClick={onToggleManager}
          >
            <Icon name="subtitleManager" />
          </Button>
        )}
        {mode === 'overlay' ? (
          <Button shape="circle"
            variant="overlay"
            aria-label={playerMode ? t('subtitle.toolbar.exitPlayerMode') : t('subtitle.toolbar.enterPlayerMode')}
            title={playerMode ? t('subtitle.toolbar.exitPlayerModeTitle') : t('subtitle.toolbar.enterPlayerModeTitle')}
            data-cell-id="player-mode-btn"
            size="sm"
            onClick={onTogglePlayerMode}
            active={playerMode}
          >
            <Icon name={playerMode ? 'minimize' : 'maximize'} />
          </Button>
        ) : (
          <Button shape="circle"
            variant="overlay"
            aria-label={t('subtitle.toolbar.exitPlayerMode')}
            title={t('subtitle.toolbar.exitPlayerModeTitle')}
            data-cell-id="player-mode-exit-btn"
            size="sm"
            onClick={onExit}
          >
            <Icon name="minimize" />
          </Button>
        )}
      </div>
    </div>
  );
}
