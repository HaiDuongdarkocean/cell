import { describe, it, expect, jest } from '@jest/globals';
import { createNavClusterButton } from '@/features/subtitle/ui/navClusterButton';

describe('navClusterButton — atom (ADR-018 D1, design-system inventory)', () => {
  it('returns HTMLButtonElement with data-testid + aria-label + class', () => {
    const btn = createNavClusterButton({ icon: 'prev', ariaLabel: 'Previous sentence', testId: 'nav-cluster-prev' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('data-testid')).toBe('nav-cluster-prev');
    expect(btn.getAttribute('aria-label')).toBe('Previous sentence');
    expect(btn.className).toContain('nav-cluster-btn');
  });

  it('renders inline SVG for icon=prev (round-alt-arrow-left)', () => {
    const btn = createNavClusterButton({ icon: 'prev', ariaLabel: 'prev', testId: 'prev' });
    const svg = btn.querySelector('svg.nav-cluster-icon');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('circle')).not.toBeNull();
  });

  it('renders inline SVG for icon=next (round-alt-arrow-right)', () => {
    const btn = createNavClusterButton({ icon: 'next', ariaLabel: 'next', testId: 'next' });
    const svg = btn.querySelector('svg.nav-cluster-icon');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders inline SVG for icon=repeat (restart loop)', () => {
    const btn = createNavClusterButton({ icon: 'repeat', ariaLabel: 'repeat', testId: 'repeat' });
    const svg = btn.querySelector('svg.nav-cluster-icon');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders inline SVG for icon=rewind (rewind-5-seconds)', () => {
    const btn = createNavClusterButton({ icon: 'rewind', ariaLabel: 'rewind', testId: 'rewind' });
    const svg = btn.querySelector('svg.nav-cluster-icon');
    expect(svg).not.toBeNull();
  });

  it('renders inline SVG for icon=forward (rewind-10-seconds)', () => {
    const btn = createNavClusterButton({ icon: 'forward', ariaLabel: 'forward', testId: 'forward' });
    const svg = btn.querySelector('svg.nav-cluster-icon');
    expect(svg).not.toBeNull();
  });

  it('SVG icons use currentColor stroke (theme-aware)', () => {
    const btn = createNavClusterButton({ icon: 'prev', ariaLabel: 'prev', testId: 'prev' });
    const paths = btn.querySelectorAll('[stroke]');
    expect(paths.length).toBeGreaterThan(0);
    Array.from(paths).forEach((el) => {
      expect(el.getAttribute('stroke')).toBe('currentColor');
    });
  });

  it('fires onClick on click event', () => {
    const onClick = jest.fn();
    const btn = createNavClusterButton({ icon: 'prev', ariaLabel: 'prev', testId: 'prev', onClick });
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fires onHoldStart on pointerdown', () => {
    const onHoldStart = jest.fn();
    const btn = createNavClusterButton({ icon: 'repeat', ariaLabel: 'repeat', testId: 'repeat', onHoldStart });
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(onHoldStart).toHaveBeenCalledTimes(1);
  });

  it('fires onHoldEnd on pointerup', () => {
    const onHoldEnd = jest.fn();
    const btn = createNavClusterButton({ icon: 'repeat', ariaLabel: 'repeat', testId: 'repeat', onHoldEnd });
    btn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
  });

  it('fires onHoldEnd on pointercancel', () => {
    const onHoldEnd = jest.fn();
    const btn = createNavClusterButton({ icon: 'repeat', ariaLabel: 'repeat', testId: 'repeat', onHoldEnd });
    btn.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));
    expect(onHoldEnd).toHaveBeenCalledTimes(1);
  });

  it('sets aria-pressed when pressed=true', () => {
    const btn = createNavClusterButton({ icon: 'repeat', ariaLabel: 'repeat', testId: 'repeat', pressed: true });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('sets aria-pressed=false when pressed=false', () => {
    const btn = createNavClusterButton({ icon: 'repeat', ariaLabel: 'repeat', testId: 'repeat', pressed: false });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('omits aria-pressed when pressed not provided', () => {
    const btn = createNavClusterButton({ icon: 'prev', ariaLabel: 'prev', testId: 'prev' });
    expect(btn.getAttribute('aria-pressed')).toBeNull();
  });

  it('button type is button (not submit)', () => {
    const btn = createNavClusterButton({ icon: 'prev', ariaLabel: 'prev', testId: 'prev' });
    expect(btn.type).toBe('button');
  });
});
