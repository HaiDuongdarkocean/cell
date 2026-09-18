import {
  requestManagerOpenOnHost,
  sendManagerStateUpdate,
  onManagerAction,
  onManagerCloseFromHost,
} from './iframeManagerBridgeChild';
import type { SerializedManagerState } from './iframeManagerBridgeTypes';

const PARENT_ORIGIN = 'https://host.example';

// Mock isChildFrame so we control child-frame detection without touching
// window.self/window.top. Hoisted before imports by jest.
jest.mock('./iframePlayerModeBridge', () => ({
  isChildFrame: jest.fn(() => true),
}));

jest.mock('@/shared/lib/dom/frameOrigin', () => ({
  resolveParentFrameOrigin: jest.fn(() => PARENT_ORIGIN),
  isResolvableHttpOrigin: jest.requireActual<
    typeof import('@/shared/lib/dom/frameOrigin')
  >('@/shared/lib/dom/frameOrigin').isResolvableHttpOrigin,
}));

import { isChildFrame } from './iframePlayerModeBridge';

const mockIsChildFrame = isChildFrame as jest.MockedFunction<typeof isChildFrame>;

function createMockState(): SerializedManagerState {
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

function dispatchParentMessage(data: Record<string, unknown>, origin = PARENT_ORIGIN): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

describe('iframeManagerBridgeChild', () => {
  beforeEach(() => {
    mockIsChildFrame.mockReturnValue(true);
    jest.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestManagerOpenOnHost', () => {
    it('returns false when !isChildFrame', async () => {
      mockIsChildFrame.mockReturnValue(false);
      const result = await requestManagerOpenOnHost(createMockState());
      expect(result).toBe(false);
    });

    it('sends MGR_OPEN message to window.parent at the resolved origin', async () => {
      const postMessage = window.parent.postMessage as jest.Mock;
      const promise = requestManagerOpenOnHost(createMockState());
      dispatchParentMessage({ type: '__CELL_MANAGER_OPENED', ok: true });
      await promise;
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '__CELL_MANAGER_OPEN' }),
        PARENT_ORIGIN,
      );
    });

    it('resolves true when MGR_OPENED {ok:true} received from parent origin', async () => {
      const promise = requestManagerOpenOnHost(createMockState());
      dispatchParentMessage({ type: '__CELL_MANAGER_OPENED', ok: true });
      const result = await promise;
      expect(result).toBe(true);
    });

    it('ignores MGR_OPENED from a foreign origin', async () => {
      jest.useFakeTimers();
      const promise = requestManagerOpenOnHost(createMockState(), 100);
      dispatchParentMessage({ type: '__CELL_MANAGER_OPENED', ok: true }, 'https://evil.example');
      jest.advanceTimersByTime(200);
      const result = await promise;
      expect(result).toBe(false);
      jest.useRealTimers();
    });

    it('resolves false on timeout', async () => {
      jest.useFakeTimers();
      const promise = requestManagerOpenOnHost(createMockState(), 100);
      jest.advanceTimersByTime(200);
      const result = await promise;
      expect(result).toBe(false);
      jest.useRealTimers();
    });
  });

  describe('sendManagerStateUpdate', () => {
    it('sends MGR_STATE message after manager opened on host', async () => {
      const openPromise = requestManagerOpenOnHost(createMockState());
      dispatchParentMessage({ type: '__CELL_MANAGER_OPENED', ok: true });
      await openPromise;

      const postMessage = window.parent.postMessage as jest.Mock;
      postMessage.mockClear();
      sendManagerStateUpdate({ targetActiveIndex: 1 });
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '__CELL_MANAGER_STATE' }),
        PARENT_ORIGIN,
      );
    });
  });

  describe('onManagerAction', () => {
    it('calls handler with action + args on MGR_ACTION from parent origin', () => {
      const handler = jest.fn();
      const off = onManagerAction(handler);
      dispatchParentMessage({ type: '__CELL_MANAGER_ACTION', action: 'select', role: 'target', index: 0 });
      expect(handler).toHaveBeenCalledWith('select', {
        type: '__CELL_MANAGER_ACTION',
        role: 'target',
        index: 0,
      });
      off();
    });

    it('drops MGR_ACTION from a foreign origin', () => {
      const handler = jest.fn();
      const off = onManagerAction(handler);
      dispatchParentMessage(
        { type: '__CELL_MANAGER_ACTION', action: 'select', role: 'target', index: 0 },
        'https://evil.example',
      );
      expect(handler).not.toHaveBeenCalled();
      off();
    });
  });

  describe('onManagerCloseFromHost', () => {
    it('calls handler on MGR_CLOSE from parent origin', () => {
      const handler = jest.fn();
      const off = onManagerCloseFromHost(handler);
      dispatchParentMessage({ type: '__CELL_MANAGER_CLOSE' });
      expect(handler).toHaveBeenCalled();
      off();
    });

    it('drops MGR_CLOSE from a foreign origin', () => {
      const handler = jest.fn();
      const off = onManagerCloseFromHost(handler);
      dispatchParentMessage({ type: '__CELL_MANAGER_CLOSE' }, 'https://evil.example');
      expect(handler).not.toHaveBeenCalled();
      off();
    });
  });
});
