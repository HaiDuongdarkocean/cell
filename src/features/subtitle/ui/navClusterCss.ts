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
  cursor: move !important;
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
.nav-cluster-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--nav-cluster-size-md, 48px);
  height: var(--nav-cluster-size-md, 48px);
  border: none;
  background: transparent;
  color: var(--color-text, #f1f5f9);
  cursor: pointer !important;
  padding: 0;
  line-height: 1;
  -webkit-tap-highlight-color: transparent;
  transition: none;
}
.nav-cluster .nav-cluster-btn {
  cursor: pointer !important;
}
}
.nav-cluster-btn .nav-cluster-icon {
  width: 60%;
  height: 60%;
  display: block;
}
.nav-cluster-btn:hover {
  color: var(--color-primary, #60a5fa);
}
.nav-cluster-btn:focus-visible {
  outline: 2px solid var(--color-primary, #60a5fa);
  outline-offset: 2px;
}
.nav-cluster-btn--active {
  color: var(--color-primary, #60a5fa);
}
.nav-cluster-btn--active .nav-cluster-icon {
  animation: nav-cluster-spin 800ms var(--ease-standard, ease);
}
@keyframes nav-cluster-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
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
.nav-cluster.collapsed .nav-cluster-main .nav-cluster-btn,
.nav-cluster.collapsed .nav-cluster-secondary {
  display: none;
}
`;
