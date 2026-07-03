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
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md, 8px);
  background: transparent;
  border: 1px solid var(--color-border, #334155);
  z-index: var(--nav-cluster-z-index, 1000001);
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
  transition: transform 150ms ease, opacity 150ms ease;
  pointer-events: auto;
  cursor: move !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
/* Background layer with opacity so controls can change opacity without affecting
   buttons/icons. Backdrop-filter stays here to blur the video behind cluster. */
.nav-cluster::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface, #1e293b);
  backdrop-filter: blur(8px);
  opacity: var(--nav-cluster-bg-opacity, 0.7);
  z-index: -1;
}
.nav-cluster[aria-grabbed="true"] {
  cursor: grabbing !important;
}
.nav-cluster-main,
.nav-cluster-secondary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
  cursor: default !important;
}
/* Cover inter-column gap so cursor shows default (not move) — real DOM element
   is the event target instead of cluster, so border-zone drag check (e.target
   === cluster) fails here. ponytail: 1 div, no JS logic. */
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
  color: var(--color-text, #f1f5f9);
  cursor: pointer !important;
  padding: 0;
  line-height: 1;
  opacity: var(--nav-cluster-btn-opacity, 0.9);
  -webkit-tap-highlight-color: transparent;
  transition: transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 150ms ease, background 150ms ease, color 150ms ease;
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
  background: var(--color-surface-hover, #334155);
  border-color: var(--color-border-focus, #60a5fa);
  color: var(--color-text, #f1f5f9);
}
.nav-cluster-btn:focus-visible {
  outline: 2px solid var(--color-border-focus, #60a5fa);
  outline-offset: 2px;
}
.nav-cluster-btn:active,
.nav-cluster-btn--active {
  transform: scale(0.88);
  background: var(--color-surface-hover, #334155);
  border-color: var(--color-border-focus, #60a5fa);
  color: var(--color-primary, #60a5fa);
}
.nav-cluster.no-sub .nav-cluster-main,
.nav-cluster.no-sub .nav-cluster-secondary,
.nav-cluster.no-sub .nav-cluster-gap-cover {
  display: none;
}
.nav-cluster.no-sub .nav-cluster-no-sub {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
}
.nav-cluster.collapsed.mirror-right {
  border-radius: 0 50% 50% 0;
  transform: scaleX(-1);
}
.nav-cluster.collapsed .nav-cluster-main .nav-cluster-btn,
.nav-cluster.collapsed .nav-cluster-secondary {
  display: none;
}
`;
