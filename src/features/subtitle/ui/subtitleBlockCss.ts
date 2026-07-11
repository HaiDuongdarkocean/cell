// Unified subtitle block CSS — injected into content-script isolated world (ADR-025).
// Uses theme tokens from themeTokens.ts and CSS variables updated by the controller.

export const SUBTITLE_BLOCK_CSS = `
.subtitle-block {
  position: absolute;
  left: 0;
  /* --sb-top controls the CENTER of the block (not the top edge), because the
   * block is translated up by 50% of its own height. Default 75% places the
   * block center at 3/4 of the video height. */
  top: var(--sb-top, 75%);
  transform: translateY(-50%);
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md, 8px);
  border: 1px solid transparent;
  background: transparent;
  overflow: hidden;
  z-index: 1000001;
  pointer-events: auto;
  user-select: none;
  cursor: grab;
  transition: border-color var(--transition, 150ms ease), box-shadow var(--transition, 150ms ease);
}

.subtitle-block::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface, #1e293b);
  backdrop-filter: blur(8px);
  opacity: 0;
  z-index: -1;
  transition: opacity var(--transition, 150ms ease);
}

.subtitle-block.dragging {
  border-color: var(--color-border, #334155);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  cursor: grabbing;
}

.subtitle-block.dragging::before {
  opacity: var(--sb-bg-opacity, 0.7);
}

.block-body {
  display: grid;
  grid-template-columns: var(--sb-cluster-width, 84px) 1fr var(--sb-cluster-width, 84px);
  gap: var(--spacing-xs, 4px);
  align-items: center;
  min-height: 0;
}

.cluster-columns {
  grid-column: 1;
  justify-self: start;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  padding: var(--spacing-xs, 4px);
}

.cluster-column {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.no-sub-column {
  display: none;
}

.cluster-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--sb-btn-size, 32px);
  height: var(--sb-btn-size, 32px);
  border: 1px solid transparent;
  border-radius: var(--radius-md, 8px);
  background: transparent;
  color: var(--color-text, #f1f5f9);
  cursor: pointer;
  padding: 0;
  opacity: var(--sb-btn-opacity, 0.9);
  -webkit-tap-highlight-color: transparent;
  transition: transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color var(--transition, 150ms ease), background var(--transition, 150ms ease), color var(--transition, 150ms ease);
}

.cluster-btn:hover {
  background: var(--color-surface-hover, #334155);
  border-color: var(--color-border-focus, #60a5fa);
}

.cluster-btn:active {
  transform: scale(0.88);
}

.cluster-btn:focus-visible {
  outline: 2px solid var(--color-border-focus, #60a5fa);
  outline-offset: 2px;
}

.cluster-btn svg {
  width: 65%;
  height: 65%;
  display: block;
  fill: none !important;
  background: transparent !important;
}

.cluster-btn svg *:not(text) {
  fill: none !important;
  background: transparent !important;
}

.block-right-column {
  grid-column: 3;
}

.subtitle-column {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-xs, 4px);
  gap: 2px;
  text-align: center;
}

.subtitle-line {
  display: block;
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1.4;
  text-align: center;
  white-space: pre-wrap;
  max-width: 100%;
  overflow-wrap: break-word;
  cursor: text;
  pointer-events: auto;
  user-select: text;
}

.subtitle-line.target {
  font-size: var(--sb-target-font, 18px);
}

.subtitle-line.native {
  font-size: var(--sb-native-font, 14px);
}

.subtitle-block.cluster-off .cluster-columns {
  display: none;
}

.subtitle-block.cluster-off .block-body {
  grid-template-columns: 0 1fr 0;
}

/* === Card Creator entry buttons (spec §4.1) ===
   ADR-026: Card Creator buttons are part of the cluster — they follow the
   same enabled/buttonSize/buttonOpacity settings. They live in the right
   column (grid-column 3) but inherit --sb-btn-size + --sb-btn-opacity from
   the block (set in applyScale), so they scale + fade with the cluster.
   When cluster is off, applyClusterLayout hides this column. */
.block-right-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
}

/* Card Creator buttons inherit the cluster button size + opacity — no
   separate --sb-cluster-btn-size override (ADR-026: "two buttons ARE the
   cluster"). The base .cluster-btn rule already uses --sb-btn-size +
   --sb-btn-opacity, so no override is needed here. */

/* Hide Card Creator buttons on mobile width < 768px (mobile uses floating cluster) */
@media (max-width: 767px) {
  .block-right-column {
    display: none;
  }
}
`;
