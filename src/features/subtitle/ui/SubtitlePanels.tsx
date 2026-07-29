import { useState, useImperativeHandle, forwardRef } from 'react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { SubtitleManagerPanel } from './SubtitleManagerPanel';
import { SubtitleOffsetPanel } from './SubtitleOffsetPanel';
import { SubtitleToast, type ToastItem, type ToastVariant } from './SubtitleToast';
import { SubtitleHint } from './SubtitleHint';
import styles from './SubtitlePanels.module.css';

export interface SubtitlePanelsRef {
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
}

export interface SubtitlePanelsProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  collapsed: boolean;
  hasSubtitle: boolean;
  isPlaying: boolean;
  repeatActive: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onRewind: () => void;
  onForward: () => void;
  onPlayPause: () => void;
  onToggleCollapsed: () => void;
  manager?: {
    targetItems: import('./subtitleManagerPanel.legacy').SubtitlePanelItem[];
    nativeItems: import('./subtitleManagerPanel.legacy').SubtitlePanelItem[];
    targetActiveIndex: number;
    nativeActiveIndex: number;
    onSelect: (role: 'target' | 'native', index: number) => void;
    onImport?: (role: 'target' | 'native') => void;
    onGenerateNative?: () => void;
    onOffsetChange?: (role: 'target' | 'native', ms: number) => void;
  };
  offset?: {
    targetMs: number;
    nativeMs: number;
    onTargetChange: (ms: number) => void;
    onNativeChange: (ms: number) => void;
  };
}

export const SubtitlePanels = forwardRef<SubtitlePanelsRef, SubtitlePanelsProps>(
  function SubtitlePanels(
    {
      targetStyle,
      nativeStyle,
      collapsed,
      hasSubtitle,
      isPlaying,
      repeatActive,
      onPrev,
      onNext,
      onRepeat,
      onRewind,
      onForward,
      onPlayPause,
      onToggleCollapsed,
      manager,
      offset,
    },
    ref,
  ): React.JSX.Element {
    const [managerOpen, setManagerOpen] = useState(false);
    const [offsetOpen, setOffsetOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(false);
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useImperativeHandle(
      ref,
      () => ({
        setManagerOpen,
        setOffsetOpen,
        setHintOpen,
        addToast: (message: string, variant?: ToastVariant): void => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          setToasts((prev) => [...prev, { id, message, variant }]);
        },
        clearToasts: (): void => setToasts([]),
      }),
      [],
    );

    const removeToast = (id: string): void => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };

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
            onToggleCollapsed={onToggleCollapsed}
            onPrev={onPrev}
            onNext={onNext}
            onRepeat={onRepeat}
            onRewind={onRewind}
            onForward={onForward}
            onPlayPause={onPlayPause}
          />
        </div>

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
