// Nav cluster CSS — injected into content-script isolated world (ADR-018).
// ponytail: content-script cannot access popup's theme.css, so we inject
// a <style> block with the cluster's component CSS (uses tokens from themeTokens).
//
// Design-system sync (2026-07-03): cluster buttons are 48×48 (desktop touch
// target), collapsed circle is 32×32, using --color-surface / --color-border /
// --color-text.
// Light mode → dark border/text on light surface; Dark mode → light border/text
// on dark surface. Auto-switches via [data-theme] tokens from themeTokens.ts.

/** CSS for nav cluster (uses --nav-cluster-* tokens + color tokens). */
export const NAV_CLUSTER_CSS = `
.nav-cluster {
  position: absolute;
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: var(--radius-pill);
  background: transparent;
  border: 1px solid var(--color-border);
  z-index: var(--nav-cluster-z-index, 1000001);
  font-family: var(--font-family);
  user-select: none;
  transition: transform var(--duration-fast) ease, opacity var(--duration-fast) ease;
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
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  backdrop-filter: blur(var(--space-2));
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
  top: calc((var(--space-5) + var(--space-0-5)) * -1);
  left: 50%;
  transform: translateX(-50%);
  width: var(--touch-target-mobile);
  height: var(--space-6);
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
  width: var(--space-7);
  height: var(--space-1);
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  opacity: 0.35;
  transition: opacity var(--duration-fast) ease, background var(--duration-fast) ease;
}
.nav-cluster-grip:hover::before {
  opacity: 0.7;
}
.nav-cluster-grip:focus-visible {
  outline: var(--space-0-5) solid var(--color-border-focus);
  outline-offset: var(--space-0-5);
  border-radius: var(--radius-sm);
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
  gap: var(--space-0-5);
  align-items: center;
  justify-content: center;
  cursor: default !important;
}
/* Cover inter-column gap so cursor shows default — real DOM element
   is the event target instead of cluster, so gap clicks don't hit grip logic. */
.nav-cluster-gap-cover {
  position: absolute;
  top: var(--space-1);
  bottom: var(--space-1);
  left: 50%;
  width: var(--space-1);
  transform: translateX(-50%);
  pointer-events: auto;
  cursor: default !important;
}
.nav-cluster-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--nav-cluster-btn-size, var(--space-12));
  height: var(--nav-cluster-btn-size, var(--space-12));
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text);
  cursor: pointer !important;
  padding: 0;
  line-height: 1;
  opacity: var(--nav-cluster-btn-opacity, 0.9);
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--duration-normal) cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color var(--duration-fast) ease, background var(--duration-fast) ease, color var(--duration-fast) ease;
}
.nav-cluster-btn .nav-cluster-icon {
  width: var(--nav-cluster-icon-size-ratio);
  height: var(--nav-cluster-icon-size-ratio);
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
  outline: var(--space-0-5) solid var(--color-border-focus);
  outline-offset: var(--space-0-5);
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
  gap: var(--space-0-5);
  align-items: center;
  justify-content: center;
  cursor: default !important;
}
.nav-cluster:not(.no-sub) .nav-cluster-no-sub {
  display: none;
}
.nav-cluster.collapsed {
  width: var(--nav-cluster-collapse-size, var(--nav-cluster-btn-size, var(--space-12)));
  height: var(--nav-cluster-collapse-size, var(--nav-cluster-btn-size, var(--space-12)));
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

/* Respect user preference for reduced motion on the nav cluster. */
@media (prefers-reduced-motion: reduce) {
  .nav-cluster,
  .nav-cluster-btn,
  .nav-cluster-grip::before {
    transition: none !important;
  }
  .nav-cluster.dragging,
  .nav-cluster-btn:active,
  .nav-cluster-btn--active,
  .nav-cluster.collapsed.mirror-right {
    transform: none !important;
  }
}
`.trim();
