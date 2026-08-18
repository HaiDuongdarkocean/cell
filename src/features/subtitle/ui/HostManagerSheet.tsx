import { useCallback } from 'react';
import { SubtitleManagerPanel, type AppearanceState } from './SubtitleManagerPanel';
import type { SubtitleSearchResult } from '../logic/subtitleSearchTypes';
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

export function HostManagerSheet({ state, onAction, onClose }: HostManagerSheetProps): React.JSX.Element {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <>
      <div className={styles.backdrop} onClick={handleBackdropClick} />
      <div className={styles.sheet} role="dialog" aria-modal="true">
        <div className={styles.handle} />
        <SubtitleManagerPanel
          targetItems={state.targetItems}
          nativeItems={state.nativeItems}
          targetActiveIndex={state.targetActiveIndex}
          nativeActiveIndex={state.nativeActiveIndex}
          targetLabel={state.targetLabel}
          nativeLabel={state.nativeLabel}
          onSelect={(role, index) => onAction('select', { role, index })}
          onClose={onClose}
          onImport={(role) => onAction('import', { role })}
          onGenerateNative={state.generateNativeDisabled ? undefined : () => onAction('generateNative', {})}
          onOffsetChange={(role, ms) => onAction('offsetChange', { role, ms })}
          generateNativeDisabled={state.generateNativeDisabled}
          appearance={state.appearance ? buildAppearance(state.appearance, onAction) : undefined}
          hasSearchKeys={state.hasSearchKeys}
          apiKeys={state.apiKeys as readonly SubtitleApiKey[]}
          onApiKeysChange={(keys) => onAction('apiKeysChange', { keys })}
          onSearchResultSelect={(result, role) => onAction('searchResultSelect', { result, role })}
          onDownload={(role, index) => onAction('download', { role, index })}
          onHideSection={(role) => onAction('hideSection', { role })}
          onHideBoth={() => onAction('hideBoth', {})}
          targetHidden={state.targetHidden}
          nativeHidden={state.nativeHidden}
          bothHidden={state.bothHidden}
        />
      </div>
    </>
  );
}
