/**
 * ManagerLayer — molecule that renders `SubtitleManagerPanel` once.
 *
 * Single render path for mobile (Sheet) and desktop (`.panelLayer` backdrop).
 * Owns the persisted sheet height (`SUBTITLE_MANAGER_SHEET_HEIGHT_VH`) so
 * consumers (`SubtitlePanels.tsx` overlay, `HostManagerSheet.tsx` host) stop
 * duplicating the getStorage/setStorage + clamp logic.
 *
 * Spec: docs/specs/subtitle-panels-atom-decomposition.md (Decision D1, Task 4)
 */

import { useEffect, useMemo, useState } from 'react';
import { SubtitleManagerPanel } from './SubtitleManagerPanel';
import { Sheet } from '@/shared/ui/Sheet';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ManagerState } from './subtitlePanelsTypes';
import sharedStyles from './subtitlePanelsShared.module.css';

export interface ManagerLayerProps {
  /** Manager state — the SSOT props for `SubtitleManagerPanel`. */
  manager: ManagerState;
  /** Mobile renders inside `Sheet`; desktop renders inside `.panelLayer`. */
  isMobile: boolean;
  /** Desktop slide-out animation flag (forwarded only on desktop branch). */
  exiting?: boolean;
  /** Close handler — wired to Sheet onClose + desktop backdrop click. */
  onClose: () => void;
  /** Drives `generateNativeDisabled` on the panel. */
  generateNativeEnabled: boolean;
}

/** Clamp sheet height to the 20-95vh range (matches existing persist logic). */
function clampVh(vh: number): number {
  return Math.max(20, Math.min(95, vh));
}

export function ManagerLayer({
  manager,
  isMobile,
  exiting,
  onClose,
  generateNativeEnabled,
}: ManagerLayerProps): React.JSX.Element | null {
  // Persisted sheet height (% of viewport, 20-95). null = not yet loaded.
  const [sheetHeightVh, setSheetHeightVh] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStorage<Record<string, number>>(STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH)
      .then((data) => {
        const stored = data[STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH];
        if (cancelled || typeof stored !== 'number' || !Number.isFinite(stored)) return;
        setSheetHeightVh(clampVh(stored));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Build panel props once — shared by both mobile + desktop branches.
  const managerProps = useMemo(
    () => ({
      targetItems: manager.targetItems,
      nativeItems: manager.nativeItems,
      targetActiveIndex: manager.targetActiveIndex,
      nativeActiveIndex: manager.nativeActiveIndex,
      onSelect: manager.onSelect,
      onClose,
      onImport: manager.onImport,
      onGenerateNative: manager.onGenerateNative,
      onOffsetChange: manager.onOffsetChange,
      offsetMs: manager.offsetMs,
      generateNativeDisabled: !generateNativeEnabled,
      appearance: manager.appearance,
      hasSearchKeys: manager.hasSearchKeys,
      apiKeys: manager.apiKeys,
      onApiKeysChange: manager.onApiKeysChange,
      onSearchResultSelect: manager.onSearchResultSelect,
      onDownload: manager.onDownload,
      onHideSection: manager.onHideSection,
      onHideBoth: manager.onHideBoth,
      targetHidden: manager.targetHidden,
      nativeHidden: manager.nativeHidden,
      bothHidden: manager.bothHidden,
    }),
    [manager, onClose, generateNativeEnabled],
  );

  if (isMobile) {
    return (
      <Sheet
        open
        onClose={onClose}
        aria-label="Subtitle manager"
        initialHeight={
          sheetHeightVh != null
            ? Math.round(window.innerHeight * (sheetHeightVh / 100))
            : undefined
        }
        onHeightChange={(h) => {
          const vh = Math.round((h / window.innerHeight) * 100);
          const clamped = clampVh(vh);
          setSheetHeightVh(clamped);
          setStorage({ [STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH]: clamped }).catch(
            () => undefined,
          );
        }}
        data-cell-id="subtitle-manager-layer"
      >
        <SubtitleManagerPanel {...managerProps} inSheet />
      </Sheet>
    );
  }

  return (
    <div
      className={sharedStyles.panelLayer}
      data-cell-id="subtitle-manager-layer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <SubtitleManagerPanel {...managerProps} exiting={exiting} />
    </div>
  );
}
