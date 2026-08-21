import { useCallback } from 'react';
import { ManagerLayer } from './ManagerLayer';
import type { AppearanceState, ManagerState } from './subtitlePanelsTypes';
import type { SubtitleApiKey } from '@/entities/settings';
import type {
  SerializedManagerState,
  SerializedAppearanceState,
  ManagerAction,
} from '../logic/iframeManagerBridgeTypes';
import styles from './HostManagerSheet.module.css';

interface HostManagerSheetProps {
  state: SerializedManagerState;
  onAction: (action: ManagerAction, args: Record<string, unknown>) => void;
  onClose: () => void;
}

/** Reconstruct AppearanceState from serialized form, wiring callbacks to onAction. */
function buildAppearance(
  serialized: SerializedAppearanceState,
  onAction: (action: ManagerAction, args: Record<string, unknown>) => void,
): AppearanceState {
  return {
    targetStyle: serialized.targetStyle,
    nativeStyle: serialized.nativeStyle,
    blockSettings: serialized.blockSettings,
    clusterSettings: serialized.clusterSettings,
    defaultTargetStyle: serialized.defaultTargetStyle,
    defaultNativeStyle: serialized.defaultNativeStyle,
    previewTargetText: serialized.previewTargetText,
    previewNativeText: serialized.previewNativeText,
    onStyleChange: (role, partial) => onAction('styleChange', { role, partial }),
    onBlockSettingsChange: (partial) => onAction('blockSettingsChange', { partial }),
    onClusterSettingsChange: (partial) => onAction('clusterSettingsChange', { partial }),
    onResetStyle: (role) => onAction('resetStyle', { role }),
    onPreviewTextChange: (role, text) => onAction('previewTextChange', { role, text }),
  };
}

/**
 * HostManagerSheet — thin adapter for the host-page mobile iframe-child.
 *
 * Converts `SerializedManagerState` → `ManagerState` (wiring `onAction` callbacks)
 * and delegates all rendering (Sheet + persisted height + panel) to `ManagerLayer`.
 * Only the host-page backdrop remains here — `ManagerLayer`'s mobile branch does
 * not render one (the shared `Sheet` atom has no backdrop of its own).
 *
 * Spec: docs/specs/subtitle-panels-atom-decomposition.md (Decision D1, Task 8)
 */
export function HostManagerSheet({ state, onAction, onClose }: HostManagerSheetProps): React.JSX.Element {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const manager: ManagerState = {
    targetItems: state.targetItems,
    nativeItems: state.nativeItems,
    targetActiveIndex: state.targetActiveIndex,
    nativeActiveIndex: state.nativeActiveIndex,
    onSelect: (role, index) => onAction('select', { role, index }),
    onImport: (role) => onAction('import', { role }),
    onGenerateNative: state.generateNativeDisabled ? undefined : () => onAction('generateNative', {}),
    onOffsetChange: (role, ms) => onAction('offsetChange', { role, ms }),
    offsetMs: state.targetOffsetMs,
    appearance: state.appearance ? buildAppearance(state.appearance, onAction) : undefined,
    hasSearchKeys: state.hasSearchKeys,
    apiKeys: state.apiKeys as readonly SubtitleApiKey[],
    onApiKeysChange: (keys) => onAction('apiKeysChange', { keys }),
    onSearchResultSelect: (result, role) => onAction('searchResultSelect', { result, role }),
    onDownload: (role, index) => onAction('download', { role, index }),
    onHideSection: (role) => onAction('hideSection', { role }),
    onHideBoth: () => onAction('hideBoth', {}),
    targetHidden: state.targetHidden,
    nativeHidden: state.nativeHidden,
    bothHidden: state.bothHidden,
  };

  return (
    <>
      <div className={styles.backdrop} onClick={handleBackdropClick} />
      <ManagerLayer
        manager={manager}
        isMobile={true}
        onClose={onClose}
        generateNativeEnabled={!state.generateNativeDisabled}
      />
    </>
  );
}
