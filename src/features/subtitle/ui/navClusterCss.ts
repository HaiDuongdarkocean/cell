// Nav cluster CSS — injected into content-script isolated world (ADR-018).
// ponytail: content-script cannot access popup's theme.css, so we inject
// a <style> block with the cluster's component CSS (uses tokens from themeTokens).
//
// Design-system sync (2026-07-03): cluster buttons match panel-toggle size
// (32×32) + color pattern (--color-surface bg, --color-border, --color-text).
// Light mode → dark border/text on light surface; Dark mode → light border/text
// on dark surface. Auto-switches via [data-theme] tokens from themeTokens.ts.

/** CSS for nav cluster (uses --nav-cluster-* tokens + color tokens). */
export const NAV_CLUSTER_CSS = `
.nav-cluster {
  position: absolute;
  display: flex;
  gap: var(--space-1, 4px);
  padding: var(--space-1, 4px);
  border-radius: var(--radius-md, 8px);
  background: transparent;
  border: 1px solid var(--color-border);
  z-index: var(--nav-cluster-z-index, 1000001);
  font-family: var(--font-family, system-ui, -apple-system, sans-serif);
  user-select: none;
  transition: transform var(--duration-fast, 150ms) ease, opacity var(--duration-fast, 150ms) ease;
  pointer-events: auto;
  /* ADR-018 D5-rev: drag is via grip tab only — cluster body = default cursor */
  cursor: default;
  box-shadow: none;
  /* ADR-024: position values represent the *center* of the cluster, not the
     top-left corner. translate(-50%, -50%) makes left/top the anchor point. */
  transform: translate(-50%, -50%);
}
.nav-cluster.dragging {
  box-shadow: none;
  transform: translate(-50%, -50%) scale(1.03);
}
/* Background layer with opacity so controls can change opacity without affecting
   buttons/icons. Backdrop-filter stays here to blur the video behind cluster. */
.nav-cluster::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface);
  backdrop-filter: blur(8px);
  opacity: var(--nav-cluster-bg-opacity, 0.7);
  z-index: -1;
}
.nav-cluster[aria-grabbed="true"] {
  cursor: grabbing !important;
}
/* ADR-018 D5-rev: grip tab — dedicated drag handle (touch + mouse).
   Visual: 28×4px pill bar (::before). Hit-area: 44×24px (HIG minimum).
   Attached to top edge of cluster, centered. Collapsed hides it. */
.nav-cluster-grip {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  z-index: 11;
}
.nav-cluster-grip::before {
  content: '';
  width: 28px;
  height: 4px;
  border-radius: var(--radius-full, 9999px);
  background: var(--color-text-muted);
  opacity: 0.35;
  transition: opacity var(--duration-fast, 150ms) ease, background var(--duration-fast, 150ms) ease;
}
.nav-cluster-grip:hover::before {
  opacity: 0.7;
}
.nav-cluster-grip:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm, 6px);
}
.nav-cluster.dragging .nav-cluster-grip::before {
  opacity: 0.9;
  background: var(--color-text);
}
.nav-cluster.dragging .nav-cluster-grip {
  cursor: grabbing;
}
.nav-cluster-main,
.nav-cluster-secondary {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5, 2px);
  align-items: center;
  justify-content: center;
  cursor: default !important;
}
/* Cover inter-column gap so cursor shows default — real DOM element
   is the event target instead of cluster, so gap clicks don't hit grip logic. */
.nav-cluster-gap-cover {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
  pointer-events: auto;
  cursor: default !important;
}
.nav-cluster-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--nav-cluster-btn-size, 48px);
  height: var(--nav-cluster-btn-size, 48px);
  border: 1px solid transparent;
  border-radius: var(--radius-md, 8px);
  background: transparent;
  color: var(--color-text);
  cursor: pointer !important;
  padding: 0;
  line-height: 1;
  opacity: var(--nav-cluster-btn-opacity, 0.9);
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--duration-normal, 200ms) cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color var(--duration-fast, 150ms) ease, background var(--duration-fast, 150ms) ease, color var(--duration-fast, 150ms) ease;
}
.nav-cluster-btn .nav-cluster-icon {
  width: 65%;
  height: 65%;
  display: block;
  fill: none !important;
  background: transparent !important;
}
.nav-cluster-btn .nav-cluster-icon *:not(text) {
  fill: none !important;
  background: transparent !important;
}
.nav-cluster-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-focus);
  color: var(--color-text);
}
.nav-cluster-btn:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}
.nav-cluster-btn:active,
.nav-cluster-btn--active {
  transform: scale(0.88);
  background: var(--color-surface-hover);
  border-color: var(--color-border-focus);
  color: var(--color-primary);
}
.nav-cluster.no-sub .nav-cluster-main,
.nav-cluster.no-sub .nav-cluster-secondary,
.nav-cluster.no-sub .nav-cluster-gap-cover {
  display: none;
}
.nav-cluster.no-sub .nav-cluster-no-sub {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5, 2px);
  align-items: center;
  justify-content: center;
  cursor: default !important;
}
.nav-cluster:not(.no-sub) .nav-cluster-no-sub {
  display: none;
}
.nav-cluster.collapsed {
  width: var(--nav-cluster-collapse-size, var(--nav-cluster-btn-size, 48px));
  height: var(--nav-cluster-collapse-size, var(--nav-cluster-btn-size, 48px));
  overflow: hidden;
  border-radius: 50% 0 0 50%;
  /* ADR-018 D5-rev: collapsed circle = drag handle (no buttons inside) */
  cursor: grab;
}
.nav-cluster.collapsed.dragging {
  cursor: grabbing;
}
.nav-cluster.collapsed.mirror-right {
  border-radius: 0 50% 50% 0;
  transform: translate(-50%, -50%) scaleX(-1);
}
.nav-cluster.collapsed .nav-cluster-grip {
  display: none;
}
.nav-cluster.collapsed .nav-cluster-main .nav-cluster-btn,
.nav-cluster.collapsed .nav-cluster-secondary {
  display: none;
}
`;
