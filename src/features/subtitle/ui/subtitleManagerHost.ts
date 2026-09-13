import { useEffect, useRef, useState } from 'react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { SubtitleApiKey } from '@/entities/settings';
import type { SubtitleSearchResult } from '@/features/subtitle/logic/subtitleSearchTypes';
import { serializeManagerState } from '@/features/subtitle/logic/managerStateSerializer';
import {
  requestManagerOpenOnHost,
  sendManagerStateUpdate,
  confirmManagerClosed,
  onManagerAction,
  onManagerCloseFromHost,
} from '@/features/subtitle/logic/iframeManagerBridgeChild';
import { isChildFrame } from '@/features/subtitle/logic/iframePlayerModeBridge';
import type { ManagerState, OffsetState } from './subtitlePanelsTypes';

export interface ManagerHostDelegationParams {
  managerOpen: boolean;
  isMobile: boolean;
  manager: ManagerState | undefined;
  offset: OffsetState | undefined;
  generateNativeEnabled: boolean;
  closeManager: () => void;
}

export interface ManagerHostDelegation {
  managerOpenOnHost: boolean;
}

export function useManagerHostDelegation({
  managerOpen,
  isMobile,
  manager,
  offset,
  generateNativeEnabled,
  closeManager,
}: ManagerHostDelegationParams): ManagerHostDelegation {
  const [managerOpenOnHost, setManagerOpenOnHost] = useState(false);

  // Child-iframe mobile: delegate manager panel rendering to the host frame.
  // Serialize state + ask host to mount the panel; on success skip the
  // in-iframe portal so we don't render two copies. On failure, fall back to
  // rendering in-iframe as normal (managerOpenOnHost stays false).
  // Re-runs when isMobile changes → viewport-responsive reparenting:
  //   desktop→mobile: delegate to host (sheet escapes iframe bounds).
  //   mobile→desktop: handled by the host-close effect below.
  useEffect(() => {
    if (!managerOpen || !isChildFrame() || !isMobile) return;
    if (!manager) return;

    let cancelled = false;
    const serialized = serializeManagerState(manager, offset, !generateNativeEnabled);
    void requestManagerOpenOnHost(serialized).then((ok) => {
      if (cancelled) return;
      if (ok) setManagerOpenOnHost(true);
      // If !ok, fallback: don't set managerOpenOnHost, render in-iframe as normal
    });

    return () => { cancelled = true; };
  }, [managerOpen, manager, offset, generateNativeEnabled, isMobile]);

  // Viewport-responsive reparenting: when viewport grows to desktop while
  // the sheet is on the host page, close the host sheet so the in-iframe
  // portal (inside the video container) can resume rendering.
  useEffect(() => {
    if (!managerOpenOnHost || isMobile) return;
    confirmManagerClosed();
    setManagerOpenOnHost(false);
  }, [managerOpenOnHost, isMobile]);

  // Map host-forwarded manager actions to the local manager callbacks.
  // Guard: ignore actions after close (managerOpen false).
  useEffect(() => {
    if (!managerOpenOnHost || !manager) return;
    const cleanup = onManagerAction((action, args) => {
      if (!managerOpen) return;
      const role = args.role as 'target' | 'native';
      const index = args.index as number;
      const ms = args.ms as number;
      switch (action) {
        case 'select': manager.onSelect(role, index); break;
        case 'import': manager.onImport?.(role); break;
        case 'generateNative': manager.onGenerateNative?.(); break;
        case 'offsetChange': manager.onOffsetChange?.(role, ms); break;
        case 'download': manager.onDownload?.(role, index); break;
        case 'hideSection': manager.onHideSection?.(role); break;
        case 'hideBoth': manager.onHideBoth?.(); break;
        case 'apiKeysChange': manager.onApiKeysChange(args.keys as SubtitleApiKey[]); break;
        case 'searchResultSelect': manager.onSearchResultSelect(args.result as SubtitleSearchResult, role); break;
        case 'styleChange': manager.appearance?.onStyleChange(role, args.partial as Partial<OverlayStyleConfig>); break;
        case 'blockSettingsChange': manager.appearance?.onBlockSettingsChange(args.partial as Partial<SubtitleBlockSettings>); break;
        case 'clusterSettingsChange': manager.appearance?.onClusterSettingsChange(args.partial as Partial<NavClusterSettings>); break;
        case 'resetStyle': manager.appearance?.onResetStyle(role); break;
        case 'previewTextChange': manager.appearance?.onPreviewTextChange(role, args.text as string); break;
      }
    });
    return cleanup;
  }, [managerOpenOnHost, manager, managerOpen]);

  // Host requested close (user pressed close button on the host-rendered panel).
  useEffect(() => {
    if (!managerOpenOnHost) return;
    const cleanup = onManagerCloseFromHost(() => {
      closeManager();
    });
    return cleanup;
  }, [managerOpenOnHost, closeManager]);

  // State sync: push serialized state to host on change (throttled 100ms).
  const stateSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!managerOpenOnHost || !manager) return;
    if (stateSyncRef.current) clearTimeout(stateSyncRef.current);
    stateSyncRef.current = setTimeout(() => {
      sendManagerStateUpdate(serializeManagerState(manager, offset, !generateNativeEnabled));
    }, 100);
    return () => { if (stateSyncRef.current) clearTimeout(stateSyncRef.current); };
  }, [managerOpenOnHost, manager, offset, generateNativeEnabled]);

  // Cleanup on close: notify host the child closed the manager + reset flag.
  useEffect(() => {
    if (!managerOpen && managerOpenOnHost) {
      confirmManagerClosed();
      setManagerOpenOnHost(false);
    }
  }, [managerOpen, managerOpenOnHost]);

  return { managerOpenOnHost };
}
