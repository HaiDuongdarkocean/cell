// Nav cluster CSS — injected into content-script isolated world (ADR-018).
// ponytail: content-script cannot access popup's theme.css, so we inject
// a <style> block with the cluster's component CSS (uses tokens from themeTokens).

/** CSS for nav cluster (uses --nav-cluster-* tokens + color tokens). */
export const NAV_CLUSTER_CSS = `
.nav-cluster {
  position: absolute;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md, 8px);
  background: rgba(15, 23, 42, var(--nav-cluster-bg-opacity-default, 0.7));
  backdrop-filter: blur(8px);
  z-index: var(--nav-cluster-z-index, 1000001);
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
  transition: transform 150ms ease, opacity 150ms ease;
  pointer-events: auto;
}
.nav-cluster-main,
.nav-cluster-secondary {
  display: flex;
  gap: 2px;
  align-items: center;
}
.nav-cluster-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--nav-cluster-size-md, 48px);
  height: var(--nav-cluster-size-md, 48px);
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: rgba(255, 255, 255, var(--nav-cluster-btn-opacity-default, 0.9));
  color: var(--color-text, #0f172a);
  font-size: 20px;
  cursor: pointer;
  transition: background 150ms ease, transform 100ms ease;
  padding: 0;
  line-height: 1;
}
.nav-cluster-btn:hover {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.05);
}
.nav-cluster-btn:active {
  transform: scale(0.95);
}
.nav-cluster-btn:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}
.nav-cluster-btn--active {
  background: var(--color-primary, #2563eb);
  color: var(--color-text-inverse, #ffffff);
}
.nav-cluster-drag-handle {
  cursor: grab;
  font-size: 16px;
  opacity: 0.7;
}
.nav-cluster-drag-handle:hover {
  opacity: 1;
}
.nav-cluster.no-sub .nav-cluster-secondary {
  display: none;
}
.nav-cluster.collapsed {
  width: var(--nav-cluster-collapse-size, 32px);
  height: var(--nav-cluster-collapse-size, 32px);
  overflow: hidden;
  border-radius: 50% 0 0 50%;
}
.nav-cluster.collapsed.mirror-right {
  border-radius: 0 50% 50% 0;
  transform: scaleX(-1);
}
.nav-cluster.collapsed .nav-cluster-main .nav-cluster-btn:not(.nav-cluster-drag-handle),
.nav-cluster.collapsed .nav-cluster-secondary {
  display: none;
}
`;
