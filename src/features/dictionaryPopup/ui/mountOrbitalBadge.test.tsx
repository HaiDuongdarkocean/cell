import { describe, expect, it, jest, beforeAll, afterEach } from '@jest/globals';
import * as React from 'react';
import { mountOrbitalBadge, type OrbitalBadgeMountController } from './mountOrbitalBadge';
import type { PanelMountController } from '../controller/panelBridge';
import { UNIVERSAL_PANEL_HOST_ID } from '@/shared/lib/dom/cellUiHosts';
import type { OrbitalBadgeHandle, OrbitalBadgeProps } from './OrbitalBadge';

jest.mock('./OrbitalBadge', () => ({
  OrbitalBadge: React.forwardRef<OrbitalBadgeHandle, OrbitalBadgeProps>(function OrbitalBadgeMock(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      setPreset: jest.fn(),
      setExpanded: jest.fn(),
      getState: () => ({ expanded: false, preset: 'center' as const, center: { x: 0, y: 0 } }),
    }));
    return React.createElement('div', { 'data-cell-id': 'orbital-badge-mock' });
  }),
}));

beforeAll(() => {
  if (typeof PointerEvent === 'undefined') {
    class MockPointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  document.querySelectorAll('.js-cell-orbital-badge-host').forEach((el) => el.remove());
});

function makePanelController(open = true): PanelMountController & { close: jest.Mock; isOpen: jest.Mock } {
  const panelHost = document.createElement('div');
  panelHost.id = UNIVERSAL_PANEL_HOST_ID;
  document.body.appendChild(panelHost);
  return {
    open: jest.fn(() => Promise.resolve()),
    close: jest.fn(),
    isOpen: jest.fn(() => open),
    getHosts: () => [panelHost],
    sendToCard: jest.fn(() => Promise.resolve()),
  };
}

function pointerDownOn(el: Element | Document): void {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true }));
}

describe('mountOrbitalBadge panel dismiss guard', () => {
  let badge: OrbitalBadgeMountController | undefined;
  afterEach(() => { badge?.destroy(); badge = undefined; });

  it('keeps the panel open on pointerdown inside a dictionary popup host', () => {
    const panelController = makePanelController();
    badge = mountOrbitalBadge({ panelController });

    const popupHost = document.createElement('div');
    popupHost.className = 'js-cell-popup-host';
    popupHost.appendChild(document.createElement('span'));
    document.body.appendChild(popupHost);
    pointerDownOn(popupHost.firstChild as Element);

    expect(panelController.close).not.toHaveBeenCalled();
    popupHost.remove();
  });

  it('keeps the panel open on pointerdown inside the card creator host', () => {
    const panelController = makePanelController();
    badge = mountOrbitalBadge({ panelController });

    const cardHost = document.createElement('div');
    cardHost.id = 'cell-card-creator-host';
    document.body.appendChild(cardHost);
    pointerDownOn(cardHost);

    expect(panelController.close).not.toHaveBeenCalled();
    cardHost.remove();
  });

  it('closes the panel on pointerdown on plain page content', () => {
    const panelController = makePanelController();
    badge = mountOrbitalBadge({ panelController });

    const pageEl = document.createElement('div');
    document.body.appendChild(pageEl);
    pointerDownOn(pageEl);

    expect(panelController.close).toHaveBeenCalledTimes(1);
    pageEl.remove();
  });

  it('still closes the panel on pointerdown inside the subtitle root', () => {
    const panelController = makePanelController();
    badge = mountOrbitalBadge({ panelController });

    const subtitleRoot = document.createElement('div');
    subtitleRoot.id = 'cell-subtitle-root';
    document.body.appendChild(subtitleRoot);
    pointerDownOn(subtitleRoot);

    expect(panelController.close).toHaveBeenCalledTimes(1);
    subtitleRoot.remove();
  });

  it('does not close the panel on pointerdown inside the panel host', () => {
    const panelController = makePanelController();
    badge = mountOrbitalBadge({ panelController });

    pointerDownOn(panelController.getHosts()[0]!);

    expect(panelController.close).not.toHaveBeenCalled();
  });

  it('does not close an already-closed panel on outside pointerdown', () => {
    const panelController = makePanelController(false);
    badge = mountOrbitalBadge({ panelController });

    pointerDownOn(document.body);

    expect(panelController.close).not.toHaveBeenCalled();
  });
});

