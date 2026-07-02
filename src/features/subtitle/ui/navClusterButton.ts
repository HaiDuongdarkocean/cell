// Nav cluster button atom — DOM factory (ADR-018 D1, design-system inventory).
// ponytail: pure factory, mimics existing content-script pattern (createToggleButton,
// createOverlayLayer). Content-script isolated world cannot use React.

/** Icon glyph mapping for cluster buttons. */
const NAV_CLUSTER_GLYPHS: Record<NavClusterButtonIcon, string> = {
  'drag-handle': '⋯',
  prev: '◀',
  repeat: '🔁',
  next: '▶',
  rewind: '⏪',
  forward: '⏩',
};

export type NavClusterButtonIcon = 'drag-handle' | 'prev' | 'repeat' | 'next' | 'rewind' | 'forward';

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
  btn.textContent = NAV_CLUSTER_GLYPHS[icon];

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

/** Update aria-pressed on an existing button (for repeat toggle state). */
export function setButtonPressed(btn: HTMLButtonElement, pressed: boolean): void {
  btn.setAttribute('aria-pressed', String(pressed));
  btn.classList.toggle('nav-cluster-btn--active', pressed);
}
