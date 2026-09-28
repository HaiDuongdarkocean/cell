import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { togglePlayerMode } from '@/features/subtitle/logic/playerModeGeometry';
import { isChildFrame, requestIframePlayerModeEnter, requestIframePlayerModeExit } from '@/features/subtitle/logic/iframePlayerModeBridge';
import { resolveParentFrameOrigin } from '@/shared/lib/dom/frameOrigin';
import { t } from '@/shared/i18n';
import type { ToastVariant } from './SubtitleToast';

export interface PlayerModeParams {
  playerMode: boolean;
  setPlayerMode: Dispatch<SetStateAction<boolean>>;
  onTogglePlayerMode?: (active: boolean) => void;
  addToast: (message: string, variant?: ToastVariant) => void;
  drainPendingRestore: () => void;
}

export function usePlayerMode({
  playerMode,
  setPlayerMode,
  onTogglePlayerMode,
  addToast,
  drainPendingRestore,
}: PlayerModeParams): () => Promise<void> {
  // Listen for ENTERED/EXITED from the top-frame bridge so the child overlay
  // mounts/unmounts when the user presses `g` on the top document (not inside
  // the iframe). When the child triggers PM itself, requestIframePlayerModeEnter
  // resolves on ENTERED and handleTogglePlayerMode sets playerMode — this
  // listener is redundant but harmless (setPlayerMode is idempotent).
  useEffect(() => {
    if (!isChildFrame()) return;
    const parentOrigin = resolveParentFrameOrigin();
    const onMessage = (e: MessageEvent): void => {
      if (e.origin !== parentOrigin) return;
      if (e.data?.type === '__CELL_PLAYER_MODE_ENTERED') {
        setPlayerMode(true);
      } else if (e.data?.type === '__CELL_PLAYER_MODE_EXITED') {
        setPlayerMode(false);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setPlayerMode]);

  const handleTogglePlayerMode = useCallback(async (): Promise<void> => {
    if (isChildFrame()) {
      // Guard: if the iframe (or video inside) is currently in fullscreen,
      // exit it first so the top frame can enter Cell Player Mode fullscreen
      // on the host container. Fullscreen is from the child browsing context,
      // so we must exit it from the child, then ask the top frame.
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      if (playerMode) {
        requestIframePlayerModeExit();
        setPlayerMode(false);
        return;
      }
      // Ask the top-frame bridge to request fullscreen on the host container.
      if (await requestIframePlayerModeEnter()) {
        setPlayerMode(true);
      } else {
        addToast(t('subtitle.playerMode.unreachable'), 'error');
      }
      return;
    }

    // Exit site fullscreen BEFORE toggling playerMode. The fullscreen element
    // is top-layer and cannot be reparented into shadow DOM without Chrome
    // exiting fullscreen. await ensures the document is no longer fullscreen
    // when PlayerModeOverlay mounts, so the player-move effect runs the normal
    // flow (reparent into video stage). After mount, the native-fullscreen
    // effect requests fullscreen on #cell-subtitle-root — SSOT with Flow 2.
    // If the site was already in fullscreen, the exit consumed the user
    // gesture, so requestFullscreen() may fail → CSS fallback covers this.
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    // Drain a pending split-view restore BEFORE PM mounts: otherwise PM's
    // findPlayerContainer runs while the shell is still inside the doomed
    // stageCell — PM snapshots that as its originalParent, the deferred
    // restore then removes the wrapper (detaching the stageCell), and PM's
    // exit-restore strands the player in a detached subtree (video lost,
    // findPlayerContainer returns null forever).
    drainPendingRestore();
    setPlayerMode((prev) => togglePlayerMode(prev));
  }, [addToast, playerMode, drainPendingRestore, setPlayerMode]);

  useEffect(() => {
    onTogglePlayerMode?.(playerMode);
  }, [onTogglePlayerMode, playerMode]);

  // Player Mode: live inside document.fullscreenElement when host is
  // fullscreen (top layer renders above everything — no z-index hack needed).
  // attachFullscreenReparenting (mountReactShadow) already moves #cell-subtitle-root
  // into document.fullscreenElement on fullscreenchange. Player Mode just needs
  // to NOT override that by moving cell root to document.body.
  //
  // When NOT fullscreen: fall back to body reparenting (escape video container
  // stacking context). PlayerModeOverlay moves host <video> into the video stage.
  //
  // When fullscreen: keep cell root inside fullscreen element. Host <video>
  // moves into the video stage (shadow DOM child). Seamless UX: exiting
  // Player Mode does NOT exit host fullscreen.
  const playerModeOriginalParent = useRef<HTMLElement | null>(null);
  const playerModeSavedStyles = useRef<{ zIndex: string; position: string; inset: string } | null>(null);

  useEffect(() => {
    const host = document.querySelector('#cell-subtitle-root');
    if (!(host instanceof HTMLElement)) return;
    if (playerMode) {
      playerModeSavedStyles.current = {
        zIndex: host.style.zIndex,
        position: host.style.position,
        inset: host.style.inset,
      };
      // max-int: intentional top-most overlay
      host.style.zIndex = '2147483647';
      host.style.position = 'fixed';
      host.style.inset = '0';
      host.setAttribute('data-cell-player-mode', 'true');
      if (host.parentElement && host.parentElement !== document.body) {
        playerModeOriginalParent.current = host.parentElement;
        // Also save on the host element itself — PlayerModeOverlay (child)
        // effect may run before or after this effect depending on React's
        // effect ordering. Storing on the host ensures the exit branch can
        // always recover the original parent regardless of who moved it.
        const hostWithProp = host as HTMLElement & { __cellOriginalParent?: HTMLElement };
        if (!hostWithProp.__cellOriginalParent) {
          hostWithProp.__cellOriginalParent = host.parentElement;
        }
        document.body.appendChild(host);
      }
    } else {
      host.removeAttribute('data-cell-player-mode');
      const saved = playerModeSavedStyles.current;
      if (saved) {
        host.style.zIndex = saved.zIndex;
        host.style.position = saved.position;
        host.style.inset = saved.inset;
        playerModeSavedStyles.current = null;
      }
      const hostWithProp = host as HTMLElement & { __cellOriginalParent?: HTMLElement };
      const originalParent = playerModeOriginalParent.current
        ?? hostWithProp.__cellOriginalParent
        ?? null;
      if (originalParent && host.parentElement !== originalParent) {
        if (!host.contains(originalParent)) {
          originalParent.appendChild(host);
          playerModeOriginalParent.current = null;
          hostWithProp.__cellOriginalParent = undefined;
        }
      } else {
        playerModeOriginalParent.current = null;
        hostWithProp.__cellOriginalParent = undefined;
      }
    }
  }, [playerMode]);

  // Native fullscreen — SSOT with Flow 2 (iframe bridge). After Player Mode
  // mounts and the host reparenting effect above moves #cell-subtitle-root to
  // document.body with position:fixed;inset:0 (CSS fallback), request native
  // fullscreen on the host. Top-layer rendering guarantees nothing can
  // z-index over it — no z-index:2147483647 hack needed.
  //
  // Transient activation from the toggle gesture (keyboard `g` or button
  // click) is still valid when this effect runs (React render+effects <100ms,
  // activation window ~5s). If the site was already in fullscreen,
  // handleTogglePlayerMode exited it first (consuming the gesture), so
  // requestFullscreen() may fail here — the CSS fallback covers that case.
  //
  // On Esc: browser exits fullscreen → fullscreenchange → setPlayerMode(false).
  // PlayerModeOverlay's Esc handler skips preventDefault when in native
  // fullscreen so the browser can process the exit.
  useEffect(() => {
    if (!playerMode) return;
    const host = document.querySelector('#cell-subtitle-root');
    if (!(host instanceof HTMLElement)) return;

    let ourFullscreenActive = false;

    const onFullscreenChange = (): void => {
      if (document.fullscreenElement === host) {
        ourFullscreenActive = true;
      } else if (ourFullscreenActive) {
        // Our fullscreen exited (Esc, browser UI, or another element) → exit PM.
        ourFullscreenActive = false;
        setPlayerMode(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Request native fullscreen. requestFullscreen() auto-exits any existing
    // fullscreen in one step — same user gesture, no Chrome block.
    if (document.fullscreenElement !== host) {
      host.requestFullscreen().catch(() => { /* CSS fallback active */ });
    } else {
      ourFullscreenActive = true;
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (ourFullscreenActive && document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [playerMode, setPlayerMode]);

  return handleTogglePlayerMode;
}
