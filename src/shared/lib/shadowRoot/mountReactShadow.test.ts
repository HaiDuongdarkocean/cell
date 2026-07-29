import { createElement } from 'react';
import { act } from '@testing-library/react';
import { mountReactShadow } from './mountReactShadow';

describe('mountReactShadow', () => {
  it('creates a shadow root, renders the component, and unmounts cleanly', async () => {
    const Component = () => createElement('button', { type: 'button' }, 'Click');
    const { host, shadow, unmount } = mountReactShadow(createElement(Component), {
      layer: 5,
      css: ['.btn { color: red; }'],
    });

    await act(async () => {});

    expect(host.isConnected).toBe(true);
    expect(host.style.position).toBe('fixed');
    expect(host.style.zIndex).toBe('500');
    expect(shadow).toBe(host.shadowRoot);
    expect(shadow.querySelector('button')?.textContent).toBe('Click');

    const styles = shadow.querySelectorAll('style');
    expect(styles.length).toBeGreaterThanOrEqual(1);
    expect(styles[styles.length - 1]?.textContent).toContain('.btn');

    await act(async () => unmount());
    expect(host.isConnected).toBe(false);
  });

  it('applies custom position', async () => {
    const Component = () => createElement('span');
    const { host, unmount } = mountReactShadow(createElement(Component), {
      position: 'absolute',
    });
    await act(async () => {});
    expect(host.style.position).toBe('absolute');
    await act(async () => unmount());
  });
});
