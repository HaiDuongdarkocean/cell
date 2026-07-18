// Nav cluster button atom — DOM factory (ADR-018 D1, design-system inventory).
// ponytail: pure factory, mimics existing content-script pattern (createToggleButton,
// createOverlayLayer). Content-script isolated world cannot use React.

import { NAV_CLUSTER_ICONS, type NavClusterIconName } from './navClusterIcons';

export type NavClusterButtonIcon = NavClusterIconName;

/** Icon markup mapping for cluster buttons (SVG). */
const NAV_CLUSTER_BUTTON_ICONS: Record<NavClusterButtonIcon, string> = {
  ...NAV_CLUSTER_ICONS,
};

export interface NavClusterButtonProps {
  readonly icon: NavClusterButtonIcon;
  readonly ariaLabel: string;
  readonly testId: string;
  /** Click handler (for prev/next/seek buttons). */
  readonly onClick?: () => void;
  /** Hold start (for repeat — pointerdown). Controller manages hold threshold. */
  readonly onHoldStart?: () => void;
  /** Hold end (for repeat — pointerup/pointercancel). */
  readonly onHoldEnd?: () => void;
  /** aria-pressed state (for repeat toggle). Omit if not a toggle. */
  readonly pressed?: boolean;
}

/**
 * Create a single nav cluster button with ARIA + data-testid + listeners.
 * Pure — does not attach to DOM. Caller appends to container.
 */
export function createNavClusterButton(props: NavClusterButtonProps): HTMLButtonElement {
  const { icon, ariaLabel, testId, onClick, onHoldStart, onHoldEnd, pressed } = props;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('data-testid', testId);
  btn.setAttribute('aria-label', ariaLabel);
  btn.className = 'nav-cluster-btn';
  btn.innerHTML = NAV_CLUSTER_BUTTON_ICONS[icon];

  if (pressed !== undefined) {
    btn.setAttribute('aria-pressed', String(pressed));
  }

  if (onClick) {
    btn.addEventListener('click', onClick);
  }
  if (onHoldStart) {
    btn.addEventListener('pointerdown', onHoldStart);
  }
  if (onHoldEnd) {
    btn.addEventListener('pointerup', onHoldEnd);
    btn.addEventListener('pointercancel', onHoldEnd);
  }

  return btn;
}