describe('mountOrbitalBadge panel-open suppression', () => {
  let badge: OrbitalBadgeMountController | undefined;
  afterEach(() => { badge?.destroy(); badge = undefined; });

  function makeOpenController(initiallyOpen: boolean): PanelMountController & { emit: (open: boolean) => void } {
    const listeners = new Set<(open: boolean) => void>();
    let open = initiallyOpen;
    const panelHost = document.createElement('div');
    panelHost.id = UNIVERSAL_PANEL_HOST_ID;
    document.body.appendChild(panelHost);
    return {
      open: jest.fn(() => Promise.resolve()),
      close: jest.fn(),
      isOpen: jest.fn(() => open),
      getHosts: () => [panelHost],
      sendToCard: jest.fn(() => Promise.resolve()),
      onOpenChange: (listener: (open: boolean) => void) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
      emit: (next: boolean) => {
        open = next;
        for (const listener of listeners) listener(next);
      },
    };
  }

  const badgeHost = (): HTMLElement =>
    document.querySelector<HTMLElement>('.js-cell-orbital-badge-host')!;

  it('hides the badge host while the panel is open and restores it on close', () => {
    const panelController = makeOpenController(false);
    badge = mountOrbitalBadge({ panelController });
    expect(badgeHost().style.display).toBe('');

    panelController.emit(true);
    expect(badgeHost().style.display).toBe('none');

    panelController.emit(false);
    expect(badgeHost().style.display).toBe('');
  });

  it('mounts suppressed when the panel is already open', () => {
    const panelController = makeOpenController(true);
    badge = mountOrbitalBadge({ panelController });
    expect(badgeHost().style.display).toBe('none');
  });

  it('keeps the badge suppressed across fullscreenchange display-restore', () => {
    const panelController = makeOpenController(false);
    badge = mountOrbitalBadge({ panelController });

    panelController.emit(true);
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(badgeHost().style.display).toBe('none');

    panelController.emit(false);
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(badgeHost().style.display).toBe('');
  });
});

describe('mountOrbitalBadge Player Mode host attach', () => {
  let badge: OrbitalBadgeMountController | undefined;
  afterEach(() => {
    badge?.destroy();
    badge = undefined;
    document.querySelectorAll('#cell-subtitle-root').forEach((el) => el.remove());
  });

  function makePmHost(): HTMLElement {
    const host = document.createElement('div');
    host.id = 'cell-subtitle-root';
    host.setAttribute('data-cell-player-mode', 'true');
    host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
    return host;
  }

  const badgeHost = (pmHost?: HTMLElement): HTMLElement =>
    (pmHost?.shadowRoot?.querySelector<HTMLElement>('.js-cell-orbital-badge-host')
      ?? document.querySelector<HTMLElement>('.js-cell-orbital-badge-host'))!;

  it('attaches the badge into the PM host shadow when Player Mode is active without fullscreen', () => {
    const pmHost = makePmHost();
    badge = mountOrbitalBadge({});
    expect(badgeHost(pmHost).getRootNode()).toBe(pmHost.shadowRoot);
  });

  it('reattach moves the badge into the PM host shadow when PM starts without fullscreenchange', () => {
    badge = mountOrbitalBadge({});
    expect(badgeHost().getRootNode()).toBe(document);

    const pmHost = makePmHost();
    badge.reattach();
    expect(badgeHost(pmHost).getRootNode()).toBe(pmHost.shadowRoot);
  });

  it('reattach returns the badge to body when Player Mode ends', () => {
    const pmHost = makePmHost();
    badge = mountOrbitalBadge({});
    expect(badgeHost(pmHost).getRootNode()).toBe(pmHost.shadowRoot);

    pmHost.removeAttribute('data-cell-player-mode');
    badge.reattach();
    expect(badgeHost().getRootNode()).toBe(document);
    expect(badgeHost().parentElement).toBe(document.body);
  });
});
