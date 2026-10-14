import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

const PARENT_ORIGIN = 'https://host.example';
const CHILD_ORIGIN = 'https://player.example';
const CHILD_PATH = '/embed/abc';

jest.mock('@/shared/lib/dom/isChildFrame', () => ({
  isChildFrame: jest.fn(() => true),
}));

jest.mock('@/shared/lib/dom/frameOrigin', () => ({
  resolveParentFrameOrigin: jest.fn(() => PARENT_ORIGIN),
  resolveIframeOrigin: jest.requireActual<
    typeof import('@/shared/lib/dom/frameOrigin')
  >('@/shared/lib/dom/frameOrigin').resolveIframeOrigin,
  isResolvableHttpOrigin: jest.requireActual<
    typeof import('@/shared/lib/dom/frameOrigin')
  >('@/shared/lib/dom/frameOrigin').isResolvableHttpOrigin,
  isIframeContentWindow: jest.requireActual<
    typeof import('@/shared/lib/dom/frameOrigin')
  >('@/shared/lib/dom/frameOrigin').isIframeContentWindow,
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(async () => ({})),
}));

import {
  installIframePlayerModeBridge,
  installIframeMediaBridge,
  requestIframePlayerModeEnter,
  requestIframePlayerModeExit,
} from './iframePlayerModeBridge';
import { isChildFrame } from '@/shared/lib/dom/isChildFrame';
import { hasIframeVideo, iframeHasVideo, setIframeVideo } from '@/shared/lib/dom/iframeVideoRegistry';

const mockIsChildFrame = isChildFrame as jest.MockedFunction<typeof isChildFrame>;

function addIframe(src: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  document.body.appendChild(iframe);
  return iframe;
}

describe('iframePlayerModeBridge top-side listener', () => {
  let cleanup: () => void;

  beforeEach(() => {
    mockIsChildFrame.mockReturnValue(false);
    cleanup = installIframePlayerModeBridge();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    document.head.querySelectorAll('[data-tihoka-player-mode]').forEach((el) => el.remove());
    jest.restoreAllMocks();
  });

  function dispatchEnter(iframe: HTMLIFrameElement, frameSrc: string, origin = CHILD_ORIGIN): void {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__Tihoka_PLAYER_MODE_ENTER', frameSrc },
        origin,
        source: iframe.contentWindow,
      }),
    );
  }

  it('ignores ENTER when source is not an iframe contentWindow', async () => {
    addIframe(`${CHILD_ORIGIN}${CHILD_PATH}`);
    const postSpy = jest.spyOn(window, 'postMessage');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__Tihoka_PLAYER_MODE_ENTER', frameSrc: `${CHILD_ORIGIN}${CHILD_PATH}` },
        origin: CHILD_ORIGIN,
        source: null,
      }),
    );
    await Promise.resolve();
    expect(postSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: '__Tihoka_PLAYER_MODE_ENTERED' }),
      expect.anything(),
    );
  });

  it('ignores ENTER when frameSrc origin does not match event.origin', async () => {
    const iframe = addIframe(`${CHILD_ORIGIN}${CHILD_PATH}`);
    dispatchEnter(iframe, `https://other.example${CHILD_PATH}`, CHILD_ORIGIN);
    await Promise.resolve();
    expect(document.querySelector('[data-tihoka-player-mode-host]')).toBeNull();
  });

  it('accepts ENTER from a real iframe and replies at its origin', async () => {
    const iframe = addIframe(`${CHILD_ORIGIN}${CHILD_PATH}`);
    const postSpy = jest
      .spyOn(iframe.contentWindow!, 'postMessage')
      .mockImplementation(() => {}) as jest.Mock;
    dispatchEnter(iframe, `${CHILD_ORIGIN}${CHILD_PATH}`, CHILD_ORIGIN);
    await Promise.resolve();
    await Promise.resolve();
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: '__Tihoka_PLAYER_MODE_ENTERED' }),
      CHILD_ORIGIN,
    );
  });
});

describe('installIframeMediaBridge top-side', () => {
  beforeEach(() => {
    mockIsChildFrame.mockReturnValue(false);
    installIframeMediaBridge();
  });

  afterEach(() => {
    for (const iframe of document.querySelectorAll('iframe')) {
      setIframeVideo(iframe, false);
    }
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  function dispatchMedia(iframe: HTMLIFrameElement, state: string, origin = CHILD_ORIGIN): void {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__Tihoka_IFRAME_MEDIA', state },
        origin,
        source: iframe.contentWindow,
      }),
    );
  }

  it('marks the sending iframe when it announces a video', () => {
    const iframe = addIframe(`${CHILD_ORIGIN}${CHILD_PATH}`);
    dispatchMedia(iframe, 'present');
    expect(iframeHasVideo(iframe)).toBe(true);
    expect(hasIframeVideo()).toBe(true);
  });

  it('unmarks on absent and on iframe navigation load', () => {
    const iframe = addIframe(`${CHILD_ORIGIN}${CHILD_PATH}`);
    dispatchMedia(iframe, 'present');
    dispatchMedia(iframe, 'absent');
    expect(hasIframeVideo()).toBe(false);

    dispatchMedia(iframe, 'present');
    iframe.dispatchEvent(new Event('load'));
    expect(hasIframeVideo()).toBe(false);
  });

  it('ignores messages whose source is not a child iframe window', () => {
    addIframe(`${CHILD_ORIGIN}${CHILD_PATH}`);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__Tihoka_IFRAME_MEDIA', state: 'present' },
        origin: CHILD_ORIGIN,
        source: null,
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__Tihoka_IFRAME_MEDIA', state: 'present' },
        origin: CHILD_ORIGIN,
        source: window,
      }),
    );
    expect(hasIframeVideo()).toBe(false);
  });
});

describe('iframePlayerModeBridge child-side', () => {
  beforeEach(() => {
    mockIsChildFrame.mockReturnValue(true);
    jest.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('sends ENTER to the resolved parent origin with minimized frameSrc', () => {
    void requestIframePlayerModeEnter(50);
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      {
        type: '__Tihoka_PLAYER_MODE_ENTER',
        frameSrc: window.location.origin + window.location.pathname,
      },
      PARENT_ORIGIN,
    );
  });

  it('resolves true on ENTERED from the parent origin', async () => {
    const promise = requestIframePlayerModeEnter(500);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__Tihoka_PLAYER_MODE_ENTERED' },
        origin: PARENT_ORIGIN,
      }),
    );
    await expect(promise).resolves.toBe(true);
  });

  it('drops forged ENTERED from a foreign origin', async () => {
    jest.useFakeTimers();
    const promise = requestIframePlayerModeEnter(100);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__Tihoka_PLAYER_MODE_ENTERED' },
        origin: 'https://evil.example',
      }),
    );
    jest.advanceTimersByTime(200);
    await expect(promise).resolves.toBe(false);
  });

  it('sends EXIT to the resolved parent origin', () => {
    requestIframePlayerModeExit();
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      {
        type: '__Tihoka_PLAYER_MODE_EXIT',
        frameSrc: window.location.origin + window.location.pathname,
      },
      PARENT_ORIGIN,
    );
  });
});
