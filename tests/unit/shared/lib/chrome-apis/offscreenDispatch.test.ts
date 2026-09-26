import {
  registerOffscreenListener,
  unregisterOffscreenListener,
  dispatchOffscreenMessage,
  enableInProcessOffscreenDispatch,
} from '@/shared/lib/chrome-apis/offscreen';

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

enableInProcessOffscreenDispatch();

describe('in-process offscreen dispatch (Firefox path)', () => {
  it('resolves with the synchronous sendResponse value', async () => {
    const listener: Listener = (_m, _s, sendResponse) => {
      sendResponse({ success: true });
      return true;
    };
    registerOffscreenListener(listener);
    await expect(dispatchOffscreenMessage({ type: 'PING' })).resolves.toEqual({ success: true });
    unregisterOffscreenListener(listener);
  });

  it('resolves with an async sendResponse value when listener returns true', async () => {
    const listener: Listener = (m, _s, sendResponse) => {
      setTimeout(() => sendResponse({ echo: (m as { v: number }).v * 2 }), 0);
      return true;
    };
    registerOffscreenListener(listener);
    await expect(dispatchOffscreenMessage({ v: 21 })).resolves.toEqual({ echo: 42 });
    unregisterOffscreenListener(listener);
  });

  it('resolves undefined when no listener handles the message', async () => {
    const listener: Listener = () => false;
    registerOffscreenListener(listener);
    await expect(dispatchOffscreenMessage({ type: 'NOPE' })).resolves.toBeUndefined();
    unregisterOffscreenListener(listener);
  });

  it('skips listeners that return false and lets a later one respond', async () => {
    const nope: Listener = () => false;
    const yes: Listener = (_m, _s, sendResponse) => {
      sendResponse('handled');
      return false;
    };
    registerOffscreenListener(nope);
    registerOffscreenListener(yes);
    await expect(dispatchOffscreenMessage({})).resolves.toBe('handled');
    unregisterOffscreenListener(nope);
    unregisterOffscreenListener(yes);
  });

  it('passes a sender with no tab so runner isFromBackground filters pass', async () => {
    let seen: chrome.runtime.MessageSender | undefined;
    const listener: Listener = (_m, sender, sendResponse) => {
      seen = sender;
      sendResponse(!sender?.tab);
      return false;
    };
    registerOffscreenListener(listener);
    await expect(dispatchOffscreenMessage({})).resolves.toBe(true);
    expect(seen?.tab).toBeUndefined();
    unregisterOffscreenListener(listener);
  });

  it('unregistered listeners stop receiving messages', async () => {
    const calls: string[] = [];
    const listener: Listener = () => {
      calls.push('hit');
      return false;
    };
    registerOffscreenListener(listener);
    unregisterOffscreenListener(listener);
    await expect(dispatchOffscreenMessage({})).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});
