import { render } from '@testing-library/react';
import { LockShield } from './LockShield';

describe('LockShield', () => {
  it('renders a shield element with the lock-shield marker', () => {
    const { container } = render(<LockShield />);
    const shield = container.querySelector('[data-cell-id="lock-shield"]');
    expect(shield).not.toBeNull();
    expect(shield?.getAttribute('aria-hidden')).toBe('true');
  });

  it('swallows pointer events — they never reach the element below', () => {
    const below = document.createElement('button');
    const seen: string[] = [];
    below.addEventListener('pointerdown', () => seen.push('pointerdown'));
    below.addEventListener('click', () => seen.push('click'));
    below.addEventListener('contextmenu', () => seen.push('contextmenu'));
    below.addEventListener('wheel', () => seen.push('wheel'));

    const { container } = render(
      <div onPointerDown={() => seen.push('parent:pointerdown')} onClick={() => seen.push('parent:click')}>
        <LockShield />
      </div>,
    );
    const shield = container.querySelector('[data-cell-id="lock-shield"]');
    expect(shield).not.toBeNull();

    for (const type of ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'wheel', 'mousedown', 'mouseup']) {
      shield!.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    }
    shield!.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));

    expect(seen).toEqual([]);
  });

  it('prevents the default action of cancelable events', () => {
    const { container } = render(<LockShield />);
    const shield = container.querySelector('[data-cell-id="lock-shield"]')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    shield.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true });
    shield.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('stops swallowing after unmount', () => {
    const { container, unmount } = render(
      <div>
        <LockShield />
      </div>,
    );
    const shield = container.querySelector('[data-cell-id="lock-shield"]')!;
    unmount();
    const seen: string[] = [];
    document.addEventListener('click', () => seen.push('doc:click'), { once: true });
    document.body.appendChild(shield);
    shield.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    shield.remove();
    expect(seen).toEqual(['doc:click']);
  });
});
