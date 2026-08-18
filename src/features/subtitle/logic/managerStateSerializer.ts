import type { ManagerState, OffsetState } from '../ui/SubtitlePanels';
import type { AppearanceState } from '../ui/SubtitleManagerPanel';
import type { SerializedManagerState, SerializedAppearanceState } from './iframeManagerBridgeTypes';

export function serializeAppearanceState(appearance: AppearanceState): SerializedAppearanceState {
  return {
    targetStyle: appearance.targetStyle,
    nativeStyle: appearance.nativeStyle,
    blockSettings: appearance.blockSettings,
    clusterSettings: appearance.clusterSettings,
    defaultTargetStyle: appearance.defaultTargetStyle,
    defaultNativeStyle: appearance.defaultNativeStyle,
    previewTargetText: appearance.previewTargetText,
    previewNativeText: appearance.previewNativeText,
  };
}

export function serializeManagerState(
  manager: ManagerState,
  offset?: OffsetState,
  generateNativeDisabled = false,
): SerializedManagerState {
  return {
    targetItems: manager.targetItems,
    nativeItems: manager.nativeItems,
    targetActiveIndex: manager.targetActiveIndex,
    nativeActiveIndex: manager.nativeActiveIndex,
    targetHidden: manager.targetHidden,
    nativeHidden: manager.nativeHidden,
    bothHidden: manager.bothHidden,
    targetOffsetMs: offset?.targetMs ?? 0,
    nativeOffsetMs: offset?.nativeMs ?? 0,
    hasSearchKeys: manager.hasSearchKeys,
    apiKeys: [...manager.apiKeys],
    generateNativeDisabled,
    appearance: manager.appearance ? serializeAppearanceState(manager.appearance) : undefined,
  };
}
