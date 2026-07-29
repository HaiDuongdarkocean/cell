import { describe, expect, it, jest, beforeAll, beforeEach, afterEach } from '@jest/globals';
import * as React from 'react';
import { mountPopupDictionary } from './mountPopupDictionary';

jest.mock('./PopupDictionary', () => ({
  PopupDictionary: function PopupDictionaryMock(props: { anchor: { top: number } }) {
    return React.createElement(
      'div',
      { 'data-testid': 'popup-dictionary-mock', 'data-anchor-top': props.anchor.top },
      'Popup',
    );
  },
}));

const defaultAnchor = { top: 70, left: 100, right: 150, bottom: 100 };

beforeAll(() => {
  if (typeof PointerEvent === 'undefined') {
    class MockPointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MockPointerEvent as unknown as typeof MouseEvent;
  }
});

beforeEach(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true });
});

afterEach(() => {
  document.querySelectorAll('.js-cell-popup-host').forEach((el) => el.remove());
});

describe('mountPopupDictionary', () => {
  it('creates a shadow host and removes it on destroy', () => {
    const controller = mountPopupDictionary({
      anchor: defaultAnchor,
      langCode: 'en',
      sourceLang: 'en',
      targetLang: 'vi',
    });

    const host = document.querySelector('.js-cell-popup-host');
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).not.toBeNull();

    controller.destroy();
    expect(document.querySelector('.js-cell-popup-host')).toBeNull();
  });

  it('closes on click outside the popup', () => {
    const onClose = jest.fn();
    mountPopupDictionary({
      anchor: defaultAnchor,
      langCode: 'en',
      sourceLang: 'en',
      targetLang: 'vi',
      onClose,
    });

    const host = document.querySelector('.js-cell-popup-host');
    expect(host).not.toBeNull();

    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(onClose).toHaveBeenCalled();
    expect(document.querySelector('.js-cell-popup-host')).toBeNull();
  });

  it('does not close on click inside the popup', () => {
    const onClose = jest.fn();
    mountPopupDictionary({
      anchor: defaultAnchor,
      langCode: 'en',
      sourceLang: 'en',
      targetLang: 'vi',
      onClose,
    });

    const host = document.querySelector('.js-cell-popup-host') as HTMLElement;
    expect(host).not.toBeNull();

    host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();
  });

  it('does not close when the orbital badge is clicked', () => {
    const onClose = jest.fn();
    mountPopupDictionary({
      anchor: defaultAnchor,
      langCode: 'en',
      sourceLang: 'en',
      targetLang: 'vi',
      onClose,
    });

    const badge = document.createElement('div');
    badge.className = 'js-cell-orbital-badge-host';
    document.body.appendChild(badge);

    badge.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.js-cell-popup-host')).not.toBeNull();

    badge.remove();
  });
});
