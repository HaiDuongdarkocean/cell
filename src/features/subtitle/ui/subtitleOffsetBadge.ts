/**
 * Subtitle offset lazy badge — DOM factory (ADR-019 Contract 5).
 *
 * Pill top-right overlay, "Xem thử · MM:SS" + dot pulse.
 * Click badge = reset (hủy xem thử).
 * Timer đếm ngược 2 phút (AUTO_COMMIT_MS) — hiển thị remaining time.
 *
 * Mimic subtitleManagerPanel pattern: cssText inline, var(--token), aria-*.
 * Source of truth UI: docs/mockups/mockup-subtitle-time-offset.html (.lazy-badge)
 *
 * @see docs/mockups/mockup-subtitle-time-offset.html (v2.2 approved)
 */

import { AUTO_COMMIT_MS } from '../logic/subtitleOffset';

/** Badge API — returned by createOffsetBadge. */
export interface OffsetBadgeApi {
  readonly badge: HTMLDivElement;
  /** Show badge + start timer countdown from lastActionAt. */
  show(lastActionAt: number): void;
  /** Hide badge + stop timer. */
  hide(): void;
  /** Update timer text (called externally mỗi giây hoặc trên timeupdate). */
  updateTimer(remainingMs: number): void;
  /** Destroy — remove badge from DOM, cleanup listeners. */
  destroy(): void;
}

/** Format remaining ms → "M:SS" string. */
export function formatBadgeTimer(remainingMs: number): string {
  if (remainingMs <= 0) return '0:00';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Create offset lazy badge — DOM factory pattern.
 *
 * @param container - Overlay container (badge appended here, absolute top-right)
 * @param onReset - Callback khi click badge (reset = hủy xem thử)
 * @returns Badge API
 */
export function createOffsetBadge(
  container: HTMLElement,
  onReset: () => void,
): OffsetBadgeApi {
  const badge = document.createElement('div');
  badge.setAttribute('data-testid', 'offset-lazy-badge');
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-label', 'Đang xem thử, bấm để hủy');
  badge.setAttribute('title', 'Bấm để hủy và đặt lại');
  badge.style.cssText = `
    position: absolute;
    top: 10px; right: 10px;
    z-index: 1000001;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px var(--spacing-sm, 8px);
    background: var(--color-warning-subtle, rgba(245, 158, 11, 0.1));
    color: var(--color-warning, #f59e0b);
    border: 1px solid var(--color-warning, #f59e0b);
    border-radius: var(--radius-full, 9999px);
    font-family: var(--font-family, sans-serif);
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  `;
  badge.tabIndex = 0;

  // Dot pulse
  const dot = document.createElement('span');
  dot.setAttribute('data-testid', 'offset-lazy-badge-dot');
  dot.style.cssText = `
    width: 6px; height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: offset-badge-pulse 1.5s ease-in-out infinite;
  `;

  // Inject keyframes once (idempotent — check if already injected)
  if (!document.getElementById('offset-badge-pulse-keyframes')) {
    const style = document.createElement('style');
    style.id = 'offset-badge-pulse-keyframes';
    style.textContent = `
      @keyframes offset-badge-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }

  // Label "Xem thử · "
  const label = document.createElement('span');
  label.textContent = 'Xem thử · ';

  // Timer text
  const timer = document.createElement('span');
  timer.setAttribute('data-testid', 'offset-lazy-badge-timer');
  timer.textContent = '2:00';

  badge.appendChild(dot);
  badge.appendChild(label);
  badge.appendChild(timer);
  badge.style.display = 'none'; // hidden by default

  container.appendChild(badge);

  // === Handlers ===
  const handleClick = (): void => {
    onReset();
  };
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onReset();
    }
  };
  badge.addEventListener('click', handleClick);
  badge.addEventListener('keydown', handleKeydown);

  // === API ===

  function show(lastActionAt: number): void {
    badge.style.display = 'inline-flex';
    const now = Date.now();
    const remaining = Math.max(0, AUTO_COMMIT_MS - (now - lastActionAt));
    updateTimer(remaining);
  }

  function hide(): void {
    badge.style.display = 'none';
  }

  function updateTimer(remainingMs: number): void {
    timer.textContent = formatBadgeTimer(remainingMs);
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    badge.setAttribute(
      'aria-label',
      `Đang xem thử, còn ${minutes} phút ${seconds} giây, bấm để hủy`,
    );
  }

  function destroy(): void {
    badge.removeEventListener('click', handleClick);
    badge.removeEventListener('keydown', handleKeydown);
    badge.remove();
  }

  return {
    badge,
    show,
    hide,
    updateTimer,
    destroy,
  };
}
