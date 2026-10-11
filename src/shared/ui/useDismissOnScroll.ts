import { useEffect, type RefObject } from 'react';

/**
 * Dismiss a floating surface when something OUTSIDE it scrolls — a
 * fixed-positioned popover would otherwise detach from its trigger.
 *
 * Scrolls inside the surface's own scrollable subtree are ignored: `scroll`
 * does not bubble, so the capture-phase listener sees every descendant scroll
 * — including the menu's own list, which must not close it.
 *
 * Only a scroll that can actually move the anchor dismisses: the scrolled
 * element must contain the anchor (its scroll containers) or be the
 * document — a scroll in a sibling subtree (e.g. an auto-aligning cue list
 * beside the menu trigger) leaves the anchor in place and is ignored.
 *
 * `anchorRef` (usually the trigger) resolves the owning document/window and
 * shadow scope — it is mounted before the surface exists, which may be
 * portaled to document.body on first render and remounted into a shadow root
 * on the next commit.
 */
export function useDismissOnScroll(
  active: boolean,
  surfaceRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const anchor = anchorRef.current ?? surfaceRef.current ?? document.body;
    const doc = anchor.ownerDocument;
    const win = doc.defaultView ?? window;
    const rootNode = anchor.getRootNode();
    const scope: Document | ShadowRoot = rootNode instanceof ShadowRoot ? rootNode : doc;
    const onScroll = (e: Event): void => {
      const surface = surfaceRef.current;
      if (surface && e.composedPath().includes(surface)) return;
      const anchorEl = anchorRef.current;
      const scrolled = e.target;
      if (anchorEl && scrolled instanceof Element && !scrolled.contains(anchorEl)) {
        return;
      }
      onDismiss();
    };
    win.addEventListener('scroll', onScroll, true);
    // scroll is non-composed — it never crosses the shadow boundary, so the
    // window listener misses scrolls inside the panel's shadow root.
    if (scope !== doc) scope.addEventListener('scroll', onScroll, true);
    return () => {
      win.removeEventListener('scroll', onScroll, true);
      if (scope !== doc) scope.removeEventListener('scroll', onScroll, true);
    };
  }, [active, surfaceRef, anchorRef, onDismiss]);
}
