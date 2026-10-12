import { createElement, type ReactNode } from 'react';
import { act } from '@testing-library/react';
import { mountReactShadow } from './mountReactShadow';

describe('mountReactShadow', () => {
  it('wraps the component in the given provider with the inner container', async () => {
    let received: HTMLElement | null = null;
    const Provider = ({ container, children }: { container: HTMLElement; children?: ReactNode }) => {
      received = container;
      return createElement('div', { 'data-cell-id': 'provider-wrap' }, children);
    };
    const Component = () => createElement('span', { 'data-cell-id': 'inner' });
    const { shadow, rootEl, unmount } = mountReactShadow(createElement(Component), {
      provider: Provider,
    });

    await act(async () => {});

    expect(received).toBe(rootEl);
    const wrap = shadow.querySelector('[data-cell-id="provider-wrap"]');
    expect(wrap?.querySelector('[data-cell-id="inner"]')).not.toBeNull();

    await act(async () => unmount());
  });

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

  it('traps non-Escape keyboard events inside the shadow root', async () => {
    const Component = () => createElement('input', { type: 'text', 'data-cell-id': 'trap-input' });
    const { host, shadow, unmount } = mountReactShadow(createElement(Component), {});
    await act(async () => {});

    const input = shadow.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();

    const documentHandler = jest.fn();
    document.addEventListener('keydown', documentHandler);

    // Non-Escape key should be stopped at the shadow boundary.
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
    expect(documentHandler).not.toHaveBeenCalled();

    // Escape should be allowed through for close handlers.
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(documentHandler).toHaveBeenCalled();

    document.removeEventListener('keydown', documentHandler);
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

  it('re-parents the host to the fullscreen element and back', async () => {
    const Component = () => createElement('span');
    const { host, unmount } = mountReactShadow(createElement(Component), {
      reparentOnFullscreen: true,
    });
    await act(async () => {});
    expect(host.parentElement).toBe(document.body);

    const fsContainer = document.createElement('div');
    document.body.appendChild(fsContainer);
    (document as unknown as { fullscreenElement: HTMLElement }).fullscreenElement = fsContainer;
    document.dispatchEvent(new Event('fullscreenchange'));

    await act(async () => {});
    expect(host.parentElement).toBe(fsContainer);

    (document as unknown as { fullscreenElement: HTMLElement | null }).fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    await act(async () => {});
    expect(host.parentElement).toBe(document.body);

    fsContainer.remove();
    await act(async () => unmount());
  });

  it('projects chrome-marked hosts into the overlay chrome slot', async () => {
    const pmHost = document.createElement('div');
    const pmShadow = pmHost.attachShadow({ mode: 'open' });
    pmShadow.appendChild(document.createElement('slot')).name = 'cell-host-chrome';
    document.body.appendChild(pmHost);

    const Component = () => createElement('span');
    const { host, unmount } = mountReactShadow(createElement(Component), {
      reparentOnFullscreen: true,
      chromeLayer: true,
    });
    await act(async () => {});

    (document as unknown as { fullscreenElement: HTMLElement }).fullscreenElement = pmHost;
    document.dispatchEvent(new Event('fullscreenchange'));

    await act(async () => {});
    expect(host.parentElement).toBe(pmHost);
    expect(host.slot).toBe('cell-host-chrome');

    (document as unknown as { fullscreenElement: HTMLElement | null }).fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    await act(async () => {});
    expect(host.parentElement).toBe(document.body);
    expect(host.slot).toBe('');

    pmHost.remove();
    await act(async () => unmount());
  });

  it('projects chrome hosts when mounting while fullscreen is already active', async () => {
    const pmHost = document.createElement('div');
    const pmShadow = pmHost.attachShadow({ mode: 'open' });
    pmShadow.appendChild(document.createElement('slot')).name = 'cell-host-chrome';
    document.body.appendChild(pmHost);
    (document as unknown as { fullscreenElement: HTMLElement }).fullscreenElement = pmHost;

    const Component = () => createElement('span');
    const { host, unmount } = mountReactShadow(createElement(Component), {
      reparentOnFullscreen: true,
      chromeLayer: true,
    });
    await act(async () => {});

    expect(host.parentElement).toBe(pmHost);
    expect(host.slot).toBe('cell-host-chrome');

    (document as unknown as { fullscreenElement: HTMLElement | null }).fullscreenElement = null;
    pmHost.remove();
    await act(async () => unmount());
  });

  it('keeps chrome-marked hosts on the normal path when no chrome slot exists', async () => {
    const fsContainer = document.createElement('div');
    document.body.appendChild(fsContainer);

    const Component = () => createElement('span');
    const { host, unmount } = mountReactShadow(createElement(Component), {
      reparentOnFullscreen: true,
      chromeLayer: true,
    });
    await act(async () => {});

    (document as unknown as { fullscreenElement: HTMLElement }).fullscreenElement = fsContainer;
    document.dispatchEvent(new Event('fullscreenchange'));

    await act(async () => {});
    expect(host.parentElement).toBe(fsContainer);
    expect(host.slot).toBe('');

    (document as unknown as { fullscreenElement: HTMLElement | null }).fullscreenElement = null;
    fsContainer.remove();
    await act(async () => unmount());
  });

  it('skips the exit restore when the original parent is inside the host', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const Component = () => createElement('span');
    const { host, unmount } = mountReactShadow(createElement(Component), {
      parent: container,
      reparentOnFullscreen: true,
    });
    await act(async () => {});
    expect(host.parentElement).toBe(container);

    // Player Mode scenario: the host was moved to body, then the container
    // was moved inside the host's light DOM — restoring host into it would
    // create a cycle.
    document.body.appendChild(host);
    host.appendChild(container);
    (document as unknown as { fullscreenElement: HTMLElement | null }).fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    await act(async () => {});
    expect(host.parentNode).not.toBe(container);
    expect(host.isConnected).toBe(true);

    container.remove();
    await act(async () => unmount());
  });
});
