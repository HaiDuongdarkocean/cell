import { useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { SubtitleManagerPanel } from './SubtitleManagerPanel';
import { SubtitleOffsetPanel } from './SubtitleOffsetPanel';
import { SubtitleToast, type ToastItem, type ToastVariant } from './SubtitleToast';
import { SubtitleHint } from './SubtitleHint';
import { SubtitlePanelItem } from './subtitlePanelModel';
import { ICON_CATALOG } from '@/shared/icons';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import styles from './SubtitlePanels.module.css';

type IconCatalogKey = keyof typeof ICON_CATALOG;

export interface ManagerState {
  targetItems: SubtitlePanelItem[];
  nativeItems: SubtitlePanelItem[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
  onSelect: (role: 'target' | 'native', index: number) => void;
  onImport?: (role: 'target' | 'native') => void;
  onGenerateNative?: () => void;
  onOffsetChange?: (role: 'target' | 'native', ms: number) => void;
}

export interface OffsetState {
  targetMs: number;
  nativeMs: number;
  onTargetChange: (ms: number) => void;
  onNativeChange: (ms: number) => void;
}

export interface SubtitlePanelsRef {
  /** Update target + native overlay styles. */
  setStyles: (targetStyle: OverlayStyleConfig, nativeStyle: OverlayStyleConfig) => void;
  /** Replace the manager items and callbacks. */
  setManager: (manager: ManagerState) => void;
  /** Replace the offset state and callbacks. */
  setOffset: (offset: OffsetState) => void;
  /** Show or hide the subtitle manager panel. */
  setManagerOpen: (open: boolean) => void;
  /** Show or hide the offset panel. */
  setOffsetOpen: (open: boolean) => void;
  /** Show or hide the drag/drop hint. */
  setHintOpen: (open: boolean) => void;
  /** Add a toast notification. */
  addToast: (message: string, variant?: ToastVariant) => void;
  /** Clear all toasts. */
  clearToasts: () => void;
  /** Update whether a subtitle is currently loaded. */
  setHasSubtitle: (has: boolean) => void;
  /** Update whether the video is playing. */
  setIsPlaying: (playing: boolean) => void;
  /** Update the repeat AB-loop active state. */
  setRepeatActive: (active: boolean) => void;
  /** Update the repeat button icon and label. */
  setRepeatIcon: (icon: IconCatalogKey, label?: string) => void;
  /** Enable or disable the manager-panel generate-native button. */
  setGenerateNativeEnabled: (enabled: boolean) => void;
  /** Collapse or expand the nav cluster. */
  setCollapsed: (collapsed: boolean) => void;
}

export interface SubtitlePanelsProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  collapsed: boolean;
  hasSubtitle: boolean;
  isPlaying: boolean;
  repeatActive: boolean;
  repeatIcon?: IconCatalogKey;
  repeatLabel?: string;
  onPrev: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onRewind: () => void;
  onForward: () => void;
  onPlayPause: () => void;
  onToggleCollapsed: () => void;
  /** Quick-add all unknown/tracking words in the current subtitle line. */
  onQuickAdd?: () => void;
  /** Open the Card Creator dialog pre-filled for the current line. */
  onEditCard?: () => void;
  /** Update the card matching the current subtitle line. */
  onUpdateCurrentCard?: () => void;
  /** Generate a native subtitle from the current target cues. */
  onGenerateNative?: () => void;
  /** Open/close the Chrome side panel. */
  onToggleSidePanel?: () => void;
  /** Open the subtitle manager panel. */
  onToggleManager?: () => void;
  manager?: ManagerState;
  offset?: OffsetState;
  generateNativeEnabled?: boolean;
}

export const SubtitlePanels = forwardRef<SubtitlePanelsRef, SubtitlePanelsProps>(
  function SubtitlePanels(
    {
      targetStyle: initialTargetStyle,
      nativeStyle: initialNativeStyle,
      collapsed: initialCollapsed,
      hasSubtitle: initialHasSubtitle,
      isPlaying: initialIsPlaying,
      repeatActive: initialRepeatActive,
      repeatIcon: initialRepeatIcon = 'repeat',
      repeatLabel: initialRepeatLabel = 'Repeat current sentence',
      onPrev,
      onNext,
      onRepeat,
      onRewind,
      onForward,
      onPlayPause,
      onToggleCollapsed,
      onQuickAdd,
      onEditCard,
      onUpdateCurrentCard,
      onGenerateNative,
      onToggleSidePanel,
      onToggleManager,
      manager: initialManager,
      offset: initialOffset,
      generateNativeEnabled: initialGenerateNativeEnabled = true,
    },
    ref,
  ): React.JSX.Element {
    const [targetStyle, setTargetStyle] = useState(initialTargetStyle);
    const [nativeStyle, setNativeStyle] = useState(initialNativeStyle);
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const [hasSubtitle, setHasSubtitle] = useState(initialHasSubtitle);
    const [isPlaying, setIsPlaying] = useState(initialIsPlaying);
    const [repeatActive, setRepeatActive] = useState(initialRepeatActive);
    const [repeatIcon, setRepeatIcon] = useState<IconCatalogKey>(initialRepeatIcon);
    const [repeatLabel, setRepeatLabel] = useState(initialRepeatLabel);
    const [manager, setManager] = useState<ManagerState | undefined>(initialManager);
    const [offset, setOffset] = useState<OffsetState | undefined>(initialOffset);
    const [managerOpen, setManagerOpen] = useState(false);
    const [offsetOpen, setOffsetOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(false);
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [generateNativeEnabled, setGenerateNativeEnabled] = useState(initialGenerateNativeEnabled);

    const addToast = useCallback((message: string, variant?: ToastVariant): void => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
    }, []);

    const clearToasts = useCallback((): void => setToasts([]), []);

    const removeToast = useCallback((id: string): void => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        setStyles: (t, n) => { setTargetStyle(t); setNativeStyle(n); },
        setManager: (m) => setManager(m),
        setOffset: (o) => setOffset(o),
        setManagerOpen,
        setOffsetOpen,
        setHintOpen,
        addToast,
        clearToasts,
        setHasSubtitle,
        setIsPlaying,
        setRepeatActive,
        setRepeatIcon,
        setRepeatLabel,
        setGenerateNativeEnabled,
        setCollapsed,
      }),
      [addToast, clearToasts],
    );

    const handleToggleCollapsed = useCallback((): void => {
      setCollapsed((prev) => !prev);
      onToggleCollapsed();
    }, [onToggleCollapsed]);

    const handlePlayPause = useCallback((): void => {
      onPlayPause();
    }, [onPlayPause]);

    return (
      <div className={styles.root}>
        <div className={styles.blockLayer}>
          <SubtitleBlock targetStyle={targetStyle} nativeStyle={nativeStyle} />
        </div>

        <div className={styles.navLayer}>
          <NavCluster
            collapsed={collapsed}
            hasSubtitle={hasSubtitle}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            repeatIcon={repeatIcon}
            repeatLabel={repeatLabel}
            onToggleCollapsed={handleToggleCollapsed}
            onPrev={onPrev}
            onNext={onNext}
            onRepeat={onRepeat}
            onRewind={onRewind}
            onForward={onForward}
            onPlayPause={handlePlayPause}
          />
        </div>

        {!collapsed && (
          <div className={styles.toolsLayer} data-testid="subtitle-tools">
            {onQuickAdd && (
              <IconButton
                aria-label="Quick add card"
                title="Quick add (Q)"
                data-testid="quick-add-btn"
                size="sm"
                onClick={onQuickAdd}
              >
                <Icon name="zap" size={18} />
              </IconButton>
            )}
            {onEditCard && (
              <IconButton
                aria-label="Edit card"
                title="Edit card (E)"
                data-testid="edit-card-btn"
                size="sm"
                onClick={onEditCard}
              >
                <Icon name="pencil" size={18} />
              </IconButton>
            )}
            {onUpdateCurrentCard && (
              <IconButton
                aria-label="Update current card"
                title="Update current card (U)"
                data-testid="update-current-card-btn"
                size="sm"
                onClick={onUpdateCurrentCard}
              >
                <Icon name="rotateCcw" size={18} />
              </IconButton>
            )}
            {onGenerateNative && (
              <IconButton
                aria-label="Generate native subtitle"
                title="Generate native (G)"
                data-testid="generate-native-btn"
                size="sm"
                onClick={onGenerateNative}
                disabled={!generateNativeEnabled}
              >
                <Icon name="languages" size={18} />
              </IconButton>
            )}
            {onToggleManager && (
              <IconButton
                aria-label="Open subtitle manager"
                title="Open subtitle manager"
                data-testid="manager-toggle-btn"
                size="sm"
                onClick={onToggleManager}
              >
                <Icon name="subtitleManager" size={18} />
              </IconButton>
            )}
            {onToggleSidePanel && (
              <IconButton
                aria-label="Toggle subtitle side panel"
                title="Toggle side panel (T)"
                data-testid="panel-toggle-btn"
                size="sm"
                onClick={onToggleSidePanel}
              >
                <Icon name="sidePanel" size={18} />
              </IconButton>
            )}
          </div>
        )}

        {managerOpen && manager && (
          <div className={styles.panelLayer} data-testid="subtitle-manager-layer">
            <SubtitleManagerPanel
              targetItems={manager.targetItems}
              nativeItems={manager.nativeItems}
              targetActiveIndex={manager.targetActiveIndex}
              nativeActiveIndex={manager.nativeActiveIndex}
              onSelect={manager.onSelect}
              onClose={() => setManagerOpen(false)}
              onImport={manager.onImport}
              onGenerateNative={manager.onGenerateNative}
              onOffsetChange={manager.onOffsetChange}
              generateNativeDisabled={!generateNativeEnabled}
            />
          </div>
        )}

        {offsetOpen && offset && (
          <div className={styles.panelLayer} data-testid="subtitle-offset-layer">
            <div className={styles.offsetRow}>
              <SubtitleOffsetPanel
                offsetMs={offset.targetMs}
                onOffsetChange={offset.onTargetChange}
              />
              <SubtitleOffsetPanel
                offsetMs={offset.nativeMs}
                onOffsetChange={offset.onNativeChange}
              />
            </div>
          </div>
        )}

        <div className={styles.toastLayer}>
          <SubtitleToast toasts={toasts} onRemove={removeToast} />
        </div>

        {hintOpen && (
          <div className={styles.hintLayer} data-testid="subtitle-hint-layer">
            <SubtitleHint onClick={() => setHintOpen(false)} />
          </div>
        )}
      </div>
    );
  },
);
