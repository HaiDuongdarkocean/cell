import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { injectShadowCss } from '@/shared/lib/shadowRoot/injectShadowCss';
import { attachFullscreenReparenting } from '@/shared/lib/shadowRoot/mountReactShadow';

export interface OverlayPortalsParams {
  rootRef: RefObject<HTMLDivElement | null>;
  managerShadowCss?: string[];
  isMobile: boolean;
}

export interface OverlayPortals {
  managerPortalTarget: HTMLElement | null;
}

export function useOverlayPortals({ rootRef, managerShadowCss, isMobile }: OverlayPortalsParams): OverlayPortals {
  const [, setPortalTarget] = useState<HTMLElement | null>(null);
  // Body-level shadow host for the manager panel — escapes video container
  // stacking context (e.g. YouTube #movie_player z-index:0 + position:relative)
  const [managerPortalTarget, setManagerPortalTarget] = useState<HTMLElement | null>(null);
  const managerPortalRef = useRef<{ host: HTMLElement; cleanup: () => void } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const rootNode = root.getRootNode();
    if (!(rootNode instanceof ShadowRoot)) return;
    const el = document.createElement('div');
    el.style.display = 'contents';
    rootNode.appendChild(el);
    setPortalTarget(el);
    return () => {
      setPortalTarget(null);
      el.remove();
    };
  }, [rootRef]);

  // Manager panel shadow host — mounted in the video player container
  // (same parent as #cell-subtitle-root) so it shares the overlay's
  // positioning strategy: absolute within the container, no body-level
  // portal, no videoRect tracking. Fullscreen reparenting reuses the
  // same attachFullscreenReparenting helper as the overlay shadow host.
  // Local-player fallback: #cell-subtitle-root doesn't exist (only
  // mountSubtitle creates it for content-script). Use rootRef's parent
  // (.subtitleOverlay div, position:absolute+inset:0 inside .videoWrapper)
  // so the manager overlays the video stage, not document.body.
  //
  // Mobile (Sheet mode): ALWAYS mount on document.body. The Sheet atom uses
  // position:fixed which must be relative to the viewport. If the portal host
  // is inside a container-type:inline-size ancestor (e.g. .subtitleOverlay in
  // the local player), contain:layout creates a containing block for
  // position:fixed, breaking the Sheet's viewport-relative positioning — the
  // resize handle gets clipped by .stage's overflow:hidden.
  useEffect(() => {
    if (!managerShadowCss || managerShadowCss.length === 0) return;
    // Timing gotcha (ADR-097): this effect runs during mountSubtitle's
    // flushSync commit, BEFORE mountSubtitle assigns host.id, so
    // getElementById('cell-subtitle-root') is null here and the fallback
    // below places the portal inside the overlay's shadow root. The panel
    // renders correctly there (verified by the e2e spec); if the portal
    // ever needs to live in the light-DOM video container, assign the host
    // id before the flush instead of changing this fallback order.
    const overlayHost = document.getElementById('cell-subtitle-root');
    const container = isMobile
      ? document.body
      : (overlayHost?.parentElement ?? rootRef.current?.parentElement ?? document.body);
    const host = document.createElement('div');
    host.id = 'cell-manager-portal';
    host.style.cssText = 'position:absolute;inset:0;pointer-events:none;/* max-int: intentional top-most overlay */z-index:2147483647;';
    container.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const cleanupCss = injectShadowCss(shadow, { css: managerShadowCss });
    const inner = document.createElement('div');
    inner.style.display = 'contents';
    shadow.appendChild(inner);
    setManagerPortalTarget(inner);
    const cleanupFullscreen = attachFullscreenReparenting(host, container);
    managerPortalRef.current = { host, cleanup: () => { cleanupFullscreen(); cleanupCss(); host.remove(); } };
    return () => {
      setManagerPortalTarget(null);
      managerPortalRef.current?.cleanup();
      managerPortalRef.current = null;
    };
  }, [rootRef, managerShadowCss, isMobile]);

  return { managerPortalTarget };
}
