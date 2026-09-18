import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import {
  installManagerSheetBridge,
  setHostSheetCallbacks,
  sendManagerActionToChild,
  sendManagerCloseToChild,
} from './iframeManagerBridgeHost';
import {
  MGR_OPEN_MSG, MGR_STATE_MSG, MGR_CLOSED_MSG,
  MGR_OPENED_MSG, MGR_ACTION_MSG, MGR_CLOSE_MSG,
} from './iframeManagerBridgeTypes';
import type { SerializedManagerState } from './iframeManagerBridgeTypes';

const CHILD_ORIGIN = 'https://player.example';
const CHILD_SRC = `${CHILD_ORIGIN}/embed/abc`;

function makeState(): SerializedManagerState {
  return {
    targetItems: [],
    nativeItems: [],
    targetActiveIndex: 0,
    nativeActiveIndex: 0,
    targetOffsetMs: 0,
    nativeOffsetMs: 0,
    hasSearchKeys: false,
    apiKeys: [],
    generateNativeDisabled: false,
  };
}

function addIframe(src: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  document.body.appendChild(iframe);
  return iframe;
}

describe('iframeManagerBridgeHost', () => {
  let cleanup: () => void;
  const onOpen = jest.fn();
  const onStateUpdate = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    setHostSheetCallbacks({ onOpen, onStateUpdate, onClose });
    cleanup = installManagerSheetBridge();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  function dispatch(
    data: Record<string, unknown>,
    source: Window | null,
    origin: string,
  ): void {
    window.dispatchEvent(new MessageEvent('message', { data, source, origin }));
  }

  it('accepts MGR_OPEN from a real iframe and acks at its explicit origin', () => {
    const iframe = addIframe(CHILD_SRC);
    const postSpy = jest
      .spyOn(iframe.contentWindow!, 'postMessage')
      .mockImplementation(() => {}) as jest.Mock;

    dispatch(
      { type: MGR_OPEN_MSG, frameSrc: CHILD_SRC, state: makeState() },
      iframe.contentWindow,
      CHILD_ORIGIN,
    );

    expect(onOpen).toHaveBeenCalledWith(makeState(), CHILD_SRC);
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: MGR_OPENED_MSG, ok: true }),
      CHILD_ORIGIN,
    );
  });

  it('drops forged MGR_OPEN posted by the top window itself', () => {
    addIframe(CHILD_SRC);
    dispatch(
      { type: MGR_OPEN_MSG, frameSrc: CHILD_SRC, state: makeState() },
      null,
      CHILD_ORIGIN,
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('drops messages from an origin with no matching iframe', () => {
    const iframe = addIframe(CHILD_SRC);
    dispatch(
      { type: MGR_OPEN_MSG, frameSrc: 'https://other.example/embed', state: makeState() },
      iframe.contentWindow,
      'https://other.example',
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('drops messages whose frameSrc origin lies about the sender', () => {
    const iframe = addIframe(CHILD_SRC);
    dispatch(
      { type: MGR_OPEN_MSG, frameSrc: 'https://other.example/embed', state: makeState() },
      iframe.contentWindow,
      CHILD_ORIGIN,
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('routes MGR_STATE and MGR_CLOSED from a real iframe to callbacks', () => {
    const iframe = addIframe(CHILD_SRC);
    dispatch(
      { type: MGR_STATE_MSG, frameSrc: CHILD_SRC, state: { targetActiveIndex: 2 } },
      iframe.contentWindow,
      CHILD_ORIGIN,
    );
    expect(onStateUpdate).toHaveBeenCalledWith({ targetActiveIndex: 2 }, CHILD_SRC);

    dispatch(
      { type: MGR_CLOSED_MSG, frameSrc: CHILD_SRC },
      iframe.contentWindow,
      CHILD_ORIGIN,
    );
    expect(onClose).toHaveBeenCalledWith(CHILD_SRC);
  });

  it('sendManagerActionToChild posts to the matched iframe at its explicit origin', () => {
    const iframe = addIframe(CHILD_SRC);
    const postSpy = jest
      .spyOn(iframe.contentWindow!, 'postMessage')
      .mockImplementation(() => {}) as jest.Mock;

    sendManagerActionToChild(CHILD_SRC, 'select', { role: 'target', index: 1 });
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: MGR_ACTION_MSG, action: 'select', role: 'target', index: 1 }),
      CHILD_ORIGIN,
    );
  });

  it('sendManagerCloseToChild posts MGR_CLOSE at the explicit origin', () => {
    const iframe = addIframe(CHILD_SRC);
    const postSpy = jest
      .spyOn(iframe.contentWindow!, 'postMessage')
      .mockImplementation(() => {}) as jest.Mock;

    sendManagerCloseToChild(CHILD_SRC);
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: MGR_CLOSE_MSG }),
      CHILD_ORIGIN,
    );
  });
});
