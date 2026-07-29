// Nav cluster layout CSS — injected into content-script isolated world (ADR-018).
// Visual/themable styles (color, spacing, radius, z-index, transitions, etc.)
// live in NavCluster.module.css. NAV_CLUSTER_CSS only contains layout-only
// rules (positioning, transform, display, flex, cursor, pointer-events, etc.).

/** Layout-only CSS for the nav cluster. */
export const NAV_CLUSTER_CSS = `
.nav-cluster {
  position: absolute;
  display: flex;
  pointer-events: auto;
  cursor: default;
  user-select: none;
  transform: translate(-50%, -50%);
}
.nav-cluster.dragging {
  transform: translate(-50%, -50%) scale(1.03);
}
.nav-cluster[aria-grabbed="true"] {
  cursor: grabbing !important;
}
.nav-cluster-grip {
  position: absolute;
  top: calc((var(--space-5) + var(--space-0-5)) * -1);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
}
.nav-cluster.dragging .nav-cluster-grip {
  cursor: grabbing;
}
.nav-cluster-main,
.nav-cluster-secondary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: default !important;
}
.nav-cluster-gap-cover {
  position: absolute;
  top: var(--space-1);
  bottom: var(--space-1);
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  cursor: default !important;
}
.nav-cluster-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer !important;
}
.nav-cluster-btn:active,
.nav-cluster-btn--active {
  transform: scale(0.88);
}
.nav-cluster.no-sub .nav-cluster-main,
.nav-cluster.no-sub .nav-cluster-secondary,
.nav-cluster.no-sub .nav-cluster-gap-cover {
  display: none;
}
.nav-cluster.no-sub .nav-cluster-no-sub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: default !important;
}
.nav-cluster:not(.no-sub) .nav-cluster-no-sub {
  display: none;
}
.nav-cluster.collapsed {
  overflow: hidden;
  cursor: grab;
}
.nav-cluster.collapsed.dragging {
  cursor: grabbing;
}
.nav-cluster.collapsed.mirror-right {
  transform: translate(-50%, -50%) scaleX(-1);
}
.nav-cluster.collapsed .nav-cluster-grip {
  display: none;
}
.nav-cluster.collapsed .nav-cluster-main .nav-cluster-btn,
.nav-cluster.collapsed .nav-cluster-secondary {
  display: none;
}
`.trim();
