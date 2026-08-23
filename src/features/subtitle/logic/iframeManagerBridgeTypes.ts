/**
 * Bridge types for the iframe-hosted subtitle manager.
 *
 * The manager UI runs inside an iframe and communicates with the host
 * content script via postMessage. These types define the serialized
 * (JSON-only, no functions) state and action protocol exchanged across
 * that boundary.
 */
import type { SubtitlePanelItem } from '../ui/subtitlePanelModel';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings, NavClusterSettings, SubtitleApiKey } from '@/entities/settings';

// Message type constants — used as the `type` field of every postMessage payload.
export const MGR_OPEN_MSG = '__CELL_MANAGER_OPEN';
export const MGR_CLOSE_MSG = '__CELL_MANAGER_CLOSE';
export const MGR_STATE_MSG = '__CELL_MANAGER_STATE';
export const MGR_ACTION_MSG = '__CELL_MANAGER_ACTION';
export const MGR_OPENED_MSG = '__CELL_MANAGER_OPENED';
export const MGR_CLOSED_MSG = '__CELL_MANAGER_CLOSED';

/**
 * Serialized manager state — JSON-serializable mirror of `ManagerState`
 * (from SubtitlePanels.tsx) with all function callbacks stripped.
 */
export interface SerializedManagerState {
  targetItems: SubtitlePanelItem[];
  nativeItems: SubtitlePanelItem[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
  targetLabel?: string;
  nativeLabel?: string;
  targetHidden?: boolean;
  nativeHidden?: boolean;
  bothHidden?: boolean;
  targetOffsetMs: number;
  nativeOffsetMs: number;
  hasSearchKeys: boolean;
  apiKeys: SubtitleApiKey[];
  generateNativeDisabled: boolean;
  appearance?: SerializedAppearanceState;
}

/**
 * Serialized appearance state — JSON-serializable mirror of `AppearanceState`
 * (from SubtitleManagerPanel.tsx) with all function callbacks stripped.
 */
export interface SerializedAppearanceState {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  blockSettings: SubtitleBlockSettings;
  clusterSettings: NavClusterSettings;
  defaultTargetStyle: OverlayStyleConfig;
  defaultNativeStyle: OverlayStyleConfig;
  previewTargetText: string;
  previewNativeText: string;
}

/**
 * Discriminator for manager actions sent from the iframe to the host.
 * Each value maps to a former callback on `ManagerState`/`AppearanceState`.
 */
export type ManagerAction =
  | 'select'
  | 'import'
  | 'generateNative'
  | 'offsetChange'
  | 'download'
  | 'hideSection'
  | 'hideBoth'
  | 'apiKeysChange'
  | 'searchResultSelect'
  | 'styleChange'
  | 'blockSettingsChange'
  | 'clusterSettingsChange'
  | 'resetStyle'
  | 'previewTextChange';

/**
 * Action message payload — `action` discriminates the remaining fields,
 * which are carried as an opaque `unknown`-valued bag.
 */
export interface ManagerActionMessage {
  action: ManagerAction;
  [key: string]: unknown;
}
