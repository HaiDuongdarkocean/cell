import { createOffsetBadge, formatBadgeTimer } from '@/features/subtitle/ui/subtitleOffsetBadge';

describe('subtitleOffsetBadge', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('formatBadgeTimer', () => {
    it('formats 120000ms → "2:00"', () => {
      expect(formatBadgeTimer(120000)).toBe('2:00');
    });

    it('formats 83000ms → "1:23"', () => {
      expect(formatBadgeTimer(83000)).toBe('1:23');
    });

    it('formats 5000ms → "0:05"', () => {
      expect(formatBadgeTimer(5000)).toBe('0:05');
    });

    it('formats 0ms → "0:00"', () => {
      expect(formatBadgeTimer(0)).toBe('0:00');
    });

    it('formats negative → "0:00" (clamped)', () => {
      expect(formatBadgeTimer(-1000)).toBe('0:00');
    });

    it('formats 1000ms → "0:01"', () => {
      expect(formatBadgeTimer(1000)).toBe('0:01');
    });

    it('pads single-digit seconds', () => {
      expect(formatBadgeTimer(3000)).toBe('0:03');
      expect(formatBadgeTimer(9000)).toBe('0:09');
    });
  });

  describe('createOffsetBadge', () => {
    it('creates badge with role=status and aria-label', () => {
      const { badge } = createOffsetBadge(container, () => {});
      expect(badge.getAttribute('role')).toBe('status');
      expect(badge.getAttribute('aria-label')).toContain('Đang xem thử');
      expect(badge.getAttribute('title')).toBe('Bấm để hủy và đặt lại');
    });

    it('hidden by default (display none)', () => {
      const { badge } = createOffsetBadge(container, () => {});
      expect(badge.style.display).toBe('none');
    });

    it('contains dot + label "Xem thử · " + timer', () => {
      const { badge } = createOffsetBadge(container, () => {});
      const dot = badge.querySelector('[data-testid="offset-lazy-badge-dot"]');
      expect(dot).not.toBeNull();
      expect(badge.textContent).toContain('Xem thử ·');
      const timer = badge.querySelector('[data-testid="offset-lazy-badge-timer"]');
      expect(timer).not.toBeNull();
    });

    it('show() makes badge visible + sets timer from lastActionAt', () => {
      const { badge, show } = createOffsetBadge(container, () => {});
      const now = Date.now();
      show(now);
      expect(badge.style.display).toBe('inline-flex');
      const timer = badge.querySelector('[data-testid="offset-lazy-badge-timer"]') as HTMLSpanElement;
      // Just shown → remaining ≈ 120000ms → "2:00"
      expect(timer.textContent).toBe('2:00');
    });

    it('show() with elapsed time computes remaining', () => {
      const { badge, show } = createOffsetBadge(container, () => {});
      const now = Date.now();
      // lastActionAt 37 seconds ago → remaining ≈ 83s → "1:23"
      show(now - 37000);
      const timer = badge.querySelector('[data-testid="offset-lazy-badge-timer"]') as HTMLSpanElement;
      expect(timer.textContent).toBe('1:23');
    });

    it('hide() sets display none', () => {
      const { badge, show, hide } = createOffsetBadge(container, () => {});
      show(Date.now());
      expect(badge.style.display).toBe('inline-flex');
      hide();
      expect(badge.style.display).toBe('none');
    });

    it('updateTimer() sets timer text + aria-label dynamic', () => {
      const { badge, updateTimer } = createOffsetBadge(container, () => {});
      updateTimer(83000);
      const timer = badge.querySelector('[data-testid="offset-lazy-badge-timer"]') as HTMLSpanElement;
      expect(timer.textContent).toBe('1:23');
      expect(badge.getAttribute('aria-label')).toContain('1 phút 23 giây');
    });

    it('click triggers onReset callback', () => {
      let resetCalled = false;
      const { badge } = createOffsetBadge(container, () => {
        resetCalled = true;
      });
      badge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(resetCalled).toBe(true);
    });

    it('Enter key triggers onReset (keyboard accessible)', () => {
      let resetCalled = false;
      const { badge } = createOffsetBadge(container, () => {
        resetCalled = true;
      });
      badge.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(resetCalled).toBe(true);
    });

    it('Space key triggers onReset', () => {
      let resetCalled = false;
      const { badge } = createOffsetBadge(container, () => {
        resetCalled = true;
      });
      badge.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(resetCalled).toBe(true);
    });

    it('badge is focusable (tabIndex=0)', () => {
      const { badge } = createOffsetBadge(container, () => {});
      expect(badge.tabIndex).toBe(0);
    });

    it('destroy() removes badge from DOM', () => {
      const { badge, destroy } = createOffsetBadge(container, () => {});
      expect(container.contains(badge)).toBe(true);
      destroy();
      expect(container.contains(badge)).toBe(false);
    });

    it('destroy() removes event listeners (click after destroy does nothing)', () => {
      let resetCalled = false;
      const { badge, destroy } = createOffsetBadge(container, () => {
        resetCalled = true;
      });
      destroy();
      badge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // Listener removed — callback not invoked (no error, just no-op)
      expect(resetCalled).toBe(false);
    });

    it('injects pulse keyframes once (idempotent)', () => {
      // First badge injects keyframes
      createOffsetBadge(container, () => {});
      const style1 = document.getElementById('offset-badge-pulse-keyframes');
      expect(style1).not.toBeNull();
      // Second badge does not duplicate
      createOffsetBadge(container, () => {});
      const styles = document.querySelectorAll('#offset-badge-pulse-keyframes');
      expect(styles.length).toBe(1);
    });
  });
});
