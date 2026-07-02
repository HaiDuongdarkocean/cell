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

  it('sets textContent to glyph for icon=prev', () => {
    const btn = createNavClusterButton({ icon: 'prev', ariaLabel: 'prev', testId: 'prev' });
    expect(btn.textContent).toBe('◀');
  });

  it('sets textContent to glyph for icon=next', () => {
    const btn = createNavClusterButton({ icon: 'next', ariaLabel: 'next', testId: 'next' });
    expect(btn.textContent).toBe('▶');
  });

  it('sets textContent to glyph for icon=repeat', () => {
    const btn = createNavClusterButton({ icon: 'repeat', ariaLabel: 'repeat', testId: 'repeat' });
    expect(btn.textContent).toBe('🔁');
  });

  it('sets textContent to glyph for icon=rewind', () => {
    const btn = createNavClusterButton({ icon: 'rewind', ariaLabel: 'rewind', testId: 'rewind' });
    expect(btn.textContent).toBe('⏪');
  });

  it('sets textContent to glyph for icon=forward', () => {
    const btn = createNavClusterButton({ icon: 'forward', ariaLabel: 'forward', testId: 'forward' });
    expect(btn.textContent).toBe('⏩');
  });

  it('sets textContent to glyph for icon=drag-handle', () => {
    const btn = createNavClusterButton({ icon: 'drag-handle', ariaLabel: 'drag', testId: 'drag' });
    expect(btn.textContent).toBe('⋯');
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
